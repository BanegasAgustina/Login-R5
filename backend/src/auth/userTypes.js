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
