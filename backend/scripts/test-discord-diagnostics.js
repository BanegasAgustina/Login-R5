import assert from 'node:assert/strict';
import { externalIdentity } from '../src/services/oauthIdentity.js';
import { callbackURL, providers } from '../src/config/oauth.js';

// Solo HTTP simulado; no se utilizan credenciales reales ni se conecta a MySQL.
Object.assign(process.env, { NODE_ENV: 'development', BACKEND_URL: 'http://localhost:3000',
  DISCORD_CLIENT_ID: 'test-client', DISCORD_CLIENT_SECRET: 'secret-sentinel' });
const original = { fetch: globalThis.fetch, info: console.info, error: console.error };
const logs = [];
console.info = console.error = (...args) => logs.push(args);
let cases = 0;
async function run(responses, expectedError, expectedProfile = {}) {
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    const response = responses.shift();
    if (response instanceof Error) throw response;
    assert.ok(response, 'Unexpected HTTP request');
    return response;
  };
  if (expectedError) await assert.rejects(externalIdentity('discord', 'code-sentinel', {}),
    error => error.message === 'OAUTH_PROVIDER' && error.code === expectedError);
  else {
    const identity = await externalIdentity('discord', 'code-sentinel', {});
    assert.equal(identity.id, '123456789012345678');
    assert.equal(identity.email, null);
    assert.ok(identity.name);
    for (const [key, value] of Object.entries(expectedProfile)) assert.equal(identity[key], value);
    assert.equal(calls[1].url, 'https://discord.com/api/v10/users/@me');
    assert.equal(calls[1].options.headers.Authorization, 'Bearer token-sentinel');
  }
  assert.equal(calls[0].url, 'https://discord.com/api/oauth2/token');
  assert.equal(calls[0].options.body.get('redirect_uri'), 'http://localhost:3000/api/auth/discord/callback');
  assert.equal(calls[0].options.body.get('client_secret'), 'secret-sentinel');
  assert.equal(calls[0].options.body.get('code'), 'code-sentinel');
  assert.equal(calls[0].options.method, 'POST');
  assert.equal(calls[0].options.headers['Content-Type'], 'application/x-www-form-urlencoded');
  cases++;
}
const json = (data, status = 200) => new Response(JSON.stringify(data), { status });
const token = () => json({ access_token: 'token-sentinel', refresh_token: 'refresh-sentinel' });
try {
  assert.equal(providers().discord.scope, 'identify email');
  assert.equal(callbackURL('discord'), 'http://localhost:3000/api/auth/discord/callback');
  for (const fields of [{}, { email: null, global_name: null, avatar: null },
    { verified: true, email: undefined, username: 'Test' }]) {
    await run([token(), json({ id: '123456789012345678', ...fields })], undefined,
      { avatar: null, name: fields.username || 'Usuario de Discord' });
  }
  await run([token(), json({ id: '123456789012345678', global_name: 'Display', username: 'Username', avatar: 'a_abc123' })],
    undefined, { name: 'Display', avatar: 'https://cdn.discordapp.com/avatars/123456789012345678/a_abc123.gif' });
  await run([json({ error: 'invalid_client', error_description: 'secret-sentinel code-sentinel' }, 401)], 'TOKEN_EXCHANGE_HTTP_ERROR');
  await run([new Response('invalid', { status: 200 })], 'TOKEN_EXCHANGE_INVALID_JSON');
  await run([json({})], 'ACCESS_TOKEN_MISSING');
  await run([token(), json({ message: '401: Unauthorized token-sentinel' }, 401)], 'IDENTITY_TOKEN_REJECTED');
  await run([token(), json({ message: 'Forbidden' }, 403)], 'IDENTITY_HTTP_ERROR');
  await run([token(), json({ message: 'Rate limited' }, 429)], 'IDENTITY_HTTP_ERROR');
  await run([token(), new Response('<html>bad gateway</html>', { status: 502 })], 'IDENTITY_INVALID_JSON');
  await run([token(), json({ username: 'Private Name' })], 'MISSING_PROVIDER_USER_ID');
  await run([token(), json({ id: 123 })], 'IDENTITY_INVALID_ID');
  await run([token(), json(null)], 'IDENTITY_INVALID_PROFILE');
  await run([new Error('secret-sentinel')], 'TOKEN_EXCHANGE_NETWORK_ERROR');
  await run([token(), Object.assign(new Error('token-sentinel'), { name: 'TimeoutError' })], 'IDENTITY_TIMEOUT');
  const output = JSON.stringify(logs);
  for (const value of ['secret-sentinel', 'code-sentinel', 'token-sentinel', 'refresh-sentinel', 'Private Name']) {
    assert.ok(!output.includes(value), `Sensitive value leaked: ${value}`);
  }
  assert.ok(output.includes('TOKEN_EXCHANGE OK'));
  assert.ok(output.includes('TOKEN_EXCHANGE FAILED'));
  assert.ok(output.includes('MISSING_PROVIDER_USER_ID'));
} finally {
  globalThis.fetch = original.fetch;
  console.info = original.info;
  console.error = original.error;
}
console.info(`Discord diagnostics: ${cases} simulated scenarios passed; no live OAuth or database access.`);
