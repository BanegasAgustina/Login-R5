import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { register, login, me, updateMe, logout } from '../controllers/authController.js';
import { authMiddleware } from '../middleware/auth.js';
import { loginRateLimit } from '../middleware/rateLimit.js';
//este archivo controla las rutas de autenticación y se asegura de que los datos ingresados 
// por el usuario sean válidos y seguros antes de procesarlos.
const router = Router();

const validate = (req, res, next) => {
  const errors = validationResult(req);
  return errors.isEmpty() ? next() : res.status(400).json({ message: errors.array()[0].msg });
};
// Expresiones regulares para validar nombres y correos electrónicos
const NAME_REGEX = /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s'-]+$/;
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const WEAK_PASSWORDS = ['12345678', '123456789', 'password', 'qwerty', '123456', 'petcare2026', 'admin1234'];

const registerValidation = [
  body('nombre')
    .trim()
    .notEmpty()
    .withMessage('El nombre es obligatorio.')
    .isLength({ min: 2, max: 60 })
    .withMessage('El nombre debe tener al menos 2 caracteres.')
    .custom((value) => {
      if (/\d/.test(value)) throw new Error('El nombre no puede contener números.');
      if (!NAME_REGEX.test(value)) throw new Error('El nombre solo puede contener letras y espacios.');
      return true;
    }),
  body('apellido')
    .trim()
    .notEmpty()
    .withMessage('El apellido es obligatorio.')
    .isLength({ min: 2, max: 60 })
    .withMessage('El apellido debe tener al menos 2 caracteres.')
    .custom((value) => {
      if (/\d/.test(value)) throw new Error('El apellido no puede contener números.');
      if (!NAME_REGEX.test(value)) throw new Error('El apellido solo puede contener letras y espacios.');
      return true;
    }),
  body('email')
    .trim()
    .notEmpty()
    .withMessage('El email es obligatorio.')
    .isEmail()
    .withMessage('Ingresá un email con formato válido.')
    .normalizeEmail()
    .custom((value) => {
      if (!EMAIL_REGEX.test(value)) throw new Error('Ingresá un email válido con dominio completo.');
      return true;
    }),
  body('telefono')
    .optional({ checkFalsy: true })
    .trim()
    .custom((value) => {
      if (!value) return true;
      if (!/^\d+$/.test(value)) throw new Error('El teléfono solo puede contener números.');
      if (!/^\d{10,13}$/.test(value)) throw new Error('El teléfono debe tener entre 10 y 13 dígitos numéricos.');
      return true;
    }),
  body('password')
    .notEmpty()
    .withMessage('La contraseña es obligatoria.')
    .isLength({ min: 8 })
    .withMessage('La contraseña debe tener al menos 8 caracteres.')
    .custom((value) => {
      if (WEAK_PASSWORDS.includes(value.toLowerCase())) {
        throw new Error('La contraseña elegida es demasiado común y vulnerable.');
      }
      const hasUpper = /[A-Z]/.test(value);
      const hasLower = /[a-z]/.test(value);
      const hasDigit = /\d/.test(value);
      const hasSpecial = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(value);
      if (!hasUpper || !hasLower || !hasDigit || !hasSpecial) {
        throw new Error('La contraseña debe incluir al menos una mayúscula, una minúscula, un número y un carácter especial.');
      }
      return true;
    }),
  body('confirmPassword')
    .optional()
    .custom((value, { req }) => {
      if (value && value !== req.body.password) {
        throw new Error('Las contraseñas no coinciden.');
      }
      return true;
    }),
  validate,
];

const updateProfileValidation = [
  body('nombre')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('El nombre no puede estar vacío.')
    .custom((value) => {
      if (/\d/.test(value)) throw new Error('El nombre no puede contener números.');
      if (!NAME_REGEX.test(value)) throw new Error('El nombre solo puede contener letras y espacios.');
      return true;
    }),
  body('apellido')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('El apellido no puede estar vacío.')
    .custom((value) => {
      if (/\d/.test(value)) throw new Error('El apellido no puede contener números.');
      if (!NAME_REGEX.test(value)) throw new Error('El apellido solo puede contener letras y espacios.');
      return true;
    }),
  body('telefono')
    .optional({ checkFalsy: true })
    .trim()
    .custom((value) => {
      if (!value) return true;
      if (!/^\d+$/.test(value)) throw new Error('El teléfono solo puede contener números.');
      if (!/^\d{10,13}$/.test(value)) throw new Error('El teléfono debe tener entre 10 y 13 dígitos numéricos.');
      return true;
    }),
  validate,
];

router.post('/register', registerValidation, register);
router.post(
  '/login',
  loginRateLimit,
  [
    body('email').isEmail().withMessage('Ingresá un email válido.').normalizeEmail(),
    body('password').notEmpty().withMessage('Ingresá tu contraseña.'),
    validate,
  ],
  login,
);
router.get('/me', authMiddleware, me);
router.put('/me', authMiddleware, updateProfileValidation, updateMe);
// Borrar una cookie debe funcionar incluso si venció el JWT o se desactivó la cuenta.
// logout verifica Origin para cookies y no devuelve datos protegidos.
router.post('/logout', logout);

export default router;
