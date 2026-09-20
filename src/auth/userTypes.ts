/**
 * Roles en la interfaz.
 *
 * USER_TYPES y UserType describen claves de política. hasUserType y hasAnyUserType comparan
 * tipo_usuario con el mapa userTypes recibido.
 *
 * Motivo y límites: No se hardcodean ids de MySQL. Estas funciones deciden presentación y
 * navegación; la API debe volver a comprobar el permiso.
 *
 * Guía: docs/BRIEFING_AUTENTICACION_AUTORIZACION_VALIDACIONES.md
 */
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
