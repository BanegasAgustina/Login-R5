// Cookies host-only: JavaScript no puede leerlas; SameSite=Lax permite el callback
// GET de un proveedor externo y Secure exige HTTPS en producción.
export const cookieOptions = () => ({ httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/api' });
export const sessionCookie = 'petcare_oauth';

// No se necesita exponer cookies ni incorporar un parser global al login existente.
export function readCookie(req, name) {
  const value = req.headers.cookie?.split(';').map(s => s.trim()).find(s => s.startsWith(`${name}=`));
  try { return value ? decodeURIComponent(value.slice(name.length + 1)) : ''; } catch { return ''; }
}
