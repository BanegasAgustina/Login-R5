/**
 * Persistencia de usuarios.
 *
 * createUserRepository permite inyectar una conexión o pool. withTypes agrega tipo_usuario y
 * userTypes. findSessionById, findById y findActiveByEmail tienen proyecciones distintas.
 * emailExists, createClient y updateProfile gestionan datos con parámetros SQL.
 *
 * Motivo y límites: Los placeholders separan datos de SQL. createClient hace dos INSERT
 * consecutivos sin transacción explícita; no se debe atribuirle la atomicidad de
 * resolveAccount. updateProfile solo toma nombre, apellido y teléfono.
 *
 * Guía: docs/BRIEFING_AUTENTICACION_AUTORIZACION_VALIDACIONES.md
 */
import { pool } from '../config/database.js';
import { getUserTypes, requireUserTypeId } from './roleRepository.js';
import { USER_TYPES } from '../auth/userTypes.js';

// Sustituir este repositorio en una futura migración; conserva el esquema MySQL.
export function createUserRepository(database = pool) {
  const withTypes = async user => user ? {
    ...user, tipo_usuario: Number(user.rol_id), userTypes: await getUserTypes(database),
  } : undefined;
  return {
    async findSessionById(id) {
      const [rows] = await database.query(
        `SELECT u.id, u.estado_id, u.rol_id, r.nombre AS rol
         FROM usuarios u JOIN roles r ON r.id = u.rol_id WHERE u.id = ?`, [id]);
      return withTypes(rows[0]);
    },
    async findById(id) {
      const [rows] = await database.query(
        `SELECT u.*, roles.nombre AS rol, c.telefono
         FROM usuarios u JOIN roles ON roles.id = u.rol_id
         LEFT JOIN clientes c ON c.usuario_id = u.id WHERE u.id = ?`, [id]);
      return withTypes(rows[0]);
    },
    async findActiveByEmail(email) {
      const [rows] = await database.query(
        `SELECT u.*, r.nombre AS rol FROM usuarios u JOIN roles r ON r.id = u.rol_id
         WHERE u.email = ? AND u.estado_id = 1`, [email]);
      return withTypes(rows[0]);
    },
    async emailExists(email) {
      const [rows] = await database.query('SELECT id FROM usuarios WHERE LOWER(TRIM(email)) = ? LIMIT 1', [email]);
      return rows.length > 0;
    },
    // El servidor resuelve Cliente: el formulario no puede elegir Administrador.
    // Los dos INSERT siguientes no tienen una transacción explícita.
    async createClient({ nombre, apellido, email, hash, telefono, direccion }) {
      const roleId = await requireUserTypeId(USER_TYPES.CLIENT, database);
      const [result] = await database.query(
        'INSERT INTO usuarios(nombre, apellido, email, password_hash, rol_id) VALUES (?, ?, ?, ?, ?)',
        [nombre, apellido, email, hash, roleId]).catch(error => {
          if (error.code === 'ER_DUP_ENTRY') error.emailAlreadyRegistered = true;
          throw error;
        });
      await database.query('INSERT INTO clientes(usuario_id, telefono, direccion) VALUES (?, ?, ?)',
        [result.insertId, telefono || null, direccion || null]);
      return result.insertId;
    },
    // La desestructuración limita los campos editables. Las columnas del SQL
    // se definen aquí y los valores del usuario se pasan como parámetros.
    async updateProfile(id, { nombre, apellido, telefono }) {
      const fields = [];
      const params = [];
      if (nombre !== undefined) { fields.push('nombre = ?'); params.push(nombre.trim()); }
      if (apellido !== undefined) { fields.push('apellido = ?'); params.push(apellido.trim()); }
      if (fields.length) await database.query(`UPDATE usuarios SET ${fields.join(', ')} WHERE id = ?`, [...params, id]);
      if (telefono !== undefined) {
        const phone = telefono ? telefono.trim() : null;
        const [rows] = await database.query('SELECT id FROM clientes WHERE usuario_id = ?', [id]);
        if (rows.length) await database.query('UPDATE clientes SET telefono = ? WHERE usuario_id = ?', [phone, id]);
        else await database.query('INSERT INTO clientes (usuario_id, telefono) VALUES (?, ?)', [id, phone]);
      }
    },
  };
}

export const userRepository = createUserRepository();
