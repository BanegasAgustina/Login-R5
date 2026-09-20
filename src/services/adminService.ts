/**
 * Transporte de operaciones administrativas.
 *
 * Obtiene roles, resumen, usuarios, mascotas y turnos; edita usuario, cambia estado y elimina.
 * updateUsuario traduce rolId de frontend a rol_id de API.
 *
 * Motivo y límites: Centraliza el contrato y filtros. No decide si el usuario está autorizado
 * ni valida por sí mismo el contenido.
 *
 * Guía: docs/BRIEFING_AUTENTICACION_AUTORIZACION_VALIDACIONES.md
 */
// Servicio para interactuar con los endpoints 
// del backend relacionados con la administración de usuarios, mascotas y turnos.
import api from './api';
import type { AdminAppointment, AdminAppointmentDetail, AdminPet, AdminUser, DashboardStats } from '../types';

export type Role = { id: number; nombre: string };

export const adminService = {
  getRoles: async () => {
    const { data } = await api.get<Role[]>('/admin/roles');
    return data;
  },
  getResumen: async () => {
    const { data } = await api.get<DashboardStats>('/admin/resumen');
    return data;
  },
// Obtiene la lista de usuarios administrados, con filtros opcionales para búsqueda, rol, estado y orden.
  getUsuarios: async (filters?: { q?: string; rol?: string; estado?: string; mascotas?: string; sort?: 'nombre_asc' | 'nombre_desc' | 'recientes' | 'antiguos' }) => {
    const { data } = await api.get<AdminUser[]>('/admin/usuarios', { params: filters });
    return data;
  },
// Obtiene los detalles de un usuario específico por su ID.
  getUsuario: async (id: number) => {
    const { data } = await api.get<AdminUser>(`/admin/usuarios/${id}`);
    return data;
  },
// Actualiza la información de un usuario específico, enviando solo los campos modificados.
  updateUsuario: async (
    id: number,
    payload: Partial<Pick<AdminUser, 'nombre' | 'apellido' | 'email' | 'rolId'>>
  ) => {
    const { data } = await api.put(`/admin/usuarios/${id}`, {
      nombre: payload.nombre,
      apellido: payload.apellido,
      email: payload.email,
      rol_id: payload.rolId,
    });
    return data as { message: string };
  },
// Cambia el estado de un usuario específico (activo/inactivo) mediante su ID y el nuevo estado.
  setUsuarioEstado: async (id: number, estado_id: number) => {
    const { data } = await api.patch(`/admin/usuarios/${id}/estado`, { estado_id });
    return data as { message: string };
  },
// Elimina un usuario específico por su ID, devolviendo un mensaje de confirmación.
  deleteUsuario: async (id: number) => {
    const { data } = await api.delete(`/admin/usuarios/${id}`);
    return data as { message: string };
  },
// Obtiene la lista de mascotas administradas, con filtros opcionales para búsqueda, especie, estado y orden.
  getMascotas: async (filters?: { q?: string; especie?: string; activo?: '0' | '1' | ''; sort?: 'nombre_asc' | 'nombre_desc' | 'recientes' | 'antiguos' | 'edad_desc' | 'edad_asc' }) => {
    const { data } = await api.get<AdminPet[]>('/admin/mascotas', { params: filters });
    return data;
  },
// Obtiene los detalles de un turno específico por su ID, incluyendo información del propietario y la mascota.
  getTurnos: async (filters?: { estado?: string; fecha?: string; veterinario?: string }) => {
    const { data } = await api.get<AdminAppointment[]>('/admin/turnos', { params: filters });
    return data;
  },
// Obtiene los detalles completos de un turno específico por su ID, incluyendo información de la mascota y el propietario.
  getTurnoDetail: async (id: number) => {
    const { data } = await api.get<AdminAppointmentDetail>(`/admin/turnos/${id}`);
    return data;
  },
};
