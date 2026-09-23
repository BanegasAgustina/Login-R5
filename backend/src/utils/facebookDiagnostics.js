import { randomUUID } from 'node:crypto';

// Diagnóstico temporal exclusivo de Facebook. En desarrollo está activo; se puede
// apagar con FACEBOOK_OAUTH_DEBUG=false o activar en producción con true.
// Nunca serializamos errores/respuestas: pueden incluir SQL, cookies o credenciales.
const safeCodes = new Set([
  'OAUTH_STATE', 'OAUTH_PROVIDER', 'OAUTH_PROFILE', 'OAUTH_INACTIVE',
  'OAUTH_EMAIL_CONFLICT', 'OAUTH_CANCELLED', 'OAUTH_NOT_CONFIGURED',
  'USER_TYPE_NOT_CONFIGURED', 'ER_NO_SUCH_TABLE', 'ER_BAD_FIELD_ERROR',
  'ER_BAD_NULL_ERROR', 'ER_NO_DEFAULT_FOR_FIELD', 'ER_DUP_ENTRY',
  'ER_NO_REFERENCED_ROW_2', 'ER_ROW_IS_REFERENCED_2', 'ER_DATA_TOO_LONG',
  'ER_ACCESS_DENIED_ERROR', 'ER_BAD_DB_ERROR', 'ER_CHECK_CONSTRAINT_VIOLATED',
  'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'EACCES',
  'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_HEADERS_TIMEOUT', 'CERT_HAS_EXPIRED',
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
]);
const safeTypes = new Set(['Error', 'TypeError', 'SyntaxError', 'TimeoutError', 'AbortError']);
const databaseMessages = {
  ER_NO_SUCH_TABLE: 'Falta una tabla requerida.',
  ER_BAD_FIELD_ERROR: 'Falta una columna requerida.',
  ER_BAD_NULL_ERROR: 'Una columna rechaza NULL.',
  ER_NO_DEFAULT_FOR_FIELD: 'Falta un valor obligatorio sin valor predeterminado.',
  ER_DUP_ENTRY: 'Conflicto con una clave única.',
  ER_NO_REFERENCED_ROW_2: 'No existe la fila referenciada por una clave foránea.',
  ER_DATA_TOO_LONG: 'Un valor excede el tamaño permitido por la columna.',
  ER_CHECK_CONSTRAINT_VIOLATED: 'Una restricción CHECK rechazó la fila.',
};

export function facebookDiagnostics() {
  const enabled = process.env.FACEBOOK_OAUTH_DEBUG === 'true' ||
    (process.env.NODE_ENV !== 'production' && process.env.FACEBOOK_OAUTH_DEBUG !== 'false');
  const attempt = randomUUID(); // Correlación local del request, nunca state ni ID del usuario.
  let stage = 'CONFIGURATION', operation = 'configuration', details = {};
  const log = (event, data = {}) => {
    if (enabled) console.info(`[OAuth Facebook] ${event}`, { attempt, ...data });
  };
  return {
    log,
    step(nextStage, nextOperation) {
      stage = nextStage; operation = nextOperation; details = {};
      log('stage', { stage, operation, status: 'START' });
    },
    ok(data = {}) { log('stage', { stage, operation, status: 'OK', ...data }); },
    details(data) { details = { ...details, ...data }; },
    reject(reason, message = 'OAUTH_STATE') {
      details.reason = reason;
      throw new Error(message);
    },
    fail(error) {
      if (!enabled) return;
      const code = [error?.code, error?.cause?.code, error?.message].find(value => safeCodes.has(value)) || 'UNCLASSIFIED';
      const sessionMessage = stage === 'SESSION' && /expiresIn/.test(error?.message || '')
        ? 'Revisar el formato de JWT_EXPIRES_IN.' : undefined;
      console.error('[OAuth Facebook] FAILED_STAGE:', {
        attempt, stage, operation, code,
        type: safeTypes.has(error?.name) ? error.name : 'Error',
        ...(databaseMessages[code] ? { message: databaseMessages[code] } : {}),
        ...(sessionMessage ? { message: sessionMessage } : {}),
        ...(Number.isInteger(error?.errno) ? { mysql_errno: error.errno } : {}),
        ...details,
      });
    },
  };
}

// Solo traducimos categorías conocidas del mensaje de Meta. Nunca copiamos texto
// libre del proveedor: incluso un error puede repetir el code o el access token.
function providerMessage(error) {
  const message = typeof error?.message === 'string' ? error.message : '';
  if (/redirect_uri|redirect uri/i.test(message)) return 'Meta rechazó o detectó una diferencia en redirect_uri.';
  if (/client secret|client_secret|app secret/i.test(message)) return 'Meta rechazó el secreto de la aplicación.';
  if (/already.*used|already.*redeemed/i.test(message)) return 'Meta indica que el código ya fue utilizado.';
  if (/expired|expiration/i.test(message)) return 'Meta indica que el código o token venció.';
  if (/verification code|authorization code/i.test(message)) return 'Meta rechazó el código de autorización.';
  if (/appsecret_proof/i.test(message)) return 'Meta rechazó appsecret_proof.';
  if (/access token/i.test(message)) return 'Meta rechazó el access token.';
  if (/permission|scope/i.test(message)) return 'Meta rechazó un permiso solicitado.';
  return 'Meta rechazó la solicitud; consultar status y códigos del proveedor.';
}

export async function facebookJson(url, options, diagnostic) {
  const response = await fetch(url, { ...options, redirect: 'error', signal: AbortSignal.timeout(10000) });
  diagnostic?.details({ http_status: response.status });
  let data;
  try { data = await response.json(); }
  catch { diagnostic?.details({ reason: 'INVALID_JSON' }); throw new Error('OAUTH_PROVIDER'); }
  if (!response.ok || data?.error) {
    const error = data?.error;
    diagnostic?.details({
      provider_type: ['OAuthException', 'GraphMethodException', 'FacebookApiException'].includes(error?.type) ? error.type : 'UNKNOWN',
      ...(Number.isInteger(error?.code) ? { provider_code: error.code } : {}),
      ...(Number.isInteger(error?.error_subcode) ? { provider_subcode: error.error_subcode } : {}),
      message: providerMessage(error),
    });
    throw new Error('OAUTH_PROVIDER');
  }
  if (!data || typeof data !== 'object') throw new Error('OAUTH_PROVIDER');
  return data;
}
