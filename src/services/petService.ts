/**
 * Transporte de mascotas y pacientes.
 *
 * Define payloads y llamadas de listado, especies, razas, pacientes, detalle veterinario,
 * creación, actualización y baja lógica.
 *
 * Motivo y límites: Usa el cliente HTTP común para sesión. Los métodos deletePet y
 * deactivatePet corresponden a endpoints que preservan el historial mediante baja lógica.
 *
 * Guía: docs/BRIEFING_AUTENTICACION_AUTORIZACION_VALIDACIONES.md
 */
// Servicio para interactuar con los endpoints del backend relacionados
// con turnos y consultas.
import api from './api';
import type { Pet } from '../types';
// Define los datos necesarios para crear una nueva mascota.
export type CreatePetData = {
  nombre: string;
  especie_id: string | number;
  raza?: string;
  sexo: string;
  peso?: number | string;
  fecha_nacimiento?: string;
  foto_url?: string | null;
};
// Define la estructura de una especie de mascota.
export type Especie = {
  id: number;
  nombre: string;
};
// Define la estructura de una mascota.
export type Raza = {
  id: number;
  nombre: string;
};
// Servicio para interactuar con los endpoints del backend relacionados 
// con mascotas y pacientes.
export const petService = {
  getPets: async () => {
    const { data } = await api.get<Pet[]>('/mascotas');
    return data;
  },
// Obtiene la lista de especies de mascotas disponibles en el sistema.
  getSpecies: async () => {
    const { data } = await api.get<Especie[]>('/especies');
    return data;
  },

  // Recupera sugerencias del catálogo; el formulario igualmente acepta texto libre.
  getBreeds: async (especieId: string | number) => {
    const { data } = await api.get<Raza[]>('/razas', { params: { especie_id: especieId } });
    return data;
  },
  getPatients: async () => {
    const { data } = await api.get<Pet[]>('/pacientes');
    return data;
  },

  // Endpoint exclusivo de lectura clínica para el rol Veterinario.
  getVetPetDetail: async (id: number) => {
    const { data } = await api.get<{ mascota: Pet; turnos: Array<{ id: number; fecha: string; hora: string; motivo: string; estado: string; veterinario: string }> }>(`/mascotas/${id}/detalle`);
    return data;
  },
  createPet: async (petData: CreatePetData) => {
    const { data } = await api.post('/mascotas', petData);
    return data as { id: number; message: string };
  },

  updatePet: async (id: number, petData: CreatePetData) => {
    const { data } = await api.put(`/mascotas/${id}`, petData);
    return data as { message: string };
  },

  /** Eliminación lógica: marca la mascota como inactiva (activo = 0) sin borrarla de la BD. */
  deactivatePet: async (id: number) => {
    const { data } = await api.patch(`/mascotas/${id}/deactivate`);
    return data as { message: string };
  },

  /** Alias heredado: el backend aplica eliminación lógica y conserva el historial. */
  deletePet: async (id: number) => {
    await api.delete(`/mascotas/${id}`);
  },
};
