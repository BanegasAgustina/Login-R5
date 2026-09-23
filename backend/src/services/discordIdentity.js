// Identidad de Discord. Nunca registrar cuerpos, headers o excepciones crudas.
export const DISCORD_IDENTITY_URL = 'https://discord.com/api/v10/users/@me';

export async function discordIdentity(tokenURL, options) {
  function fail(stage, reason, status) {
    console.error('[OAuth Discord]', { stage, reason, http_status: status });
    const error = new Error('OAUTH_PROVIDER');
    error.code = reason;
    throw error;
  }
  async function request(url, init, stage) {
    let response;
    try {
      response = await fetch(url, { ...init, redirect: 'error', signal: AbortSignal.timeout(10000) });
    } catch (error) {
      fail(stage, `${stage === 'IDENTITY_REQUEST' ? 'IDENTITY' : stage}_${['TimeoutError', 'AbortError'].includes(error?.name) ? 'TIMEOUT' : 'NETWORK_ERROR'}`, null);
    }
    let data;
    const prefix = stage === 'IDENTITY_REQUEST' ? 'IDENTITY' : stage;
    try { data = await response.json(); }
    catch { fail(stage, `${prefix}_INVALID_JSON`, response.status); }
    if (!response.ok || data?.error) {
      fail(stage, stage === 'IDENTITY_REQUEST' && response.status === 401
        ? 'IDENTITY_TOKEN_REJECTED' : `${prefix}_HTTP_ERROR`, response.status);
    }
    if (!data || typeof data !== 'object' || Array.isArray(data)) fail(stage, `${prefix}_INVALID_PROFILE`, response.status);
    return { data, status: response.status };
  }

  const { data: tokens, status: tokenStatus } = await request(tokenURL, options, 'TOKEN_EXCHANGE');
  if (typeof tokens.access_token !== 'string' || !tokens.access_token.trim()) {
    fail('TOKEN_EXCHANGE', 'ACCESS_TOKEN_MISSING', tokenStatus);
  }
  const { data: profile, status } = await request(DISCORD_IDENTITY_URL, {
    headers: { Authorization: `Bearer ${tokens.access_token}`, Accept: 'application/json', 'User-Agent': 'PetCare-OAuth' },
  }, 'IDENTITY_REQUEST');
  if (profile.id === undefined || profile.id === null || profile.id === '') {
    fail('IDENTITY', 'MISSING_PROVIDER_USER_ID', status);
  }
  if (typeof profile.id !== 'string' || !/^[0-9]{1,20}$/.test(profile.id)) {
    fail('IDENTITY', 'IDENTITY_INVALID_ID', status);
  }
  const name = [profile.global_name, profile.username].find(value => typeof value === 'string' && value.trim());
  const avatar = typeof profile.avatar === 'string' && /^(a_)?[a-f0-9]+$/.test(profile.avatar)
    ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.${profile.avatar.startsWith('a_') ? 'gif' : 'png'}` : null;
  return { id: profile.id, name: name?.trim() || 'Usuario de Discord',
    email: profile.verified === true && typeof profile.email === 'string' ? profile.email : null, avatar };
}
