/**
 * Comprobación de identidad y permisos.
 *
 * authMiddleware prioriza Bearer sobre cookie, verifica firma y vencimiento, exige un id entero
 * positivo y consulta la cuenta activa. Para escrituras con cookie exige Origin exacto.
 * allowRoles permite solo los tipos indicados.
 *
 * Motivo y límites: Consultar la cuenta en cada solicitud hace efectivos cambios de rol o
 * desactivaciones. El catch actual responde 401 también ante errores de consulta: ese resultado
 * no distingue una caída de DB de una sesión inválida.
 *
 * Guía: docs/BRIEFING_AUTENTICACION_AUTORIZACION_VALIDACIONES.md
 */
// jsonwebtoken permite verificar la firma y vigencia de cada JWT recibido.
import jwt from 'jsonwebtoken';
// OAuth usa una cookie HttpOnly; el login tradicional conserva Authorization.
import { readCookie, sessionCookie } from '../utils/oauthCookies.js';
import { frontendOrigin } from '../config/oauth.js';
import { userRepository } from '../repositories/userRepository.js';
import { hasUserType } from '../auth/userTypes.js';

// Protege una ruta: agrega el usuario autenticado a req.user antes de continuar.
export async function authMiddleware(req, res, next) {
  // El formato esperado es: Authorization: Bearer <token>.
  // Bearer tiene prioridad si también existe cookie. Por eso el frontend
  // quita un token anterior al volver de OAuth.
  const bearer = req.headers.authorization?.split(' ')[1];
  const token = bearer || readCookie(req, sessionCookie);

  if (!token) {
    return res.status(401).json({ message: 'Sesión requerida.' });
  }

  try {
    // Las cookies viajan automáticamente: en escrituras exigimos Origin exacto
    // para evitar CSRF. Un Bearer explícito mantiene el contrato de la API local.
    if (!bearer && !['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.headers.origin !== frontendOrigin()) {
      return res.status(403).json({ message: 'Origen no permitido.' });
    }
    // jwt.verify devuelve el payload creado al iniciar sesión.
    const identity = jwt.verify(token, process.env.JWT_SECRET);
    if (!Number.isInteger(identity.id) || identity.id <= 0) throw new Error('INVALID_IDENTITY');
    // Bearer y OAuth consultan SIEMPRE la cuenta y su tipo vigente en la BD.
    req.user = await userRepository.findSessionById(identity.id);
    if (!req.user || req.user.estado_id !== 1) {
      return res.status(401).json({ message: 'Sesión inválida o cuenta inactiva.' });
    }
    return next();
  // También llegan aquí errores de MySQL: este 401 no diferencia por sí solo
  // una caída de la base de una sesión vencida.
  } catch {
    return res.status(401).json({ message: 'Sesión inválida o vencida.' });
  }
}

// Devuelve un middleware que permite pasar solo a los roles indicados.
export const allowRoles = (...roles) => (req, res, next) => {
  if (roles.some(type => hasUserType(req.user, type))) return next();
  return res.status(403).json({ message: 'No tenés permiso para esta acción.' });
};
