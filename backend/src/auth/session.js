/**
 * Emisión de JWT.
 *
 * createSessionToken firma id y rol con JWT_SECRET; JWT_EXPIRES_IN define la duración y el
 * valor por defecto es 8h.
 *
 * Motivo y límites: Centraliza el formato para login local y OAuth. El rol incluido en el token
 * no es la fuente de autorización: el middleware recupera el estado y rol actuales de MySQL.
 *
 * Guía: docs/BRIEFING_AUTENTICACION_AUTORIZACION_VALIDACIONES.md
 */
import jwt from 'jsonwebtoken';

// Solo recibe una cuenta recuperada por el backend; nunca req.body ni claims externos.
// Firebase Auth podrá sustituir la verificación de identidad antes de este punto.
// El rol se conserva en el JWT por compatibilidad; authMiddleware NO lo autoriza.
export const createSessionToken = user => jwt.sign(
  { id: user.id, rol: user.rol },
  process.env.JWT_SECRET,
  { expiresIn: process.env.JWT_EXPIRES_IN || '8h' },
);
