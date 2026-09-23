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

export function logOAuthError(provider, stage, error) {
  const code = [error?.code, error?.cause?.code, error?.message].find(value => safeCodes.has(value)) || 'OAUTH_FAILED';
  console.error('[OAuth]', provider, { stage, code });
}

// Nunca registramos respuestas: pueden contener tokens o datos privados.
// Conservamos timeout, rechazo de redirects y validación de la respuesta de Meta.
export async function facebookJson(url, options) {
  const response = await fetch(url, { ...options, redirect: 'error', signal: AbortSignal.timeout(10000) });
  let data;
  try { data = await response.json(); }
  catch { throw new Error('OAUTH_PROVIDER'); }
  if (!response.ok || data?.error || !data || typeof data !== 'object') throw new Error('OAUTH_PROVIDER');
  return data;
}
