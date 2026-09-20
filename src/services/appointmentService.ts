/**
 * Transporte de turnos y consultas.
 *
 * Expone consultas, dashboard, veterinarios y turnos, además de creación, cancelación y
 * actualización de estado. La acción se tipa como confirmar, completar o cancelar.
 *
 * Motivo y límites: El tipo restringe llamadas escritas en TypeScript, pero Express valida otra
 * vez porque una petición externa puede enviar cualquier texto.
 *
 * Guía: docs/BRIEFING_AUTENTICACION_AUTORIZACION_VALIDACIONES.md
 */
// Este archivo define un servicio para manejar las operaciones 
// relacionadas con los turnos y consultas en la aplicación.

import api from './api';
import type { Appointment, Consulta, DashboardStats } from '../types';
// Define los datos necesarios para crear un nuevo turno.
export type CreateAppointmentData = {
  mascota_id: string | number;
  veterinario_id: string | number;
  fecha: string;
  hora: string;
  motivo: string;
};
// Define la estructura de un veterinario para las opciones de selección.
export type VetOption = {
  id: number;
  nombre: string;
  apellido: string;
  matricula?: string;
  especialidad?: string;
};
// Servicio para interactuar con los endpoints del backend relacionados 
// con turnos y consultas.
export const appointmentService = {
  getAppointments: async (fecha?: string) => {
    const { data } = await api.get<Appointment[]>('/turnos', {
      params: fecha ? { fecha } : undefined,
    });
    return data;
  },
// Obtiene los turnos programados para el día actual.
  getTodayAppointments: async () => {
    const { data } = await api.get<Appointment[]>('/turnos/hoy');
    return data;
  },
// Obtiene la lista de veterinarios disponibles para asignar turnos.
  getVeterinarians: async () => {
    const { data } = await api.get<VetOption[]>('/veterinarios');
    return data;
  },
// Obtiene la lista de consultas registradas en el sistema.
  getConsultas: async () => {
    const { data } = await api.get<Consulta[]>('/consultas');
    return data;
  },
// Obtiene las estadísticas del dashboard, incluyendo métricas clave 
// sobre turnos y consultas.
  getDashboardStats: async () => {
    const { data } = await api.get<DashboardStats>('/dashboard');
    return data;
  },
// Crea un nuevo turno en el sistema con los datos proporcionados.
  createAppointment: async (payload: CreateAppointmentData) => {
    const { data } = await api.post('/turnos', payload);
    return data as { id: number; message: string };
  },
// Actualiza el estado de un turno específico (confirmar, completar o cancelar)
//  mediante su ID y la acción deseada.
  updateAppointmentState: async (id: number, accion: 'confirmar' | 'completar' | 'cancelar') => {
    const { data } = await api.patch(`/turnos/${id}/estado`, { accion });
    return data as { message: string };
  },
// Cancela un turno específico mediante su ID, devolviendo 
// un mensaje de confirmación.
  cancelAppointment: async (id: number) => {
    const { data } = await api.patch(`/turnos/${id}/cancelar`);
    return data as { message: string };
  },
};
