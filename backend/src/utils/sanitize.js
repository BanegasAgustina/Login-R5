/**
 * Respuesta pública del usuario.
 *
 * publicUser construye una lista explícita de campos: identidad, rol, estado, teléfono, fechas
 * y resúmenes de mascotas; adapta nombres de columnas al contrato del frontend.
 *
 * Motivo y límites: Al construir el objeto explícitamente evita enviar password_hash u otras
 * columnas nuevas por accidente. No modifica la fila de MySQL ni valida la entrada.
 *
 * Guía: docs/BRIEFING_AUTENTICACION_AUTORIZACION_VALIDACIONES.md
 */
// Quita campos sensibles antes de enviar usuarios al frontend.
export const publicUser = (user) => ({
  id: user.id,
  nombre: user.nombre,
  apellido: user.apellido,
  email: user.email,
  rol: user.rol,
  rolId: user.rol_id,
  tipo_usuario: Number(user.rol_id),
  ...(user.userTypes ? { userTypes: user.userTypes } : {}),
  telefono: user.telefono ?? null,
  mascotas: user.mascotas_str ? user.mascotas_str.split(', ') : (Array.isArray(user.mascotas) ? user.mascotas : []),
  totalMascotas: Number(user.total_mascotas || (user.mascotas_str ? user.mascotas_str.split(', ').length : 0)),
  estado: user.estado ?? user.estado_nombre ?? 'Activo',
  estadoId: user.estado_id,
  fechaCreacion: user.fecha_creacion ?? user.created_at ?? null,
});
