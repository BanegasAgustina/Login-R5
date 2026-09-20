/**
 * Menú por rol y cierre de sesión.
 *
 * NAV contiene las opciones y roles. hasAnyUserType filtra el menú. cerrarSesion espera logout
 * y muestra error si no puede completar el cierre.
 *
 * Motivo y límites: La navegación refleja la sesión compartida. Ocultar una entrada no impide
 * por sí mismo invocar la API.
 *
 * Guía: docs/BRIEFING_AUTENTICACION_AUTORIZACION_VALIDACIONES.md
 */
import { USER_TYPES, hasAnyUserType, type UserType } from '../auth/userTypes';
// Componente de layout principal que incluye la barra lateral, el encabezado móvil
//  y el área de contenido.
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  CalendarDays,
  HeartPulse,
  Home,
  LogOut,
  Menu,
  Moon,
  Stethoscope,
  Sun,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../hooks/useTheme';
import BackToTop from './BackToTop';
import Avatar from './Avatar';

type NavItem = { to: string; label: string; icon: React.ReactNode; roles: UserType[] };

const NAV: NavItem[] = [
  // CLIENTE
  { to: '/', label: 'Inicio', icon: <Home size={18} />, roles: [USER_TYPES.CLIENT] },
  { to: '/mascotas', label: 'Mis mascotas', icon: <HeartPulse size={18} />, roles: [USER_TYPES.CLIENT] },
  { to: '/turnos', label: 'Turnos', icon: <CalendarDays size={18} />, roles: [USER_TYPES.CLIENT] },
  { to: '/perfil', label: 'Perfil', icon: <UserCheck size={18} />, roles: [USER_TYPES.CLIENT] },

  // VETERINARIO
  { to: '/', label: 'Inicio', icon: <Home size={18} />, roles: [USER_TYPES.VET] },
  // El veterinario tiene una vista de consulta global, separada de la gestión del cliente.
  { to: '/pacientes', label: 'Mascotas', icon: <HeartPulse size={18} />, roles: [USER_TYPES.VET] },
  { to: '/turnos', label: 'Turnos', icon: <CalendarDays size={18} />, roles: [USER_TYPES.VET] },
  { to: '/consultas', label: 'Consultas', icon: <Stethoscope size={18} />, roles: [USER_TYPES.VET] },
  { to: '/perfil', label: 'Perfil', icon: <UserCheck size={18} />, roles: [USER_TYPES.VET] },

  // ADMIN
  { to: '/admin', label: 'Inicio', icon: <Home size={18} />, roles: [USER_TYPES.ADMIN] },
  { to: '/admin/usuarios', label: 'Usuarios', icon: <Users size={18} />, roles: [USER_TYPES.ADMIN] },
  { to: '/admin/mascotas', label: 'Mascotas', icon: <HeartPulse size={18} />, roles: [USER_TYPES.ADMIN] },
  { to: '/admin/turnos', label: 'Turnos', icon: <CalendarDays size={18} />, roles: [USER_TYPES.ADMIN] },
  { to: '/perfil', label: 'Perfil', icon: <UserCheck size={18} />, roles: [USER_TYPES.ADMIN] },
];
// Componente de layout principal que incluye la barra lateral, el encabezado móvil
//  y el área de contenido.
export default function Layout() {
  const { usuario, logout } = useAuth();
  const nav = useNavigate();
  const { dark, toggle } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // El cierre OAuth es asíncrono: esperamos la eliminación de la cookie HttpOnly.
  const [logoutError, setLogoutError] = useState('');

  const items = NAV.filter((item) => hasAnyUserType(usuario, item.roles));

  const cerrarSesion = async () => {
    try {
      setLogoutError('');
      await logout();
      nav('/login', { replace: true });
    } catch {
      setLogoutError('No se pudo cerrar la sesión. Verificá la conexión y volvé a intentarlo.');
    }
  };

  const closeSidebar = () => setSidebarOpen(false);

  return (
    <div className={`app-shell${sidebarOpen ? ' sidebar-open' : ''}`}>
      {logoutError && <div className="alert" role="alert">{logoutError}</div>}
      <button
        type="button"
        className="sidebar-backdrop"
        aria-label="Cerrar menú"
        onClick={closeSidebar}
        tabIndex={sidebarOpen ? 0 : -1}
      />

      <aside className="sidebar" aria-label="Navegación principal">
        <div className="sidebar-top">
          <div className="brand">
            <HeartPulse aria-hidden="true" /> PetCare
          </div>
          <button
            type="button"
            className="sidebar-close"
            aria-label="Cerrar menú"
            onClick={closeSidebar}
          >
            <X size={20} />
          </button>
        </div>

        <nav>
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/' || item.to === '/admin'}
              onClick={closeSidebar}
            >
              {item.icon}
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="side-user">
          <div className="side-user-header">
            <Avatar
              name={`${usuario?.nombre || ''} ${usuario?.apellido || ''}`}
              size={42}
            />
            <div className="user-info">
              <b>{usuario?.nombre} {usuario?.apellido}</b>
              <small>{usuario?.rol}</small>
              <small className="user-email">{usuario?.email}</small>
            </div>
          </div>
          <button type="button" onClick={toggle} title={dark ? 'Modo claro' : 'Modo oscuro'}>
            {dark ? <Sun size={18} /> : <Moon size={18} />}
            {dark ? 'Modo claro' : 'Modo oscuro'}
          </button>
          <button type="button" onClick={cerrarSesion}>
            <LogOut size={18} /> Cerrar sesión
          </button>
        </div>
      </aside>

      <main className="main-content">
        <header className="mobile-header">
          <button
            type="button"
            className="menu-btn"
            aria-label="Abrir menú"
            aria-expanded={sidebarOpen}
            onClick={() => setSidebarOpen(true)}
          >
            <Menu size={22} />
          </button>
          <span className="brand">
            <HeartPulse aria-hidden="true" /> PetCare
          </span>
          <button type="button" aria-label="Cambiar tema" title={dark ? 'Modo claro' : 'Modo oscuro'} onClick={toggle}>
            {dark ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </header>
        <Outlet />
        <BackToTop />
      </main>
    </div>
  );
}
