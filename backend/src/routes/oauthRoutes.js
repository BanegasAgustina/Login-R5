/**
 * Inicio y callback OAuth.
 *
 * GET /providers publica disponibilidad. GET /:provider crea el intento, guarda cookie temporal
 * y redirige. El callback consume state, valida code, obtiene identidad, resuelve cuenta y
 * emite cookie con JWT de PetCare. fail limita los códigos de error y redirige al login.
 *
 * Motivo y límites: El orden une navegador, proveedor y sesión local. Cache-Control y
 * Referrer-Policy evitan conservar o reenviar datos del callback. El token externo no se
 * devuelve al frontend.
 *
 * Guía: docs/BRIEFING_AUTENTICACION_AUTORIZACION_VALIDACIONES.md
 */
// Express agrupa rutas; JWT mantiene el formato de sesión existente de PetCare.
import { Router } from 'express';
import { createSessionToken } from '../auth/session.js';
// Estos módulos separan configuración, protección CSRF, identidad y persistencia.
import { providers, configured, callbackURL, frontendOrigin, backendOrigin, environmentStatus } from '../config/oauth.js';
import { createFlow, consumeFlow, challenge } from '../services/oauthFlows.js';
import { externalIdentity } from '../services/oauthIdentity.js';
import { resolveAccount } from '../services/oauthAccounts.js';
import { cookieOptions, readCookie, sessionCookie } from '../utils/oauthCookies.js';
import { loginRateLimit } from '../middleware/rateLimit.js';
import { facebookDiagnostics } from '../utils/facebookDiagnostics.js';

const router = Router();
console.info('[OAuth environment]', environmentStatus());
// Nada del callback (código, state, datos privados) debe almacenarse en caché ni
// enviarse como Referer al navegar hacia el frontend.
router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); res.set('Referrer-Policy', 'no-referrer'); next(); });

// Publicamos únicamente nombres, disponibilidad y rutas públicas; nunca secretos.
router.get('/providers', (_req, res) => {
  const result = Object.entries(providers()).map(([id, p]) => ({
    id, name: p.name, enabled: configured(id),
    url: configured(id) ? `${backendOrigin()}/api/auth/${id}` : null,
  }));
  console.info('[OAuth providers]', result.map(({ id, enabled }) => ({ id, enabled })));
  res.json(result);
});

// Regresamos a una ruta fija configurada por el servidor; no aceptamos returnTo.
// Solo los códigos de error de esta lista llegan al usuario; no enviamos excepciones.
function fail(res, error) {
  const allowed = ['OAUTH_STATE', 'OAUTH_EMAIL_CONFLICT', 'OAUTH_INACTIVE', 'OAUTH_CANCELLED', 'OAUTH_NOT_CONFIGURED'];
  const code = allowed.includes(error.message) ? error.message : 'OAUTH_FAILED';
  return res.redirect(303, `${frontendOrigin()}/login?oauth_error=${code}`);
}

