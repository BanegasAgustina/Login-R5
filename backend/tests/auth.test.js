import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { pool } from '../src/config/database.js';
import { hasUserType, USER_TYPES } from '../src/auth/userTypes.js';
import { resolveAccount } from '../src/services/oauthAccounts.js';

// Ningún caso abre una conexión MySQL. Una consulta no simulada falla la prueba.
process.env.JWT_SECRET = randomBytes(48).toString('hex');
process.env.CLIENT_URL = 'http://localhost:5173';
process.env.NODE_ENV = 'test';
const roles = [{ id: 41, nombre: 'Administrador' }, { id: 72, nombre: 'Veterinario' }, { id: 93, nombre: 'Cliente' }];
const secretHash = await bcrypt.hash('SafeTest!2026', 4);
let account, queries;
const reset = () => {
  account = { id: 15, rol_id: 93, rol: 'Cliente', estado_id: 1, nombre: 'Prueba', apellido: 'Local', email: 'test@example.test', password_hash: secretHash };
  queries = [];
};
reset();

await test('HTTP: sesión y permisos vigentes sin acceder a MySQL', async t => {
  t.mock.method(pool, 'getConnection', async () => { throw new Error('Conexión real prohibida'); });
  t.mock.method(pool, 'query', async (raw, params = []) => {
    const sql = raw.replace(/\s+/g, ' ').trim();
    queries.push({ sql, params });
    if (sql === 'SELECT id, nombre FROM roles ORDER BY id') return [roles];
    if (sql === 'SELECT id FROM roles WHERE id = ?') return [roles.filter(r => r.id === Number(params[0]))];
    if (sql.startsWith('SELECT id FROM usuarios WHERE LOWER')) return [[]];
    if (sql.includes('FROM usuarios u JOIN roles') && (sql.includes('WHERE u.id = ?') || sql.includes('WHERE u.email = ?'))) {
      return [account ? [account] : []];
    }
    if (sql.startsWith('INSERT INTO usuarios')) return [{ insertId: 99 }];
    if (sql.startsWith('INSERT INTO clientes')) return [{ affectedRows: 1 }];
    if (sql.startsWith('UPDATE usuarios')) return [{ affectedRows: 1 }];
    if (sql.startsWith('SELECT id FROM clientes WHERE usuario_id')) return [[{ id: 123 }]];
    if (sql.startsWith('SELECT id FROM veterinarios WHERE usuario_id')) return [[{ id: 456 }]];
    if (sql.startsWith('SELECT COUNT(*) AS total FROM')) return [[{ total: 0 }]];
    if (sql.includes('FROM mascotas m') || sql.includes('FROM turnos t') || sql.includes('FROM consultas c')) return [[]];
    throw new Error(`Consulta sin simular: ${sql}`);
  });
  const { default: app } = await import('../src/app.js');
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const token = jwt.sign({ id: 15, rol: 'Administrador', tipo_usuario: 41 }, process.env.JWT_SECRET);
  const request = (path, { cookie = false, method = 'GET', body, origin, bearer = token } = {}) => fetch(base + path, {
    method, headers: {
      ...(cookie ? { Cookie: `petcare_oauth=${bearer}` } : bearer ? { Authorization: `Bearer ${bearer}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}), ...(origin ? { Origin: origin } : {}),
    }, body: body ? JSON.stringify(body) : undefined, redirect: 'manual',
  });

  await t.test('health, CORS y 404 conservados', async () => {
    const response = await request('/health', { origin: process.env.CLIENT_URL });
    assert.deepEqual(await response.json(), { ok: true });
    assert.equal(response.headers.get('access-control-allow-origin'), process.env.CLIENT_URL);
    assert.equal(response.headers.get('access-control-allow-credentials'), 'true');
    assert.equal((await request('/no-existe')).status, 404);
  });
  await t.test('login ignora rol enviado y devuelve tipo de BD sin secretos', async () => {
    reset();
    const response = await request('/auth/login', { method: 'POST', body: { email: account.email, password: 'SafeTest!2026', rol_id: 41, tipo_usuario: 41 } });
    assert.equal(response.status, 200);
    const { usuario, token: localToken } = await response.json();
    assert.equal(usuario.tipo_usuario, 93);
    assert.equal(usuario.rolId, 93);
    assert.deepEqual(usuario.userTypes, { admin: 41, veterinarian: 72, client: 93 });
    assert.equal(usuario.password_hash, undefined);
    assert.equal(jwt.verify(localToken, process.env.JWT_SECRET).id, 15);
  });
  await t.test('contraseña incorrecta y cuenta OAuth sin contraseña conservan 401', async () => {
    reset();
    assert.equal((await request('/auth/login', { method: 'POST', body: { email: account.email, password: 'incorrecta' } })).status, 401);
    account.password_hash = null;
    assert.equal((await request('/auth/login', { method: 'POST', body: { email: account.email, password: 'SafeTest!2026' } })).status, 401);
  });
  await t.test('Bearer y cookie ignoran rol JWT obsoleto y reflejan cambios de BD', async () => {
    for (const cookie of [false, true]) {
      reset();
      assert.equal((await request('/admin/roles', { cookie })).status, 403);
      account.rol_id = 41; account.rol = 'Administrador';
      assert.equal((await request('/admin/roles', { cookie })).status, 200);
      account.rol_id = 93; account.rol = 'Cliente';
      assert.equal((await request('/admin/roles', { cookie })).status, 403);
      const me = await (await request('/auth/me', { cookie })).json();
      assert.equal(me.tipo_usuario, 93);
      account.estado_id = 2;
      assert.equal((await request('/auth/me', { cookie })).status, 401);
      account = undefined;
      assert.equal((await request('/auth/me', { cookie })).status, 401);
    }
  });
  await t.test('sesión ausente o firma inválida no accede a datos', async () => {
    reset(); queries = [];
    assert.equal((await request('/auth/me', { bearer: null })).status, 401);
    assert.equal((await request('/auth/me', { bearer: token + 'x' })).status, 401);
    assert.equal(queries.length, 0);
  });
  await t.test('cookie mantiene CSRF y logout sin token vigente', async () => {
    reset();
    assert.equal((await request('/auth/me', { cookie: true, method: 'PUT', body: { nombre: 'Otro' }, origin: 'https://untrusted.example' })).status, 403);
    const response = await request('/auth/logout', { cookie: true, method: 'POST', origin: process.env.CLIENT_URL });
    assert.equal(response.status, 204);
    assert.match(response.headers.get('set-cookie'), /petcare_oauth=;/);
  });
  await t.test('registro busca ID Cliente del catálogo e ignora privilegios enviados', async () => {
    reset();
    const response = await request('/auth/register', { method: 'POST', body: { nombre: 'Nuevo', apellido: 'Usuario', email: 'new@example.test', password: 'SafeTest!2026', rol_id: 41, tipo_usuario: 41 } });
    assert.equal(response.status, 201);
    assert.equal(queries.find(q => q.sql.startsWith('INSERT INTO usuarios')).params[4], 93);
  });
  await t.test('edición administrativa valida catálogo y acepta IDs fuera de 1–3', async () => {
    reset(); account.rol_id = 41; account.rol = 'Administrador';
    assert.equal((await request('/admin/usuarios/20', { method: 'PUT', body: { rol_id: 72 } })).status, 200);
    queries = [];
    assert.equal((await request('/admin/usuarios/20', { method: 'PUT', body: { rol_id: 999 } })).status, 400);
    assert.equal(queries.some(q => q.sql.startsWith('UPDATE usuarios')), false);
  });
  await t.test('permisos clínicos y filtros de propiedad se conservan', async () => {
    reset();
    assert.equal((await request('/pacientes')).status, 403);
    assert.equal((await request('/mascotas')).status, 200);
    assert.ok(queries.some(q => q.sql.includes('WHERE m.cliente_id = ?') && q.params[0] === 123));
    assert.equal((await request('/turnos')).status, 200);
    assert.ok(queries.some(q => q.sql.includes('WHERE c.usuario_id = ?') && q.params[0] === 15));
    account.rol_id = 72; account.rol = 'Veterinario';
    assert.equal((await request('/pacientes')).status, 200);
    assert.equal((await request('/turnos/hoy')).status, 200);
    assert.equal((await request('/admin/roles')).status, 403);
    assert.equal((await request('/mascotas', { method: 'POST', body: {} })).status, 403);
    account.rol_id = 41; account.rol = 'Administrador';
    assert.equal((await request('/mascotas')).status, 403);
    assert.equal((await request('/dashboard')).status, 403);
    assert.equal((await request('/admin/resumen')).status, 200);
  });
  await t.test('se preservan seis proveedores y rutas OAuth sin iniciar flujos SQL', async () => {
    for (const p of ['GOOGLE', 'GITHUB', 'FACEBOOK', 'DISCORD', 'TWITCH', 'TWITTER']) {
      process.env[`${p}_CLIENT_ID`] = ''; process.env[`${p}_CLIENT_SECRET`] = '';
    }
    const providers = await (await request('/auth/providers')).json();
    assert.deepEqual(providers.map(p => p.id), ['google', 'github', 'facebook', 'discord', 'twitch', 'twitter']);
    assert.ok(providers.every(p => !p.enabled));
    const response = await request('/auth/google');
    assert.equal(response.status, 303);
    assert.match(response.headers.get('location'), /oauth_error=OAUTH_NOT_CONFIGURED/);
    assert.equal((await request('/auth/unknown/callback')).status, 404);
  });
});

await test('OAuth conserva vinculación por identidad y resuelve alta Cliente sin ID fijo', async () => {
  const recorded = [];
  let existing = null;
  const connection = {
    async beginTransaction() {}, async commit() {}, async rollback() {}, release() {},
    async query(raw, params = []) {
      const sql = raw.replace(/\s+/g, ' ').trim(); recorded.push({ sql, params });
      if (sql.includes('FROM oauth_accounts')) return [existing ? [existing] : []];
      if (sql.startsWith('SELECT id FROM usuarios')) return [[]];
      if (sql === 'SELECT id, nombre FROM roles ORDER BY id') return [roles];
      if (sql.startsWith('INSERT INTO usuarios')) return [{ insertId: 99 }];
      if (sql.startsWith('INSERT INTO clientes') || sql.startsWith('INSERT INTO oauth_accounts')) return [{ affectedRows: 1 }];
      if (sql.startsWith('SELECT u.*')) return [[{ id: 99, rol_id: 93, rol: 'Cliente', estado_id: 1 }]];
      throw new Error(`Consulta sin simular: ${sql}`);
    },
  };
  const database = { async getConnection() { return connection; } };
  const created = await resolveAccount('google', { id: 'external-123', name: 'Prueba' }, database);
  assert.equal(created.rol_id, 93);
  assert.equal(recorded.find(q => q.sql.startsWith('INSERT INTO usuarios')).params[3], 93);
  existing = { id: 99, rol_id: 72, rol: 'Veterinario', estado_id: 1 };
  const returning = await resolveAccount('google', { id: 'external-123' }, database);
  assert.equal(returning.rol_id, 72);
  existing.estado_id = 2;
  await assert.rejects(resolveAccount('google', { id: 'external-123' }, database), /OAUTH_INACTIVE/);
});

await test('política rechaza datos incompletos y no interpreta nombres como autorización', () => {
  assert.equal(hasUserType({ rol: 'Administrador' }, USER_TYPES.ADMIN), false);
  assert.equal(hasUserType({ tipo_usuario: 93, userTypes: { admin: 41 } }, USER_TYPES.ADMIN), false);
  assert.equal(hasUserType({ tipo_usuario: 41, userTypes: { admin: 41 } }, USER_TYPES.ADMIN), true);
});
