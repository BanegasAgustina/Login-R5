// Expresiones regulares y reglas de validación reutilizables en PetCare

// Nombre de persona: letras con acentos en español, espacios, apóstrofes y guiones. Sin números ni símbolos raros.
export const NAME_REGEX = /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s'-]+$/;

// Nombre de mascota: letras con acentos, números razonables permitidos en mascotas, espacios, guiones.
export const PET_NAME_REGEX = /^[a-zA-Z0-9áéíóúÁÉÍÓÚñÑüÜ\s'-]+$/;

// Email con estructura completa y dominio válido (TLD >= 2 caracteres)
export const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

// Teléfono: solo dígitos numéricos (formato Argentina habitual 10 a 13 dígitos)
export const PHONE_REGEX = /^\d{10,13}$/;

// Contraseñas comunes a rechazar
export const WEAK_PASSWORDS = new Set([
  '12345678',
  '123456789',
  'password',
  'qwerty',
  '123456',
  'petcare2026',
  'admin1234',
]);

/**
 * Valida un nombre o apellido de persona.
 * Devuelve un mensaje de error si es inválido, o null si es correcto.
 */
export function validatePersonName(val?: string, fieldName = 'El nombre'): string | null {
  if (!val || !val.trim()) return `${fieldName} es obligatorio.`;
  const clean = val.trim();
  if (clean.length < 2) return `${fieldName} debe tener al menos 2 caracteres.`;
  if (clean.length > 60) return `${fieldName} no puede exceder los 60 caracteres.`;
  if (/\d/.test(clean)) return `${fieldName} no puede contener números.`;
  if (!NAME_REGEX.test(clean)) return `${fieldName} solo puede contener letras y espacios.`;
  return null;
}

/**
 * Valida el nombre de una mascota.
 */
export function validatePetName(val?: string): string | null {
  if (!val || !val.trim()) return 'El nombre de la mascota es obligatorio.';
  const clean = val.trim();
  if (clean.length < 2) return 'El nombre debe tener al menos 2 caracteres.';
  if (clean.length > 80) return 'El nombre no puede exceder los 80 caracteres.';
  if (!PET_NAME_REGEX.test(clean)) return 'El nombre de la mascota no puede contener símbolos extraños.';
  return null;
}

/**
 * Valida el formato y dominio de un email.
 */
export function validateEmail(val?: string): string | null {
  if (!val || !val.trim()) return 'El email es obligatorio.';
  const clean = val.trim();
  if (/\s/.test(clean)) return 'El email no puede contener espacios.';
  if (!clean.includes('@')) return 'El email debe contener un "@".';
  if (!EMAIL_REGEX.test(clean)) return 'Ingresá un email válido con un dominio completo (ej: usuario@gmail.com).';
  return null;
}

/**
 * Valida un teléfono (solo números, 10 a 13 dígitos).
 */
export function validatePhone(val?: string, isRequired = false): string | null {
  if (!val || !val.trim()) {
    return isRequired ? 'El teléfono es obligatorio.' : null;
  }
  const clean = val.trim();
  if (!/^\d+$/.test(clean)) return 'El teléfono solo puede contener números (sin letras ni símbolos).';
  if (!PHONE_REGEX.test(clean)) {
    return 'El teléfono debe tener entre 10 y 13 dígitos numéricos (ej: 2231234567).';
  }
  return null;
}

export type PasswordStrength = {
  score: number; // 0 a 3
  label: 'Débil' | 'Media' | 'Fuerte';
  color: string;
  percent: number;
  checks: {
    length: boolean;
    upper: boolean;
    lower: boolean;
    digit: boolean;
    special: boolean;
    notCommon: boolean;
  };
};

/**
 * Calcula la fuerza de una contraseña y retorna métricas accesibles.
 */
export function getPasswordStrength(password: string): PasswordStrength {
  const p = password || '';
  const checks = {
    length: p.length >= 8,
    upper: /[A-Z]/.test(p),
    lower: /[a-z]/.test(p),
    digit: /\d/.test(p),
    special: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(p),
    notCommon: !WEAK_PASSWORDS.has(p.toLowerCase()),
  };

  let passed = 0;
  if (checks.length) passed++;
  if (checks.upper) passed++;
  if (checks.lower) passed++;
  if (checks.digit) passed++;
  if (checks.special) passed++;

  if (!checks.length || !checks.notCommon || passed <= 2) {
    return {
      score: 1,
      label: 'Débil',
      color: '#c85454',
      percent: p.length === 0 ? 0 : 33,
      checks,
    };
  }

  if (passed >= 3 && passed < 5) {
    return {
      score: 2,
      label: 'Media',
      color: '#e69500',
      percent: 66,
      checks,
    };
  }

  return {
    score: 3,
    label: 'Fuerte',
    color: '#187e64',
    percent: 100,
    checks,
  };
}

/**
 * Valida que una contraseña cumpla con los requisitos mínimos de seguridad.
 */
export function validatePassword(val?: string): string | null {
  if (!val) return 'La contraseña es obligatoria.';
  if (val.length < 8) return 'La contraseña debe tener al menos 8 caracteres.';
  if (WEAK_PASSWORDS.has(val.toLowerCase())) {
    return 'La contraseña ingresada es demasiado predecible. Elegí una combinación más segura.';
  }
  const hasUpper = /[A-Z]/.test(val);
  const hasLower = /[a-z]/.test(val);
  const hasDigit = /\d/.test(val);
  const hasSpecial = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(val);

  if (!hasUpper || !hasLower || !hasDigit || !hasSpecial) {
    return 'Debe incluir al menos una mayúscula, una minúscula, un número y un carácter especial.';
  }
  return null;
}

const ALLOWED_IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp'];
const ALLOWED_IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.webp'];
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5 MB

/**
 * Valida un archivo de imagen en frontend antes de enviar.
 */
export function validateImageFile(file: File): string | null {
  if (!file) return 'No se seleccionó ningún archivo.';
  if (file.size === 0) return 'El archivo de imagen está vacío.';
  if (file.size > MAX_IMAGE_SIZE) {
    return 'La imagen supera el tamaño máximo permitido de 5 MB.';
  }

  const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
  if (!ALLOWED_IMAGE_EXTS.includes(ext) || !ALLOWED_IMAGE_MIMES.includes(file.type)) {
    return 'Formato no permitido. Solo se aceptan imágenes JPG, PNG y WEBP.';
  }

  return null;
}
