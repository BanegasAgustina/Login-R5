/**
 * Catálogo y configuración OAuth.
 *
 * providers define Google, GitHub, Facebook, Discord, Twitch y X, sus endpoints, scopes y
 * variantes PKCE/Basic. origin valida orígenes; frontendOrigin, backendOrigin y callbackURL
 * construyen destinos. configured y environmentStatus informan presencia de variables.
 *
 * Motivo y límites: Los destinos salen de configuración del servidor. configured indica que hay
 * valores requeridos, no que el proveedor los haya aceptado ni que MySQL funcione.
 *
 * Guía: docs/BRIEFING_AUTENTICACION_AUTORIZACION_VALIDACIONES.md
 */
// Catálogo cerrado: el navegador nunca elige endpoints, secretos o redirect URLs.
// Client ID identifica la aplicación; Client Secret solo se usa entre servidores.
export function providers() {
  const version = process.env.FACEBOOK_GRAPH_VERSION;
  return {
    google: { name: 'Google', env: 'GOOGLE', pkce: true, scope: 'openid email profile',
      authorize: 'https://accounts.google.com/o/oauth2/v2/auth', token: 'https://oauth2.googleapis.com/token' },
    github: { name: 'GitHub', env: 'GITHUB', pkce: true, scope: 'read:user user:email',
      authorize: 'https://github.com/login/oauth/authorize', token: 'https://github.com/login/oauth/access_token' },
    // Meta rechaza email si no está habilitado; el login básico no necesita ese permiso.
    facebook: { name: 'Facebook', env: 'FACEBOOK', scope: 'public_profile',
      extraReady: /^v\d+\.\d+$/.test(version || ''),
      authorize: `https://www.facebook.com/${version}/dialog/oauth`, token: `https://graph.facebook.com/${version}/oauth/access_token` },
    discord: { name: 'Discord', env: 'DISCORD', scope: 'identify email',
      authorize: 'https://discord.com/oauth2/authorize', token: 'https://discord.com/api/oauth2/token' },
    twitch: { name: 'Twitch', env: 'TWITCH', scope: 'user:read:email',
      authorize: 'https://id.twitch.tv/oauth2/authorize', token: 'https://id.twitch.tv/oauth2/token' },
    twitter: { name: 'X', env: 'TWITTER', pkce: true, scope: 'tweet.read users.read', basic: true,
      authorize: 'https://x.com/i/oauth2/authorize', token: 'https://api.x.com/2/oauth2/token' },
  };
}

// Validamos orígenes absolutos. HTTP solo se permite para desarrollo en loopback.
// Rechazar paths/query evita callbacks ambiguos y redirecciones abiertas.
export function origin(value) {
  const url = new URL(value);
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/' ||
      (url.protocol !== 'https:' && !(url.protocol === 'http:' && local && process.env.NODE_ENV !== 'production'))) {
    throw new Error('OAUTH_CONFIG');
  }
  return url.origin;
}

// CLIENT_URL ya existía: lo conservamos como origen del frontend y regla CORS.
export const frontendOrigin = () => origin(process.env.CLIENT_URL || 'http://localhost:5173');
export const backendOrigin = () => origin(process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 3000}`);
export const callbackURL = provider => `${backendOrigin()}/api/auth/${provider}/callback`;

export function environmentStatus() {
  const names = ['GOOGLE', 'GITHUB', 'FACEBOOK', 'DISCORD', 'TWITTER', 'TWITCH'];
  return Object.fromEntries([
    ...names.flatMap(name => [
      [`${name}_CLIENT_ID`, Boolean(process.env[`${name}_CLIENT_ID`])],
      [`${name}_CLIENT_SECRET`, Boolean(process.env[`${name}_CLIENT_SECRET`])],
    ]),
    ['FACEBOOK_GRAPH_VERSION', Boolean(process.env.FACEBOOK_GRAPH_VERSION)],
    ['JWT_SECRET', Boolean(process.env.JWT_SECRET)],
    ['CLIENT_URL', Boolean(process.env.CLIENT_URL)],
    ['BACKEND_URL', Boolean(process.env.BACKEND_URL)],
  ]);
}

// Un botón habilitado solo indica configuración presente, no credenciales verificadas.
export function configured(provider) {
  const p = providers()[provider];
  if (!p || p.extraReady === false) return false;
  try { frontendOrigin(); backendOrigin(); } catch { return false; }
  const status = {
    clientId: Boolean(process.env[`${p.env}_CLIENT_ID`]),
    clientSecret: Boolean(process.env[`${p.env}_CLIENT_SECRET`]),
    jwt: Boolean(process.env.JWT_SECRET),
  };
  console.info('[OAuth configured]', provider, status);
  return status.clientId && status.clientSecret && status.jwt;
}
