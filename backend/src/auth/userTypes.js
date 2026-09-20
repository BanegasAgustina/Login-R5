/**
 * Política de roles del servidor.
 *
 * USER_TYPES define admin, veterinarian y client; USER_TYPE_NAMES los vincula con los nombres
 * del catálogo. hasUserType compara tipo_usuario con el id positivo incluido en userTypes.
 *
 * Motivo y límites: Evita asumir que Administrador, Veterinario y Cliente tienen ids fijos. La
 * política usa claves estables y el repositorio resuelve sus ids reales.
 *
 * Guía: docs/BRIEFING_AUTENTICACION_AUTORIZACION_VALIDACIONES.md
 */
// Claves de política, no IDs de usuarios ni IDs de la base de datos.
export const USER_TYPES = Object.freeze({ ADMIN: 'admin', VET: 'veterinarian', CLIENT: 'client' });

// Compatibilidad con el catálogo existente. Los IDs se resuelven en MySQL.
export const USER_TYPE_NAMES = Object.freeze({
  [USER_TYPES.ADMIN]: 'Administrador',
  [USER_TYPES.VET]: 'Veterinario',
  [USER_TYPES.CLIENT]: 'Cliente',
});

export function hasUserType(user, type) {
  const expected = user?.userTypes?.[type];
  return Number.isInteger(expected) && expected > 0 && user.tipo_usuario === expected;
}
