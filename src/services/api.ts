
//configura Axios para conectar el frontend con el 
// backend. Define la URL del servidor, agrega automáticamente 
// el token de autenticación guardado en el navegador a cada petición
//  y controla los errores de sesión. Si el token venció o no es válido y 
// el servidor devuelve un error 401, elimina el token y redirige al usuario 
// al inicio de sesión. Además, incluye una función para obtener y mostrar 
// mensajes de error más claros al usuario.
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  // Permite enviar la cookie OAuth HttpOnly a nuestra API; no contiene secretos de proveedores.
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('petcare_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Si la sesión expiró, limpiamos el token para forzar nuevo login.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // /me también se consulta al visitar páginas públicas sin sesión OAuth.
    // Ese 401 esperado no debe sacar al visitante de /registro.
    if (error.response?.status === 401 && !['/auth/login', '/auth/me'].includes(error.config?.url)) {
      localStorage.removeItem('petcare_token');
      if (window.location.pathname !== '/login') {
        window.location.replace('/login');
      }
    }
    return Promise.reject(error);
  },
);

export function getErrorMessage(error: unknown, fallback = 'Ocurrió un error inesperado.'): string {
  if (axios.isAxiosError(error)) {
    if (!error.response) return 'No se pudo conectar con el servidor. Verificá tu conexión.';
    return error.response.data?.message || fallback;
  }
  return fallback;
}

export default api;
