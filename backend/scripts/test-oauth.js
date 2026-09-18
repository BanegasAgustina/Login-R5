// Pruebas de integración en una BD efímera: se copia solo la estructura de cuatro
// tablas, nunca usuarios reales. node:assert verifica resultados; crypto aísla nombres.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
// fileURLToPath decodifica espacios y letras de unidad en Windows correctamente.
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
// Firmamos un ID token de prueba con claves efímeras para probar OIDC sin Google real.
import { generateKeyPair, exportJWK, SignJWT } from 'jose';

dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)), quiet: true });
const originalDatabase = process.env.DB_NAME;
const testDatabase = `petcare_oauth_test_${randomBytes(6).toString('hex')}`;
const admin = await mysql.createConnection({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT || 3306), user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: originalDatabase });
let pool, server;
let passed = 0;
const realFetch = globalThis.fetch;

// Cada caso produce una línea legible y detiene la suite si hay una regresión.
async function check(name, action) { await action(); passed++; console.log(`OK ${passed}: ${name}`); }

try {
  await admin.query(`CREATE DATABASE \`${testDatabase}\``);
  await admin.query(`USE \`${testDatabase}\``);
  for (const table of ['roles', 'estados_usuario', 'usuarios', 'clientes']) {
    // Los nombres proceden de esta lista cerrada; no son entrada de usuario.
    const [rows] = await admin.query(`SHOW CREATE TABLE \`${originalDatabase.replaceAll('`', '``')}\`.\`${table}\``);
    await admin.query(rows[0]['Create Table']);
  }
  await admin.query("INSERT INTO roles(id,nombre) VALUES (1,'Administrador'),(2,'Veterinario'),(3,'Cliente')");
  await admin.query("INSERT INTO estados_usuario(id,nombre) VALUES (1,'Activo'),(2,'Inactivo')");
  const sql = await readFile(new URL('../migrations/001_oauth.sql', import.meta.url), 'utf8');
  // Evita informar éxito si la migración se vació o quedó incompleta.
  if (!sql.includes('CREATE TABLE IF NOT EXISTS oauth_accounts') || !sql.includes('CREATE TABLE IF NOT EXISTS oauth_flows')) {
    throw new Error('La migración OAuth está vacía o incompleta.');
  }
  for (const statement of sql.replace(/--[^\n]*/g, '').split(';').filter(s => s.trim())) await admin.query(statement);
  process.env.DB_NAME = testDatabase;
  process.env.PORT = '0';
  process.env.JWT_SECRET = randomBytes(48).toString('hex');
  process.env.CLIENT_URL = 'http://localhost:5173';
  process.env.BACKEND_URL = 'http://localhost:3000';
  process.env.NODE_ENV = 'development';
  // Valores exclusivos de pruebas: NO son credenciales y nunca se envían a Internet.
  for (const p of ['GOOGLE','GITHUB','FACEBOOK','DISCORD','TWITCH','TWITTER']) {
    process.env[`${p}_CLIENT_ID`] = 'test-only-client'; process.env[`${p}_CLIENT_SECRET`] = 'test-only-secret';
  }
  process.env.FACEBOOK_GRAPH_VERSION = 'v99.0';
  ({ pool } = await import('../src/config/database.js'));
  ({ server } = await import('../src/server.js'));
  if (!server.listening) await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const { resolveAccount } = await import('../src/services/oauthAccounts.js');
  const { createFlow, consumeFlow, hash, challenge } = await import('../src/services/oauthFlows.js');
  const { externalIdentity } = await import('../src/services/oauthIdentity.js');
  const { origin } = await import('../src/config/oauth.js');
  const { cookieOptions } = await import('../src/utils/oauthCookies.js');
  const { clearLoginAttempts } = await import('../src/middleware/rateLimit.js');
  const jsonHeaders = { 'Content-Type': 'application/json', Origin: process.env.CLIENT_URL };
  const post = (path, data, headers = {}) => realFetch(base + path, { method: 'POST', headers: { ...jsonHeaders, ...headers }, body: JSON.stringify(data) });
  let localToken, oauthCookie, oauthUser;

  await check('registro local, bcrypt y login Bearer conservados', async () => {
    const payload = { nombre: 'Prueba', apellido: 'Local', email: 'local@example.test', password: 'ClaveSegura!493' };
    assert.equal((await post('/auth/register', payload)).status, 201);
    const [rows] = await pool.query('SELECT password_hash FROM usuarios WHERE email=?', [payload.email]);
    assert.match(rows[0].password_hash, /^\$2[aby]\$12\$/);
    const response = await post('/auth/login', payload);
    assert.equal(response.status, 200);
    const body = await response.json(); localToken = body.token;
    assert.equal(body.usuario.password_hash, undefined);
    assert.equal((await realFetch(base+'/auth/me', { headers: { Authorization: `Bearer ${localToken}` } })).status, 200);
    assert.equal((await post('/auth/register', payload)).status, 409);
    assert.equal((await post('/auth/login', { ...payload, password: 'incorrecta' })).status, 401);
  });
  await check('primera identidad crea usuario Cliente, sin contraseña, y perfil cliente', async () => {
    oauthUser = await resolveAccount('github', { id: '1001', name: 'Externo', email: 'external@example.test' });
    assert.equal(oauthUser.password_hash, null); assert.equal(oauthUser.rol, 'Cliente');
    const [rows] = await pool.query('SELECT id FROM clientes WHERE usuario_id=?', [oauthUser.id]); assert.equal(rows.length, 1);
    assert.equal((await post('/auth/login', { email: 'external@example.test', password: 'cualquiera' })).status, 401);
  });
  await check('segundo ingreso usa ID externo aunque cambie el email', async () => {
    assert.equal((await resolveAccount('github', { id: '1001', email: 'changed@example.test' })).id, oauthUser.id);
  });
  await check('email de cuenta local y de otra identidad bloquea vinculación automática', async () => {
    await assert.rejects(resolveAccount('google', { id: 'another', email: 'LOCAL@example.test' }), /OAUTH_EMAIL_CONFLICT/);
    await assert.rejects(resolveAccount('discord', { id: 'another', email: 'external@example.test' }), /OAUTH_EMAIL_CONFLICT/);
    const [rows] = await pool.query("SELECT COUNT(*) AS n FROM oauth_accounts WHERE provider IN ('google','discord')"); assert.equal(rows[0].n, 0);
  });
  await check('dos identidades sin email tienen NULL, sin datos ficticios', async () => {
    const a = await resolveAccount('twitter', { id: '2001' }); const b = await resolveAccount('twitter', { id: '2002' });
    assert.equal(a.email, null); assert.equal(b.email, null); assert.notEqual(a.id, b.id);
  });
  await check('normalización de Gmail coincide con el registro tradicional', async () => {
    const response = await post('/auth/register', { nombre: 'Correo', apellido: 'Local', email: 'hello.world+clase@gmail.com', password: 'ClaveSegura!493' });
    assert.equal(response.status, 201);
    await assert.rejects(resolveAccount('google', { id: 'gmail-id', email: 'hello.world@gmail.com' }), /OAUTH_EMAIL_CONFLICT/);
  });
  await check('concurrencia no duplica usuarios ni clientes', async () => {
    const results = await Promise.all([1,2,3].map(() => resolveAccount('github', { id: 'race', email: 'race@example.test' })));
    assert.equal(new Set(results.map(r => r.id)).size, 1);
    const [rows] = await pool.query("SELECT COUNT(*) AS n FROM usuarios WHERE email='race@example.test'"); assert.equal(rows[0].n, 1);
  });
  await check('cuenta desactivada no puede volver por OAuth', async () => {
    await pool.query('UPDATE usuarios SET estado_id=2 WHERE id=?', [oauthUser.id]);
    await assert.rejects(resolveAccount('github', { id: '1001' }), /OAUTH_INACTIVE/);
    await pool.query('UPDATE usuarios SET estado_id=1 WHERE id=?', [oauthUser.id]);
  });
  await check('state exige navegador correcto y proveedor correcto, luego es de un solo uso', async () => {
    const f = await createFlow('github', true);
    assert.equal(challenge(f.verifier).length, 43);
    await assert.rejects(consumeFlow('github', f.state, 'x'.repeat(43)), /OAUTH_STATE/);
    await assert.rejects(consumeFlow('google', f.state, f.browser), /OAUTH_STATE/);
    await consumeFlow('github', f.state, f.browser);
    await assert.rejects(consumeFlow('github', f.state, f.browser), /OAUTH_STATE/);
    await assert.rejects(consumeFlow('github', undefined, f.browser), /OAUTH_STATE/);
  });
  await check('state vencido y replay concurrente rechazados', async () => {
    const f = await createFlow('github', true);
    await pool.query('UPDATE oauth_flows SET expires_at=DATE_SUB(UTC_TIMESTAMP(), INTERVAL 1 MINUTE) WHERE state_hash=?', [hash(f.state)]);
    await assert.rejects(consumeFlow('github', f.state, f.browser), /OAUTH_STATE/);
    const g = await createFlow('github', true);
    const results = await Promise.allSettled([consumeFlow('github', g.state, g.browser), consumeFlow('github', g.state, g.browser)]);
    assert.equal(results.filter(r=>r.status==='fulfilled').length, 1);
  });
  await check('cookies y URLs limitan exposición de sesión y redirecciones', async () => {
    process.env.NODE_ENV = 'production'; assert.equal(cookieOptions().secure, true);
    assert.equal(cookieOptions().httpOnly, true); assert.equal(cookieOptions().sameSite, 'lax');
    assert.throws(() => origin('http://localhost:3000'));
    process.env.NODE_ENV = 'development';
    for(const url of ['https://user:pass@example.test','https://example.test/path','https://example.test/?returnTo=evil','http://example.test']) assert.throws(()=>origin(url));
  });
  // El mock HTTP solo simula respuestas de proveedores en esta suite, nunca en la app.
  // Guardamos fetch real para llamar nuestra API y rechazamos toda URL no prevista.
  let tokenBody;
  const googlePair = await generateKeyPair('RS256');
  const googleJwk = await exportJWK(googlePair.publicKey);
  googleJwk.kid = 'test-key';
  let googleToken = 'invalid-test-token';
  globalThis.fetch = async (url, options = {}) => {
    const address = String(url);
    if (address === 'https://www.googleapis.com/oauth2/v3/certs') return Response.json({ keys: [googleJwk] });
    if (address.includes('access_token') || address.endsWith('/token')) {
      tokenBody = new URLSearchParams(options.body);
      return Response.json({ access_token: 'test-only-token', token_type: 'bearer', id_token: googleToken });
    }
    if (address === 'https://api.github.com/user') return Response.json({ id: 1001, name: 'Externo' });
    if (address === 'https://api.github.com/user/emails') return Response.json([{ email: 'external@example.test', primary: true, verified: true }]);
    if (address.includes('discord.com/api/v10/users/@me')) return Response.json({ id: 'discord-id', username: 'Prueba', verified: false, email: 'unverified@example.test' });
    if (address.includes('api.twitch.tv/helix/users')) { assert.equal(options.headers['Client-Id'], 'test-only-client'); return Response.json({ data: [{ id: 'twitch-id', display_name: 'Prueba' }] }); }
    if (address.includes('graph.facebook.com/') && address.includes('/me?')) return Response.json({ id: 'facebook-id', first_name: 'Prueba' });
    if (address.includes('api.x.com/2/users/me')) return Response.json({ data: { id: 'twitter-id', name: 'Prueba' } });
    throw new Error('URL no autorizada en prueba: ' + address);
  };
  await check('adaptadores reales interpretan perfiles autorizados sin exigir email', async () => {
    for (const p of ['discord','twitch','facebook','twitter']) {
      const identity = await externalIdentity(p, 'test-code', { verifier: 'test-verifier' });
      assert.equal(identity.id, `${p}-id`); assert.ok(!identity.email);
    }
    await assert.rejects(externalIdentity('google', 'test-code', { verifier: 'test-verifier', nonce: 'test-nonce' }));
  });
  await check('OIDC valida firma, audiencia, emisor, vencimiento y nonce', async () => {
    // Los tokens se firman localmente y el JWKS está interceptado solo en esta suite.
    const sign = (audience = 'test-only-client', issuer = 'https://accounts.google.com', expiry = '5m') =>
      new SignJWT({ nonce: 'expected-nonce', name: 'Prueba Google', email: 'oidc@example.test' })
        .setProtectedHeader({ alg: 'RS256', kid: 'test-key' }).setIssuer(issuer)
        .setAudience(audience).setSubject('google-id').setIssuedAt().setExpirationTime(expiry).sign(googlePair.privateKey);
    googleToken = await sign();
    assert.equal((await externalIdentity('google', 'test-code', { verifier: 'v', nonce: 'expected-nonce' })).id, 'google-id');
    await assert.rejects(externalIdentity('google', 'test-code', { verifier: 'v', nonce: 'wrong-nonce' }));
    for (const args of [['wrong-audience'], ['test-only-client','https://attacker.test'], ['test-only-client','https://accounts.google.com','-1m']]) {
      googleToken = await sign(...args);
      await assert.rejects(externalIdentity('google', 'test-code', { verifier: 'v', nonce: 'expected-nonce' }));
    }
    googleToken = await sign();
    const parts = googleToken.split('.');
    parts[2] = (parts[2][0] === 'A' ? 'B' : 'A') + parts[2].slice(1);
    googleToken = parts.join('.');
    await assert.rejects(externalIdentity('google', 'test-code', { verifier: 'v', nonce: 'expected-nonce' }));
  });
  await check('callback completo emite sesión HttpOnly y redirige sin tokens', async () => {
    clearLoginAttempts({ ip: '::ffff:127.0.0.1' });
    const start = await realFetch(base+'/auth/github', { redirect: 'manual' });
    assert.equal(start.status, 302);
    const url = new URL(start.headers.get('location'));
    assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
    assert.equal(url.searchParams.get('client_secret'), null);
    const flowCookie = start.headers.get('set-cookie').split(';')[0];
    const callback = await realFetch(base+`/auth/github/callback?code=test-code&state=${url.searchParams.get('state')}`, { headers: { Cookie: flowCookie }, redirect: 'manual' });
    assert.equal(callback.status, 303);
    assert.equal(callback.headers.get('location'), process.env.CLIENT_URL+'/login?oauth=success');
    assert.equal(tokenBody.get('grant_type'), 'authorization_code');
    assert.equal(challenge(tokenBody.get('code_verifier')), url.searchParams.get('code_challenge'));
    const cookie = callback.headers.getSetCookie().find(c=>c.startsWith('petcare_oauth='));
    assert.match(cookie, /HttpOnly/); assert.match(cookie, /SameSite=Lax/); oauthCookie = cookie.split(';')[0];
    const me = await realFetch(base+'/auth/me', { headers: { Cookie: oauthCookie } });
    assert.equal(me.status, 200); assert.equal((await me.json()).id, oauthUser.id);
  });
  await check('sesión cookie bloquea escritura cross-origin y conserva sesión Bearer', async () => {
    const denied = await post('/auth/logout', {}, { Cookie: oauthCookie, Origin: 'https://attacker.test' }); assert.equal(denied.status, 403);
    const valid = await post('/auth/logout', {}, { Cookie: oauthCookie }); assert.equal(valid.status, 204);
    assert.match(valid.headers.get('set-cookie'), /petcare_oauth=;/);
    assert.equal((await post('/auth/logout', {}, { Authorization: `Bearer ${localToken}` })).status, 204);
  });
  await check('callback inválido no alcanza al proveedor; cancelar consume state', async () => {
    const bad = await realFetch(base+'/auth/github/callback?code=invalid&state=invalid', { redirect: 'manual' });
    assert.match(bad.headers.get('location'), /OAUTH_STATE/);
    const f = await createFlow('github', true);
    const cancelled = await realFetch(base+`/auth/github/callback?error=access_denied&state=${f.state}`, { headers: { Cookie: `oauth_flow_github=${f.browser}` }, redirect: 'manual' });
    assert.match(cancelled.headers.get('location'), /OAUTH_CANCELLED/);
    await assert.rejects(consumeFlow('github', f.state, f.browser), /OAUTH_STATE/);
  });
  await check('proveedor sin credenciales queda deshabilitado y no filtra secretos', async () => {
    delete process.env.GITHUB_CLIENT_SECRET;
    const response = await realFetch(base+'/auth/providers'); const text = await response.text();
    assert.ok(!text.includes('test-only')); assert.equal(JSON.parse(text).find(p=>p.id==='github').enabled, false);
    clearLoginAttempts({ ip: '::ffff:127.0.0.1' });
    const start = await realFetch(base+'/auth/github', { redirect: 'manual' }); assert.match(start.headers.get('location'), /OAUTH_NOT_CONFIGURED/);
    assert.equal((await realFetch(base+'/auth/unknown', { redirect: 'manual' })).status, 404);
  });
  console.log(`\n${passed} casos de integración aprobados. Ninguna cuenta real modificada.`);
} finally {
  globalThis.fetch = realFetch;
  if (server) await new Promise(resolve => server.close(resolve));
  if (pool) await pool.end();
  // Solo eliminamos la BD de prueba creada por ESTA ejecución, con nombre aleatorio.
  if (/^petcare_oauth_test_[a-f0-9]{12}$/.test(testDatabase)) await admin.query(`DROP DATABASE IF EXISTS \`${testDatabase}\``);
  await admin.end();
}

