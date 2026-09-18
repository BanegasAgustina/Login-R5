// jose valida firma, emisor, audiencia y vencimiento de ID tokens OIDC de Google.
// crypto produce appsecret_proof de Meta; el catálogo fija los servidores confiables.
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { createHmac } from 'node:crypto';
import { providers, callbackURL } from '../config/oauth.js';

const googleKeys = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));

// Nunca registramos respuestas completas: pueden contener tokens o datos privados.
// Los timeouts y redirect:error evitan esperas indefinidas y reenvío de secretos.
async function json(url, options = {}) {
  const response = await fetch(url, { ...options, redirect: 'error', signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error('OAUTH_PROVIDER');
  const data = await response.json();
  if (data.error) throw new Error('OAUTH_PROVIDER');
  return data;
}

// Canjeamos el Authorization Code una sola vez. El access token autoriza la lectura
// del perfil; NO es la sesión de PetCare y se descarta después de obtener identidad.
export async function externalIdentity(provider, code, flow) {
  const p = providers()[provider];
  const clientId = process.env[`${p.env}_CLIENT_ID`];
  const secret = process.env[`${p.env}_CLIENT_SECRET`];
  const body = new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: callbackURL(provider), client_id: clientId });
  const headers = { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' };
  if (p.basic) headers.Authorization = `Basic ${Buffer.from(`${clientId}:${secret}`).toString('base64')}`;
  else body.set('client_secret', secret);
  if (p.pkce) body.set('code_verifier', flow.verifier);
  const tokens = await json(p.token, { method: 'POST', headers, body });
  if (typeof tokens.access_token !== 'string' || !tokens.access_token) throw new Error('OAUTH_PROVIDER');
  const auth = { Authorization: `Bearer ${tokens.access_token}`, Accept: 'application/json', 'User-Agent': 'PetCare-OAuth' };
  let identity;
  if (provider === 'google') {
    // OIDC agrega autenticación a OAuth: verificamos el ID token, incluido el nonce
    // que liga esta respuesta al intento iniciado por este navegador.
    const { payload } = await jwtVerify(tokens.id_token, googleKeys, {
      issuer: ['https://accounts.google.com', 'accounts.google.com'], audience: clientId, algorithms: ['RS256'],
      requiredClaims: ['sub', 'exp', 'iat', 'nonce'],
    });
    if (payload.nonce !== flow.nonce || (payload.azp && payload.azp !== clientId)) throw new Error('OAUTH_PROVIDER');
    identity = { id: payload.sub, name: payload.given_name || payload.name, surname: payload.family_name, email: payload.email, avatar: payload.picture };
  } else if (provider === 'github') {
    const user = await json('https://api.github.com/user', { headers: auth });
    const emails = await json('https://api.github.com/user/emails', { headers: auth });
    identity = { id: String(user.id || ''), name: user.name || user.login, email: emails.find(e => e.primary && e.verified)?.email, avatar: user.avatar_url };
  } else if (provider === 'discord') {
    const user = await json('https://discord.com/api/v10/users/@me', { headers: auth });
    identity = { id: user.id, name: user.global_name || user.username, email: user.verified ? user.email : null,
      avatar: user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` : null };
  } else if (provider === 'twitch') {
    const result = await json('https://api.twitch.tv/helix/users', { headers: { ...auth, 'Client-Id': clientId } });
    const user = result.data?.[0];
    if (!user) throw new Error('OAUTH_PROVIDER');
    identity = { id: user.id, name: user.display_name, email: user.email, avatar: user.profile_image_url };
  } else if (provider === 'facebook') {
    const url = new URL(`https://graph.facebook.com/${process.env.FACEBOOK_GRAPH_VERSION}/me`);
    url.searchParams.set('fields', 'id,first_name,last_name,email,picture');
    url.searchParams.set('appsecret_proof', createHmac('sha256', secret).update(tokens.access_token).digest('hex'));
    const user = await json(url, { headers: auth });
    identity = { id: user.id, name: user.first_name, surname: user.last_name, email: user.email, avatar: user.picture?.data?.url };
  } else if (provider === 'twitter') {
    // No suponemos acceso al email de X: el ID de /users/me es suficiente.
    const result = await json('https://api.x.com/2/users/me?user.fields=profile_image_url', { headers: auth });
    identity = { id: result.data?.id, name: result.data?.name, avatar: result.data?.profile_image_url };
  }
  // Solo aceptamos identidades completas del endpoint del proveedor seleccionado.
  if (!identity || typeof identity.id !== 'string' || !/^[\x21-\x7e]{1,255}$/.test(identity.id)) throw new Error('OAUTH_PROVIDER');
  return identity;
}
