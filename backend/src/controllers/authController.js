// bcrypt compara y crea hashes seguros de contraseñas.
//contiene las funciones principales de autenticación de PetCare. 
// Permite registrar nuevos usuarios, iniciar y cerrar sesión, consultar
//  los datos del usuario autenticado y actualizar su perfil. Utiliza 
// bcrypt para proteger las contraseñas mediante hashes, JWT para generar
//  tokens de sesión y MySQL para guardar y consultar la información de 
// los usuarios. También verifica que el email no esté registrado, 
// valida las credenciales al iniciar sesión y controla que los usuarios 
// tengan una cuenta activa. Finalmente, publicUser se utiliza para devolver 
// únicamente los datos del usuario que pueden ser expuestos al
//  frontend, evitando enviar información sensible como la contraseña.
import bcrypt from 'bcryptjs';
import { createSessionToken } from '../auth/session.js';
import { userRepository } from '../repositories/userRepository.js';
import { publicUser } from '../utils/sanitize.js';
import { clearLoginAttempts } from '../middleware/rateLimit.js';
// Limpiar la cookie evita conservar otra identidad OAuth tras un login local.
import { cookieOptions, sessionCookie, readCookie } from '../utils/oauthCookies.js';
// El origen permitido protege también el cierre de una sesión cookie vencida.
import { frontendOrigin } from '../config/oauth.js';

const BCRYPT_ROUNDS = 12;
const EMAIL_ALREADY_REGISTERED = {
  code: 'EMAIL_ALREADY_REGISTERED',
  message: 'Este email ya tiene una cuenta en PetCare. Iniciá sesión con tu cuenta.',
};

// POST /api/auth/register: crea un usuario con el rol Cliente y su perfil cliente.
export async function register(req, res, next) {
  try {
    const { nombre, apellido, password, telefono, direccion } = req.body;
    const email = req.body.email.trim().toLowerCase();

    if (await userRepository.emailExists(email)) {
      return res.status(409).json(EMAIL_ALREADY_REGISTERED);
    }

    const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    await userRepository.createClient({ nombre, apellido, email, hash, telefono, direccion });

    return res.status(201).json({ message: 'Cuenta creada correctamente.' });
  } catch (error) {
    if (error.emailAlreadyRegistered) {
      return res.status(409).json(EMAIL_ALREADY_REGISTERED);
    }
    return next(error);
  }
}

// POST /api/auth/login: valida credenciales y entrega el token de sesión.
export async function login(req, res, next) {
  try {
    const user = await userRepository.findActiveByEmail(req.body.email);

    // Un usuario OAuth no tiene contraseña local: NULL debe producir 401, no error.
    if (!user || !user.password_hash || !(await bcrypt.compare(req.body.password, user.password_hash))) {
      return res.status(401).json({ message: 'El email o la contraseña son incorrectos.' });
    }

    clearLoginAttempts(req);

    const token = createSessionToken(user);

    res.clearCookie(sessionCookie, cookieOptions());
    return res.json({ token, usuario: publicUser(user) });
  } catch (error) {
    return next(error);
  }
}

// GET /api/auth/me: recupera el usuario actual a partir del JWT.
export async function me(req, res, next) {
  try {
    const user = await userRepository.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado.' });
    return res.json(publicUser(user));
  } catch (error) {
    return next(error);
  }
}

// PUT /api/auth/me: actualiza datos personales del usuario autenticado.
export async function updateMe(req, res, next) {
  try {
    await userRepository.updateProfile(req.user.id, req.body);
    const user = await userRepository.findById(req.user.id);
    return res.json({
      message: 'Perfil actualizado correctamente.',
      usuario: publicUser(user),
    });
  } catch (error) {
    return next(error);
  }
}

// El JWT Bearer se elimina en el cliente; la cookie HttpOnly solo la borra el servidor.
export const logout = (req, res) => {
  if (readCookie(req, sessionCookie) && req.headers.origin !== frontendOrigin()) {
    return res.status(403).json({ message: 'Origen no permitido.' });
  }
  res.clearCookie(sessionCookie, cookieOptions());
  return res.status(204).end();
};
