import jwt from 'jsonwebtoken';

// Solo recibe una cuenta recuperada por el backend; nunca req.body ni claims externos.
// Firebase Auth podrá sustituir la verificación de identidad antes de este punto.
// El rol se conserva en el JWT por compatibilidad; authMiddleware NO lo autoriza.
export const createSessionToken = user => jwt.sign(
  { id: user.id, rol: user.rol },
  process.env.JWT_SECRET,
  { expiresIn: process.env.JWT_EXPIRES_IN || '8h' },
);
