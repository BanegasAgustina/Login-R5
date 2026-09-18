import type { User } from '../types';

// Claves de la política de la API. Ningún ID de rol se define en el navegador.
export const USER_TYPES = { ADMIN: 'admin', VET: 'veterinarian', CLIENT: 'client' } as const;
export type UserType = typeof USER_TYPES[keyof typeof USER_TYPES];

export function hasUserType(user: User | null | undefined, type: UserType): boolean {
  const expected = user?.userTypes?.[type];
  return typeof expected === 'number' && Number.isInteger(expected) && expected > 0 && user?.tipo_usuario === expected;
}

export const hasAnyUserType = (user: User | null | undefined, types: UserType[]) =>
  types.some(type => hasUserType(user, type));
