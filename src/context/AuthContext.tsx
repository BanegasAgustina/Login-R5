//encargado de gestionar quién está conectado, 
// iniciar/cerrar sesión y compartir esa información con toda la aplicación.
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { authService } from '../services/authService';
import type { User } from '../types';
// Contexto de autenticación que proporciona información del usuario y funciones de inicio/cierre de sesión.
type Auth = {
  usuario: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  setUsuario: (u: User | null) => void;
};

const AuthContext = createContext<Auth | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const theme = localStorage.getItem('petcare_theme') || 'light';
    document.documentElement.dataset.theme = theme;

    // Tras OAuth descartamos un Bearer anterior; la sesión nueva está en HttpOnly.
    // También consultamos /me sin token local para recuperar esa cookie al recargar.
    if (new URLSearchParams(window.location.search).get('oauth') === 'success') {
      localStorage.removeItem('petcare_token');
      window.history.replaceState({}, '', '/login');
    }

    authService
      .getMe()
      .then((data) => setUsuario(data))
      .catch(() => localStorage.removeItem('petcare_token'))
      .finally(() => setLoading(false));
  }, []);
// Función para iniciar sesión; almacena el token y actualiza el estado del usuario.
  const login = async (email: string, password: string) => {
    const data = await authService.login(email, password);
    localStorage.setItem('petcare_token', data.token);
    setUsuario(data.usuario);
    return data.usuario;
  };

  const logout = async () => {
    // Esperamos que el servidor borre HttpOnly antes de mostrar la pantalla pública.
    try {
      await authService.logout();
    } catch (error) {
      // La sesión local se puede quitar aun sin red, como antes; HttpOnly requiere
      // confirmación del servidor para no simular un cierre que no ocurrió.
      if (!localStorage.getItem('petcare_token')) throw error;
    }
    localStorage.removeItem('petcare_token');
    setUsuario(null);
  };
// Proporciona el contexto de autenticación a los componentes hijos.
  return (
    <AuthContext.Provider value={{ usuario, loading, login, logout, setUsuario }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth requiere AuthProvider');
  return ctx;
};
