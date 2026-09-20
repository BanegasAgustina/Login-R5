/**
 * Cabeceras HTTP.
 *
 * securityHeaders establece nosniff, DENY, política de Referer y deshabilita el filtro
 * X-XSS-Protection antiguo. En producción agrega HSTS.
 *
 * Motivo y límites: Estas cabeceras controlan comportamientos del navegador; no sustituyen
 * validar entradas, autenticar o comprobar permisos.
 *
 * Guía: docs/BRIEFING_AUTENTICACION_AUTORIZACION_VALIDACIONES.md
 */
// Headers básicos de seguridad sin agregar dependencias extra.
export function securityHeaders(_req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-XSS-Protection', '0');
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
}
