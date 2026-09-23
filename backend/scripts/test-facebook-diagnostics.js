import assert from 'node:assert/strict';
import { once } from 'node:events';

// Prueba local: HTTP de Meta y consultas MySQL se simulan; nunca se abre la BD real.
Object.assign(process.env, {
  NODE_ENV: 'development', FACEBOOK_OAUTH_DEBUG: 'true',
  FACEBOOK_CLIENT_ID: 'test-client', FACEBOOK_CLIENT_SECRET: 'SECRET_SENTINEL',
  FACEBOOK_GRAPH_VERSION: 'v99.0', JWT_SECRET: 'JWT_SENTINEL', JWT_EXPIRES_IN: '8h',
  MYSQL_PUBLIC_URL: 'mysql://test:test@127.0.0.1/test',
  BACKEND_URL: 'http://localhost:3000', CLIENT_URL: 'http://localhost:5173',
});
const { pool } = await import('../src/config/database.js');
const { clearLoginAttempts } = await import('../src/middleware/rateLimit.js');
const { cookieOptions } = await import('../src/utils/oauthCookies.js');
const { facebookDiagnostics } = await import('../src/utils/facebookDiagnostics.js');
const realFetch = globalThis.fetch;
const realInfo = console.info, realError = console.error;
const logs = [];
console.info = console.error = (...args) => logs.push(args);
const secrets = ['SECRET_SENTINEL', 'TOKEN_SENTINEL', 'CODE_SENTINEL', 'PRIVATE_SQL_SENTINEL'];
let server, user, account, mode = 'success', inserts = 0, providerCalls = 0;
const flows = new Map();
let snapshot;
const connection = {
  async beginTransaction() { snapshot = { user, account }; },
  async commit() {},
  async rollback() { ({ user, account } = snapshot); },
  release() {},
  async query(sql, args = []) {
    if (sql.startsWith('SELECT') && sql.includes('FROM oauth_flows')) {
      const flow = flows.get(args[0]); return [flow ? [flow] : []];
    }
    if (sql.startsWith('DELETE FROM oauth_flows WHERE state_hash')) { flows.delete(args[0]); return [{}]; }
    if (sql.includes('FROM oauth_accounts')) {
      if (mode === 'database') throw Object.assign(new Error('PRIVATE_SQL_SENTINEL'), { code: 'ER_NO_SUCH_TABLE', errno: 1146 });
      assert.deepEqual(args, ['facebook', 'facebook-test-id']);
      return [account ? [user] : []];
    }
    if (sql.includes('FROM roles ORDER')) return [[{ id: 3, nombre: 'Cliente' }]];
    if (sql.startsWith('INSERT INTO usuarios')) {
      assert.equal(args[0], 'Test Facebook'); assert.equal(args[2], null);
      user = { id: 42, nombre: args[0], apellido: '', email: null, password_hash: null, rol: 'Cliente', rol_id: 3, estado_id: 1 };
      inserts++; return [{ insertId: 42 }];
    }
    if (sql.startsWith('INSERT INTO clientes')) return [{}];
    if (sql.startsWith('INSERT INTO oauth_accounts')) {
      assert.deepEqual(args.slice(0, 3), [42, 'facebook', 'facebook-test-id']); account = true; return [{}];
    }
    if (sql.includes('FROM usuarios u')) return [[user]];
    throw new Error('Unexpected mock database query');
  },
};
pool.getConnection = async () => connection;
pool.query = async (sql, args) => {
  if (sql.startsWith('DELETE FROM oauth_flows WHERE expires_at')) return [{}];
  if (sql.startsWith('INSERT INTO oauth_flows')) {
    assert.equal(args[2], 'facebook'); assert.equal(args[3], null);
    flows.set(args[0], { state_hash: args[0], browser_hash: args[1], provider: args[2], flow_valid: 1 });
    secrets.push(args[0], args[1]); return [{}];
  }
  return connection.query(sql, args);
};
globalThis.fetch = async (url, options) => {
  const address = new URL(url);
  assert.equal(address.hostname, 'graph.facebook.com');
  providerCalls++;
  if (address.pathname.endsWith('/oauth/access_token')) {
    const body = new URLSearchParams(options.body);
    assert.equal(body.get('redirect_uri'), 'http://localhost:3000/api/auth/facebook/callback');
    assert.equal(body.get('client_secret'), 'SECRET_SENTINEL');
    assert.equal(body.get('code_verifier'), null);
    if (mode === 'token') return Response.json({ error: {
      type: 'OAuthException', code: 100, error_subcode: 36008,
      message: 'redirect_uri mismatch SECRET_SENTINEL CODE_SENTINEL',
    } }, { status: 400 });
    if (mode === 'token-missing') return Response.json({});
    return Response.json({ access_token: 'TOKEN_SENTINEL' });
  }
  assert.equal(address.pathname, '/v99.0/me');
  assert.equal(address.searchParams.get('fields'), 'id,name,first_name,last_name,picture');
  if (mode === 'profile') return Response.json({ error: { type: 'OAuthException', code: 190, message: 'access token TOKEN_SENTINEL' } }, { status: 403 });
  if (mode === 'invalid-json') return new Response('TOKEN_SENTINEL', { status: 502 });
  if (mode === 'missing-id') return Response.json({ name: 'Test Facebook' });
  return Response.json({ id: 'facebook-test-id', name: 'Test Facebook' });
};
let passed = 0;
async function check(name, fn) { logs.length = 0; await fn(); passed++; realInfo(`OK ${passed}: ${name}`); }
const failures = () => logs.filter(entry => entry[0] === '[OAuth Facebook] FAILED_STAGE:').map(entry => entry[1]);
function assertSafe() {
  const output = JSON.stringify(logs);
  for (const secret of secrets) assert.ok(!output.includes(secret), 'Diagnostic leaked a secret');
}
try {
  const { app } = await import('../src/app.js');
  server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}/api/auth`;
  const request = (path, cookie) => realFetch(base + path, {
    redirect: 'manual', headers: { Origin: process.env.CLIENT_URL, ...(cookie ? { Cookie: cookie } : {}) },
  });
  async function start() {
    clearLoginAttempts({ ip: '127.0.0.1' });
    const res = await request('/facebook'); assert.equal(res.status, 302);
    const url = new URL(res.headers.get('location'));
    assert.equal(url.searchParams.get('scope'), 'public_profile');
    assert.equal(url.searchParams.get('redirect_uri'), 'http://localhost:3000/api/auth/facebook/callback');
    const cookie = res.headers.get('set-cookie');
    assert.match(cookie, /HttpOnly/); assert.match(cookie, /SameSite=Lax/); assert.match(cookie, /Path=\/api/);
    assert.ok(!cookie.includes('Secure')); assert.ok(!cookie.includes('Domain='));
    secrets.push(url.searchParams.get('state'), cookie.split(';')[0].split('=')[1]);
    return { state: url.searchParams.get('state'), cookie: cookie.split(';')[0] };
  }
  const callback = flow => request(`/facebook/callback?code=CODE_SENTINEL&state=${flow.state}`, flow.cookie);
  await check('401 previo; callback sin email emite cookie; /me acepta sesión; reingreso conserva ID', async () => {
    assert.equal((await request('/me')).status, 401);
    for (let i = 0; i < 2; i++) {
      const done = await callback(await start());
      assert.equal(done.headers.get('location'), 'http://localhost:5173/login?oauth=success');
      const cookie = done.headers.getSetCookie().find(value => value.startsWith('petcare_oauth='));
      assert.match(cookie, /HttpOnly/); assert.match(cookie, /SameSite=Lax/);
      secrets.push(cookie.split(';')[0].split('=')[1]);
      const me = await request('/me', cookie.split(';')[0]);
      assert.equal(me.status, 200); assert.equal((await me.json()).id, 42);
      assert.equal(me.headers.get('access-control-allow-credentials'), 'true');
    }
    assert.equal(inserts, 1); assert.equal(user.email, null); assertSafe();
  });
  for (const [scenario, stage] of [['token', 'TOKEN_EXCHANGE'], ['token-missing', 'TOKEN_EXCHANGE'], ['profile', 'PROFILE_REQUEST'], ['invalid-json', 'PROFILE_REQUEST'], ['missing-id', 'PROFILE_VALIDATION'], ['database', 'DATABASE'], ['session', 'SESSION']]) {
    await check(`fallo ${scenario}: etapa precisa y secretos ausentes`, async () => {
      mode = scenario;
      if (mode === 'session') process.env.JWT_EXPIRES_IN = 'invalid';
      const done = await callback(await start());
      assert.match(done.headers.get('location'), /oauth_error=OAUTH_FAILED$/);
      assert.ok(failures().some(f => f.stage === stage));
      if (mode === 'token') assert.ok(failures().some(f => f.http_status === 400 && f.provider_code === 100 && f.provider_subcode === 36008));
      if (mode === 'database') assert.ok(failures().some(f => f.code === 'ER_NO_SUCH_TABLE'));
      assertSafe(); mode = 'success'; process.env.JWT_EXPIRES_IN = '8h';
    });
  }
  for (const reason of ['STATE_NOT_FOUND', 'STATE_EXPIRED', 'BROWSER_MISMATCH', 'BROWSER_COOKIE_MISSING', 'PROVIDER_MISMATCH']) {
    await check(reason, async () => {
      flows.clear(); const flow = await start(); const stored = [...flows.values()][0];
      if (reason === 'STATE_NOT_FOUND') flows.clear();
      if (reason === 'STATE_EXPIRED') stored.flow_valid = 0;
      if (reason === 'BROWSER_MISMATCH') flow.cookie = 'oauth_flow_facebook=' + 'x'.repeat(43);
      if (reason === 'BROWSER_COOKIE_MISSING') flow.cookie = '';
      if (reason === 'PROVIDER_MISMATCH') stored.provider = 'github';
      const before = providerCalls; const done = await callback(flow);
      assert.match(done.headers.get('location'), /oauth_error=OAUTH_STATE$/);
      assert.equal(providerCalls, before);
      assert.ok(failures().some(f => f.stage === 'STATE_VALIDATION' && f.reason === reason)); assertSafe();
    });
  }
  await check('replay rechazado; Secure solo producción; diagnóstico desactivable', async () => {
    const flow = await start(); await callback(flow); await callback(flow);
    assert.ok(failures().some(f => f.reason === 'STATE_NOT_FOUND'), JSON.stringify(failures())); assertSafe();
    process.env.NODE_ENV = 'production'; assert.equal(cookieOptions().secure, true);
    process.env.FACEBOOK_OAUTH_DEBUG = 'false'; const count = logs.length;
    const diagnostic = facebookDiagnostics(); diagnostic.log('test'); diagnostic.fail(new Error('secret'));
    assert.equal(logs.length, count);
  });
  realInfo(`${passed} pruebas Facebook aprobadas (HTTP local, Meta y MySQL simulados).`);
} finally {
  globalThis.fetch = realFetch; console.info = realInfo; console.error = realError;
  if (server) await new Promise(resolve => server.close(resolve));
  await pool.end();
}
