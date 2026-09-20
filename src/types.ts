/**
 * Contratos TypeScript.
 *
 * User define id, email nullable, rolId, tipo_usuario y mapa userTypes. También contiene Pet,
 * Appointment, Consulta y tipos administrativos usados por formularios y servicios.
 *
 * Motivo y límites: Los tipos ayudan durante compilación; no validan JSON de la red ni conceden
 * permisos.
 *
 * Guía: docs/BRIEFING_AUTENTICACION_AUTORIZACION_VALIDACIONES.md
 */
// src/types.ts
// Define los tipos de datos utilizados en la aplicación, incluyendo usuarios, mascotas, turnos y consultas.
export type User = {
  id: number;
  nombre: string;
  apellido: string;
  // Algunos proveedores no entregan email; no inventamos uno para el usuario.
  email: string | null;
  rol: string;
  rolId: number;
  tipo_usuario: number;
  userTypes?: Partial<Record<'admin' | 'veterinarian' | 'client', number>>;
  telefono?: string | null;
  estado?: string;
  estadoId?: number;
  fechaCreacion?: string;
};
// Define la estructura de una mascota, incluyendo información opcional sobre el propietario y el estado de la mascota.
export type Pet = {
  id: number;
  nombre: string;
  especie: string;
  especie_id?: number;
  raza?: string;
  sexo: string;
  peso?: number;
  foto_url?: string | null;
  fecha_nacimiento?: string;
  propietario?: string;
  email_propietario?: string;
  estado?: string;
  activo?: boolean | number;
};
// Define la estructura de un turno o cita, incluyendo información opcional sobre el propietario y el estado del turno.
export type Appointment = {
  id: number;
  mascota: string;
  veterinario: string;
  cliente?: string;
  fecha: string;
  hora: string;
  motivo: string;
  estado: string;
};
// Define la estructura de una consulta médica, incluyendo información opcional sobre el diagnóstico y tratamiento.
export type Consulta = {
  id: number;
  mascota: string;
  veterinario?: string;
  fecha?: string;
  hora?: string;
  fecha_consulta?: string;
  diagnostico?: string;
  tratamiento?: string;
  estado?: string;
};
// Define la estructura de las estadísticas del dashboard, incluyendo métricas clave sobre mascotas, turnos, consultas y usuarios.
export type DashboardStats = {
  mascotas?: number;
  turnosPendientes?: number;
  consultas?: number;
  pacientes?: number;
  usuarios?: number;
  veterinarios?: number;
};
// Define la estructura de un usuario administrado, incluyendo información opcional sobre las mascotas asociadas y el total de mascotas.
export type AdminUser = User & {
  mascotas?: string[];
  totalMascotas?: number;
};

export type AdminPet = Pet & { propietario: string };

export type AdminAppointment = Appointment & { propietario: string };
// Define la estructura de los detalles de un turno administrado, incluyendo información opcional sobre la especie, raza, propietario y observaciones.
export type AdminAppointmentDetail = AdminAppointment & {
  especie?: string;
  raza?: string;
  email_propietario?: string;
  telefono_propietario?: string;
  matricula?: string;
  observaciones?: string;
};
