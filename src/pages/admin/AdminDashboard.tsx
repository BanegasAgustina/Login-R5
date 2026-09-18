// La pantalla principal del panel de administración que muestra estadísticas y próximos turnos.
import { useEffect, useState } from 'react';
import { CalendarDays, HeartPulse, Stethoscope, Users, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { adminService } from '../../services/adminService';
import { getErrorMessage } from '../../services/api';
import type { DashboardStats, AdminAppointment } from '../../types';
import { formatFechaHora } from '../../utils/fechas';
import PageState from '../../components/PageState';
import StatusBadge from '../../components/StatusBadge';

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [turnos, setTurnos] = useState<AdminAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
// Cargar estadísticas y turnos al montar el componente
  useEffect(() => {
    const load = async () => {
      try {
        setError('');
        const [resumenData, turnosData] = await Promise.all([
          adminService.getResumen(),
          adminService.getTurnos(),
        ]);
        setStats(resumenData);
        setTurnos(turnosData.slice(0, 5));
      } catch (err) {
        setError(getErrorMessage(err));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) return <PageState type="loading" />;
  if (error) return <PageState type="error" message={error} />;
// Definir las tarjetas de estadísticas con sus respectivos valores e íconos
  const cards = [
    { label: 'Usuarios', value: stats?.usuarios ?? 0, icon: <Users />, to: '/admin/usuarios' },
    { label: 'Mascotas', value: stats?.mascotas ?? 0, icon: <HeartPulse />, to: '/admin/mascotas' },
    { label: 'Turnos pendientes', value: stats?.turnosPendientes ?? 0, icon: <CalendarDays />, to: '/admin/turnos' },
    { label: 'Veterinarios', value: stats?.veterinarios ?? 0, icon: <Stethoscope />, to: '/admin/usuarios' },
  ];
// Renderizar la interfaz del panel de administración con estadísticas y próximos turnos
  return (
    <section className="page admin-page">
      <span className="eyebrow">ADMINISTRACIÓN</span>
      <h1>Panel administrativo</h1>
      <p className="muted">Visión general y métricas de la plataforma veterinaria.</p>

      <div className="stats">
        {cards.map((c) => (
          <Link to={c.to} key={c.label} className="stat-card-link">
            <article className="stat">
              <span>{c.icon}</span>
              <p>{c.label}</p>
              <strong>{c.value}</strong>
            </article>
          </Link>
        ))}
      </div>

      <div className="admin-section">
        <div className="title-row">
          <div>
            <h2>Próximos turnos en el sistema</h2>
            <p className="muted">Turnos pendientes y confirmados recientemente agendados.</p>
          </div>
          <Link to="/admin/turnos" className="ghost sm">
            Ver todos los turnos <ArrowRight size={14} />
          </Link>
        </div>

        {turnos.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Mascota</th>
                  <th>Propietario</th>
                  <th>Veterinario</th>
                  <th>Fecha y hora</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {turnos.map((t) => (
                  <tr key={t.id}>
                    <td data-label="Mascota"><b>{t.mascota}</b></td>
                    <td data-label="Propietario">{t.propietario}</td>
                    <td data-label="Veterinario">{t.veterinario}</td>
                    <td data-label="Fecha y hora">{formatFechaHora(t.fecha, t.hora)}</td>
                    <td data-label="Estado"><StatusBadge estado={t.estado} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <PageState type="empty" message="No hay turnos pendientes en este momento." />
        )}
      </div>
    </section>
  );
}
