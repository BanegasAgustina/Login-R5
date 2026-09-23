/**
 * Asociación de identidad externa y usuario.
 *
 * profile normaliza email, recorta nombres y acepta avatar con prefijo HTTPS. resolveAccount
 * busca por provider + provider_user_id. Si no existe, comprueba conflicto de email y crea
 * usuario Cliente, perfil cliente y vínculo en una transacción.
 *
 * Motivo y límites: No vincula automáticamente por email. Las cuentas inactivas se rechazan;
 * una carrera de inserción se resuelve tras rollback consultando la identidad exacta. La cuenta
 * nueva tiene contraseña local NULL.
 *
 * Guía: docs/BRIEFING_AUTENTICACION_AUTORIZACION_VALIDACIONES.md
 */
// El pool conserva la misma base MySQL y consultas parametrizadas de PetCare.
import { pool } from '../config/database.js';
// Es la misma normalización usada por express-validator en el registro local.
// Evita que, por ejemplo, los puntos de Gmail creen un duplicado entre métodos.
import validator from 'validator';
import { requireUserTypeId } from '../repositories/roleRepository.js';
import { USER_TYPES } from '../auth/userTypes.js';

// Nombre/email son atributos de perfil, nunca claves para vincular automáticamente.
// Un email ausente queda NULL, sin inventar direcciones que podrían pertenecer a otro.
function profile(identity) {
  const rawEmail = typeof identity.email === 'string' ? identity.email.trim().toLowerCase() : null;
  if (rawEmail && (rawEmail.length > 120 || !validator.isEmail(rawEmail))) throw new Error('OAUTH_PROFILE');
  const email = rawEmail ? validator.normalizeEmail(rawEmail) : null;
  return {
    name: String(identity.name || 'Usuario').slice(0, 60),
    surname: String(identity.surname || '').slice(0, 60),
    email: email || null,
    rawEmail,
    avatar: typeof identity.avatar === 'string' && identity.avatar.startsWith('https://') ? identity.avatar.slice(0, 2048) : null,
  };
}

// Buscamos SIEMPRE por proveedor + ID externo. La transacción evita usuarios
// huérfanos si falla la creación del cliente o la identidad externa.
export async function resolveAccount(provider, identity, database = pool, diagnostic) {
  diagnostic?.step('PROFILE_VALIDATION', 'normalize_profile');
  const data = profile(identity);
  diagnostic?.ok({ email_is_null: data.email === null });
  diagnostic?.step('DATABASE', 'account_connection');
  const connection = await database.getConnection();
  try {
    // Usuario, perfil Cliente y vínculo externo se confirman juntos.
    // Un fallo antes del commit revierte las escrituras con rollback.
    await connection.beginTransaction();
    diagnostic?.step('DATABASE', 'account_lookup');
    const [existing] = await connection.query(
      `SELECT u.*, r.nombre AS rol FROM oauth_accounts o
       JOIN usuarios u ON u.id = o.user_id JOIN roles r ON r.id = u.rol_id
       WHERE o.provider = ? AND o.provider_user_id = ?`, [provider, identity.id]);
    diagnostic?.ok({ existing_account: Boolean(existing[0]) });
    if (existing[0]) {
      if (existing[0].estado_id !== 1) throw new Error('OAUTH_INACTIVE');
      diagnostic?.step('DATABASE', 'commit_existing_account');
      await connection.commit();
      diagnostic?.ok();
      return existing[0];
    }
    if (data.email) {
      diagnostic?.step('DATABASE', 'email_conflict_check');
      const [sameEmail] = await connection.query('SELECT id FROM usuarios WHERE LOWER(TRIM(email)) IN (?, ?) LIMIT 1', [data.email, data.rawEmail]);
      // Incluso un email verificado NO basta para vincular cuentas de forma implícita.
      // Conservamos la cuenta original y pedimos entrar con su método habitual.
      // Una futura vinculación deberá exigir prueba de control de ambas cuentas.
      if (sameEmail.length) throw new Error('OAUTH_EMAIL_CONFLICT');
    }
    diagnostic?.step('DATABASE', 'client_role_lookup');
    const clientTypeId = await requireUserTypeId(USER_TYPES.CLIENT, connection);
    diagnostic?.step('DATABASE', 'create_user');
    const [created] = await connection.query(
      'INSERT INTO usuarios(nombre, apellido, email, password_hash, rol_id) VALUES (?, ?, ?, NULL, ?)',
      [data.name, data.surname, data.email, clientTypeId]);
    diagnostic?.ok({ email_is_null: data.email === null });
    diagnostic?.step('DATABASE', 'create_client');
    await connection.query('INSERT INTO clientes(usuario_id) VALUES (?)', [created.insertId]);
    diagnostic?.ok();
    diagnostic?.step('DATABASE', 'create_oauth_account');
    await connection.query(
      'INSERT INTO oauth_accounts(user_id, provider, provider_user_id, avatar_url) VALUES (?, ?, ?, ?)',
      [created.insertId, provider, identity.id, data.avatar]);
    diagnostic?.ok();
    diagnostic?.step('DATABASE', 'load_created_user');
    const [users] = await connection.query(
      'SELECT u.*, r.nombre AS rol FROM usuarios u JOIN roles r ON r.id = u.rol_id WHERE u.id = ?', [created.insertId]);
    diagnostic?.step('DATABASE', 'commit_account');
    await connection.commit();
    diagnostic?.ok();
    return users[0];
  } catch (error) {
    diagnostic?.fail(error);
    await connection.rollback();
    // Dos callbacks concurrentes pueden competir. UNIQUE decide en la BD; después
    // del rollback recuperamos solamente la identidad exacta, nunca por email.
    if (error.code === 'ER_DUP_ENTRY') {
      diagnostic?.step('DATABASE', 'recover_concurrent_account');
      const [rows] = await connection.query(
        `SELECT u.*, r.nombre AS rol FROM oauth_accounts o JOIN usuarios u ON u.id=o.user_id
         JOIN roles r ON r.id=u.rol_id WHERE o.provider=? AND o.provider_user_id=?`, [provider, identity.id]);
      if (rows[0]?.estado_id === 1) return rows[0];
      throw new Error(rows[0] ? 'OAUTH_INACTIVE' : 'OAUTH_EMAIL_CONFLICT');
    }
    throw error;
  } finally {
    connection.release();
  }
}
