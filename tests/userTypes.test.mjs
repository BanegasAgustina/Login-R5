import test from 'node:test';
import assert from 'node:assert/strict';
import { hasUserType, hasAnyUserType, USER_TYPES } from '../src/auth/userTypes.ts';

test('navegación usa tipo y catálogo de sesión, nunca etiquetas ni IDs fijos', () => {
  const user = { tipo_usuario: 81, rol: 'Administrador', userTypes: { admin: 19, veterinarian: 50, client: 81 } };
  assert.equal(hasUserType(user, USER_TYPES.ADMIN), false);
  assert.equal(hasUserType(user, USER_TYPES.CLIENT), true);
  assert.equal(hasAnyUserType(user, [USER_TYPES.CLIENT, USER_TYPES.VET]), true);
  assert.equal(hasUserType({ rol: 'Administrador', rolId: 1 }, USER_TYPES.ADMIN), false);
  assert.equal(hasUserType(null, USER_TYPES.ADMIN), false);
  assert.equal(hasUserType({ tipo_usuario: 81 }, USER_TYPES.CLIENT), false);
  assert.equal(hasUserType({ tipo_usuario: undefined, userTypes: {} }, USER_TYPES.ADMIN), false);
});
