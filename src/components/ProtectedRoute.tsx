/**
 * Acceso visual a páginas.
 *
 * Mientras loading muestra PageState; sin usuario redirige a /login. Si recibe role, normaliza
 * uno o varios tipos y consulta hasAnyUserType antes de mostrar children.
 *
 * Motivo y límites: Evita mostrar páginas antes de recuperar sesión. La protección real de los
 * datos sigue en Express, porque el cliente puede ser modificado.
 *
 * Guía: docs/BRIEFING_AUTENTICACION_AUTORIZACION_VALIDACIONES.md
 */
import { hasAnyUserType, type UserType } from '../auth/userTypes';
//es el componente que controla el acceso a las páginas del 
// frontend según si el usuario está logueado y qué rol tiene.
import { Navigate } from 'react-router-dom';
import type { ReactElement } from 'react';
import { useAuth } from '../context/AuthContext';
import PageState from './PageState';
// Protege rutas en frontend; el backend mantiene la autorización real.
type Props = {
  children: ReactElement;
  role?: UserType | UserType[];
};

// Protege rutas en frontend; el backend mantiene la autorización real.
export default function ProtectedRoute({ children, role }: Props) {
  const { usuario, loading } = useAuth();

  if (loading) return <PageState type="loading" message="Cargando sesión…" />;
  if (!usuario) return <Navigate to="/login" replace />;

  if (role) {
    const allowed = Array.isArray(role) ? role : [role];
    if (!hasAnyUserType(usuario, allowed)) return <Navigate to="/" replace />;
  }

  return children;
}