// GET /api/auth/:provider inicia Authorization Code. scopes limitan el acceso;
// PKCE S256 envía un hash del verifier, cuyo original queda solo en el backend.
router.get('/:provider', loginRateLimit, async (req, res) => {
  const provider = req.params.provider;
  const diagnostic = provider === 'facebook' ? facebookDiagnostics() : undefined;
  if (!Object.hasOwn(providers(), provider)) return res.status(404).json({ message: 'Proveedor desconocido.' });
  let stage = 'configuration';
  try {
    if (!configured(provider)) throw new Error('OAUTH_NOT_CONFIGURED');
    const p = providers()[provider];
    stage = 'flow';
    const flow = await createFlow(provider, p.pkce, undefined, diagnostic);
    diagnostic?.step('COOKIE', 'set_flow_cookie');
    res.cookie(`oauth_flow_${provider}`, flow.browser, { ...cookieOptions(), maxAge: 600000 });
    diagnostic?.ok({ ...cookieOptions(), domain: 'host-only', maxAge: 600000 });
    diagnostic?.step('REDIRECT', 'authorization');
    stage = 'redirect';
    const url = new URL(p.authorize);
    url.search = new URLSearchParams({ response_type: 'code', client_id: process.env[`${p.env}_CLIENT_ID`],
      redirect_uri: callbackURL(provider), scope: p.scope, state: flow.state }).toString();
    if (p.pkce) { url.searchParams.set('code_challenge', challenge(flow.verifier)); url.searchParams.set('code_challenge_method', 'S256'); }
    if (flow.nonce) url.searchParams.set('nonce', flow.nonce);
    diagnostic?.ok({ redirect_uri: callbackURL(provider), scope: p.scope });
    if (provider === 'discord') console.info('[OAuth Discord] AUTHORIZATION', {
      redirect_uri: url.searchParams.get('redirect_uri'), scope: url.searchParams.get('scope'),
    });
    return res.redirect(url.href);
  } catch (error) {
    if (diagnostic) diagnostic.fail(error);
    else console.error('[OAuth]', provider, 'FAILED', { code: error?.code || error?.message || 'UNKNOWN', stage });
    return fail(res, error);
  }
});

// GET /api/auth/:provider/callback verifica state ANTES de intercambiar el código.
// Primera visita crea usuario/cliente; visitas posteriores reutilizan identidad.
router.get('/:provider/callback', async (req, res) => {
  const provider = req.params.provider;
  const diagnostic = provider === 'facebook' ? facebookDiagnostics() : undefined;
  if (!Object.hasOwn(providers(), provider)) return res.status(404).json({ message: 'Proveedor desconocido.' });
  const browser = readCookie(req, `oauth_flow_${provider}`);
  diagnostic?.log('start callback', {
    code_received: typeof req.query.code === 'string' && Boolean(req.query.code),
    state_received: typeof req.query.state === 'string' && Boolean(req.query.state),
    browser_cookie_received: Boolean(browser), provider_error_received: Boolean(req.query.error),
  });
  res.clearCookie(`oauth_flow_${provider}`, cookieOptions());
  let stage = 'configuration';
  try {
    if (!configured(provider)) throw new Error('OAUTH_NOT_CONFIGURED');
    stage = 'state';
    const flow = await consumeFlow(provider, req.query.state, browser, undefined, diagnostic);
    diagnostic?.step('AUTHORIZATION_RESPONSE', 'validate_code');
    if (req.query.error) throw new Error('OAUTH_CANCELLED');
    if (typeof req.query.code !== 'string' || !req.query.code || req.query.code.length > 4096) throw new Error('OAUTH_STATE');
    stage = 'identity';
    diagnostic?.ok();
    const identity = await externalIdentity(provider, req.query.code, flow, diagnostic);
    stage = 'user_lookup';
    const user = await resolveAccount(provider, identity, undefined, diagnostic);
    diagnostic?.log('database account resolved', { status: 'OK' });
    // La cookie contiene nuestro JWT, no el token del proveedor. Nunca lo ponemos
    // en URL/localStorage. El middleware verifica además que la cuenta siga activa.
    stage = 'session';
    diagnostic?.step('SESSION', 'create_jwt');
    const token = createSessionToken(user);
    diagnostic?.ok();
    diagnostic?.step('SESSION', 'set_session_cookie');
    res.cookie(sessionCookie, token, cookieOptions());
    diagnostic?.ok({ ...cookieOptions(), domain: 'host-only' });
    stage = 'redirect';
    diagnostic?.step('REDIRECT', 'frontend_success');
    diagnostic?.ok();
    return res.redirect(303, `${frontendOrigin()}/login?oauth=success`);
  } catch (error) {
    if (diagnostic) diagnostic.fail(error);
    else console.error('[OAuth]', provider, 'FAILED', { code: error?.code || error?.message || 'UNKNOWN', stage });
    return fail(res, error);
  }
});

export default router;
