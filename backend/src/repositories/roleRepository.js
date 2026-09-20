/**
 * Catálogo de roles.
 *
 * listRoles consulta roles; getUserTypes arma el mapa por nombre; requireUserTypeId exige un
 * rol configurado; roleExists verifica un id recibido.
 *
 * Motivo y límites: La base conserva la autoridad sobre el catálogo. El registro necesita
 * resolver Cliente y la administración valida que el rol elegido exista.
 *
 * Guía: docs/BRIEFING_AUTENTICACION_AUTORIZACION_VALIDACIONES.md
 */
import { pool } from '../config/database.js';
import { USER_TYPE_NAMES } from '../auth/userTypes.js';

export async function listRoles(database = pool) {
  const [rows] = await database.query('SELECT id, nombre FROM roles ORDER BY id');
  return rows;
}

export async function getUserTypes(database = pool) {
  const roles = await listRoles(database);
  return Object.fromEntries(Object.entries(USER_TYPE_NAMES).flatMap(([key, name]) => {
    const role = roles.find(row => row.nombre === name);
    return role ? [[key, Number(role.id)]] : [];
  }));
}

export async function requireUserTypeId(type, database = pool) {
  const types = await getUserTypes(database);
  if (!types[type]) throw new Error('USER_TYPE_NOT_CONFIGURED');
  return types[type];
}

export async function roleExists(id, database = pool) {
  const [rows] = await database.query('SELECT id FROM roles WHERE id = ?', [id]);
  return rows.length > 0;
}
