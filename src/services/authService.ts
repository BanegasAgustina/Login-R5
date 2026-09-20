/**
 * Operaciones de autenticación desde UI.
 *
 * login, register, getMe, updateMe y logout encapsulan llamadas a /auth y sus tipos de datos.
 *
 * Motivo y límites: Separa HTTP de componentes. logout solicita borrar la cookie; quien elimina
 * petcare_token y actualiza usuario es AuthContext.
 *
 * Guía: docs/BRIEFING_AUTENTICACION_AUTORIZACION_VALIDACIONES.md
 */
// Servicio para interactuar con los endpoints del backend relacionados
// con la autenticación de usuarios, incluyendo inicio de sesión, registro,
// obtención de información del usuario actual y cierre de sesión.
import api from './api';
import type { User } from '../types';
// Define el servicio de autenticación con funciones para interactuar con los endpoints del backend.
export const authService = {
  login: async (email: string, password: string) => {
    const { data } = await api.post('/auth/login', { email, password });
    return data as { token: string; usuario: User };
  },

  register: async (payload: {
    nombre: string;
    apellido: string;
    email: string;
    password: string;
    telefono?: string;
    direccion?: string;
  }) => {
    const { data } = await api.post('/auth/register', payload);
    return data as { message: string };
  },
// Obtiene la información del usuario actualmente autenticado.
  getMe: async () => {
    const { data } = await api.get('/auth/me');
    return data as User;
  },
// Actualiza la información del usuario actualmente autenticado con los campos proporcionados.
  updateMe: async (payload: {
    nombre?: string;
    apellido?: string;
    telefono?: string;
  }) => {
    const { data } = await api.put<{ message: string; usuario: User }>('/auth/me', payload);
    return data;
  },
// Cierra la sesión del usuario actualmente autenticado, eliminando el token de autenticación.
  // Aquí solo se solicita el cierre al servidor. AuthContext elimina
  // el Bearer del almacenamiento y limpia el usuario de React.
  logout: async () => {
    // Si no se borró la cookie, el frontend debe informar el fallo y permitir reintentar.
    await api.post('/auth/logout');
  },
};
