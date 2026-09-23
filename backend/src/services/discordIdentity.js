// Diagnóstico exclusivo de Discord. Nunca registrar cuerpos, headers o excepciones crudas.
export const DISCORD_IDENTITY_URL = 'https://discord.com/api/v10/users/@me';

export async function discordIdentity(tokenURL, options) {
  const sensitive = [options.body.get('code'), options.body.get('client_secret')].filter(Boolean);
  const safe = value => {
    if (typeof value !== 'string' && typeof value !== 'number') return null;
    let text = String(value);
    for (const secret of sensitive) {
      for (const variant of [secret, encodeURIComponent(secret)]) text = text.split(variant).join('[REDACTED]');
    }
    return text.replace(/(Bearer|Bot)\s+\S+/gi, '$1 [REDACTED]')
      .replace(/[A-Za-z0-9_.-]{24,}/g, '[REDACTED]')
      .replace(/[\r\n\x00-\x1f\x7f]/g, ' ').slice(0, 400);
  };
  function fail(stage, reason, status, data) {
    if (stage === 'TOKEN_EXCHANGE') console.error('[OAuth Discord] TOKEN_EXCHANGE FAILED', {
      http_status: status, error: safe(data?.error) || reason, error_description: safe(data?.error_description),
    });
    console.error('[OAuth Discord] FAILED_STAGE', {
      stage, reason, http_status: status, message: safe(data?.message) || reason,
    });
    const error = new Error('OAUTH_PROVIDER');
    error.code = reason;
    throw error;
  }
  async function request(url, init, stage) {
    console.info(`[OAuth Discord] ${stage} START`);
    let response;
    try {
      response = await fetch(url, { ...init, redirect: 'error', signal: AbortSignal.timeout(10000) });
    } catch (error) {
      fail(stage, `${stage === 'IDENTITY_REQUEST' ? 'IDENTITY' : stage}_${['TimeoutError', 'AbortError'].includes(error?.name) ? 'TIMEOUT' : 'NETWORK_ERROR'}`, null);
    }
    if (stage === 'IDENTITY_REQUEST') console.info('[OAuth Discord] IDENTITY_REQUEST', {
      status: response.status, ok: response.ok,
    });
    let data;
    const prefix = stage === 'IDENTITY_REQUEST' ? 'IDENTITY' : stage;
    try { data = await response.json(); }
    catch { fail(stage, `${prefix}_INVALID_JSON`, response.status); }
    for (const key of ['access_token', 'refresh_token', 'client_secret', 'code']) {
      if (typeof data?.[key] === 'string' && data[key]) sensitive.push(data[key]);
    }
    if (!response.ok || data?.error) {
      fail(stage, stage === 'IDENTITY_REQUEST' && response.status === 401
        ? 'IDENTITY_TOKEN_REJECTED' : `${prefix}_HTTP_ERROR`, response.status, data);
    }
    if (!data || typeof data !== 'object' || Array.isArray(data)) fail(stage, `${prefix}_INVALID_PROFILE`, response.status);
    return { data, status: response.status };
  }

  const { data: tokens, status: tokenStatus } = await request(tokenURL, options, 'TOKEN_EXCHANGE');
  if (typeof tokens.access_token !== 'string' || !tokens.access_token.trim()) {
    fail('TOKEN_EXCHANGE', 'ACCESS_TOKEN_MISSING', tokenStatus);
  }
  console.info('[OAuth Discord] TOKEN_EXCHANGE OK', { http_status: tokenStatus });
  const { data: profile, status } = await request(DISCORD_IDENTITY_URL, {
    headers: { Authorization: `Bearer ${tokens.access_token}`, Accept: 'application/json', 'User-Agent': 'PetCare-OAuth' },
  }, 'IDENTITY_REQUEST');
  console.info('[OAuth Discord] PROFILE_FIELDS', Object.fromEntries(
    ['id', 'username', 'global_name', 'avatar', 'email', 'verified'].map(key => [key, {
      present: profile[key] !== undefined && profile[key] !== null, type: typeof profile[key],
    }]),
  ));
  if (profile.id === undefined || profile.id === null || profile.id === '') {
    fail('IDENTITY', 'MISSING_PROVIDER_USER_ID', status);
  }
  if (typeof profile.id !== 'string' || !/^[0-9]{1,20}$/.test(profile.id)) {
    fail('IDENTITY', 'IDENTITY_INVALID_ID', status);
  }
  const name = [profile.global_name, profile.username].find(value => typeof value === 'string' && value.trim());
  const avatar = typeof profile.avatar === 'string' && /^(a_)?[a-f0-9]+$/.test(profile.avatar)
    ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.${profile.avatar.startsWith('a_') ? 'gif' : 'png'}` : null;
  console.info('[OAuth Discord] IDENTITY OK');
  return { id: profile.id, name: name?.trim() || 'Usuario de Discord',
    email: profile.verified === true && typeof profile.email === 'string' ? profile.email : null, avatar };
}
