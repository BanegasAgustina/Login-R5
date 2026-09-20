/**
 * Mantenimiento de contraseñas demo.
 *
 * Recibe dos contraseñas por argumentos, exige longitud mínima 8, calcula bcrypt con coste 10 y
 * actualiza las cuentas demo por email.
 *
 * Motivo y límites: Cambia credenciales reales de esas cuentas. Su regla y coste difieren del
 * registro normal; se documenta pero no se ejecuta. bcrypt genera hashes, no cifrado
 * reversible.
 *
 * Guía: docs/BRIEFING_AUTENTICACION_AUTORIZACION_VALIDACIONES.md
 */
//sirve para actualizar las contraseñas de 
// las cuentas de demostración de PetCare. Recibe 
// las nuevas contraseñas desde la línea de comandos, 
// verifica que ambas existan y tengan al menos 8 caracteres, 
// y luego las encripta utilizando bcrypt antes de guardarlas 
// en la base de datos. Después busca las cuentas de administrador 
// y veterinaria por su email y reemplaza sus contraseñas actuales 
// por las nuevas. Finalmente, muestra en consola si se actualizaron 
// correctamente y  cierra la conexión con la base de datos.

import bcrypt from 'bcryptjs';
import { pool } from '../src/config/database.js';

const accounts = [
  ['admin@petcare.local', process.argv[2]],
  ['veterinaria@petcare.local', process.argv[3]],
];

if (accounts.some(([, password]) => !password || password.length < 8)) {
  console.error('Uso: node scripts/update-demo-passwords.js <password-admin> <password-veterinaria>');
  process.exitCode = 1;
} else {
  try {
    for (const [email, password] of accounts) {
      const passwordHash = await bcrypt.hash(password, 10);
      const [result] = await pool.query(
        'UPDATE usuarios SET password_hash = ? WHERE email = ?',
        [passwordHash, email],
      );

      if (result.affectedRows !== 1) throw new Error(`No se encontro la cuenta ${email}.`);
      console.log(`Password updated: ${email}`);
    }
  } finally {
    await pool.end();
  }
}
