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
