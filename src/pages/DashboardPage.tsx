import { USER_TYPES, hasUserType } from '../auth/userTypes';
//es la pantalla principal del sistema, donde se muestran estadísticas y 
// próximos turnos según el rol del usuario (cliente o veterinario).
import { Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import {
  CalendarDays,
  Check,
  HeartPulse,
  Stethoscope,
  X,
} from 'lucide-react';
// Importa servicios y utilidades para manejar turnos, errores y formatos de fecha/hora.
import { useAuth } from '../context/AuthContext';
import { appointmentService } from '../services/appointmentService';
import { getErrorMessage } from '../services/api';
import type { Appointment, DashboardStats } from '../types';
import { formatFechaHora, formatHora } from '../utils/fechas';
import PageState from '../components/PageState';
import StatusBadge from '../components/StatusBadge';

type StatCard = {
  label: string;
  value: number | string;
  icon: React.ReactNode;
};
// Componente principal del dashboard que muestra estadísticas y próximos turnos
//  según el rol del usuario (cliente o veterinario).
export default function DashboardPage() {
  const { usuario } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [turnos, setTurnos] = useState<Appointment[]>([]);
  const [agendaHoy, setAgendaHoy] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [feedback, setFeedback] = useState('');

  const isAdmin = hasUserType(usuario, USER_TYPES.ADMIN);
  const isVet = hasUserType(usuario, USER_TYPES.VET);
// Carga las estadísticas y turnos desde el backend al montar el componente, según el rol del usuario.
  useEffect(() => {
    const load = async () => {
      try {
        setError('');
        if (isAdmin) return;

        const requests: Promise<unknown>[] = [
          appointmentService.getDashboardStats().then((data) => setStats(data)),
          appointmentService.getAppointments().then((data) => setTurnos(data)),
        ];
// Si el usuario es veterinario, también carga la agenda de hoy.
        if (isVet) {
          requests.push(appointmentService.getTodayAppointments().then((data) => setAgendaHoy(data)));
        }

        await Promise.all(requests);
      } catch (err) {
        setError(getErrorMessage(err));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [isAdmin, isVet]);
// Maneja la acción de confirmar, completar o cancelar un turno; actualiza el estado y recarga la lista.
  const turnoAction = async (id: number, accion: 'confirmar' | 'completar' | 'cancelar') => {
    try {
      setActionLoading(id);
      setFeedback('');
      const data = await appointmentService.updateAppointmentState(id, accion);
      setFeedback(data.message);
      const [turnosRes, hoyRes, dash] = await Promise.all([
        appointmentService.getAppointments(),
        appointmentService.getTodayAppointments(),
        appointmentService.getDashboardStats(),
      ]);
      setTurnos(turnosRes);
      setAgendaHoy(hoyRes);
      setStats(dash);
    } catch (err) {
      setFeedback(getErrorMessage(err, 'No se pudo actualizar el turno.'));
    } finally {
      setActionLoading(null);
    }
  };

  if (isAdmin) {
    return <Navigate to="/admin" replace />;
  }

  if (loading) return <PageState type="loading" />;
  if (error) return <PageState type="error" message={error} />;
// Define las tarjetas de estadísticas según el rol del usuario (veterinario o cliente).
  const cards: StatCard[] =
    isVet
      ? [
          { label: 'Pacientes', value: stats?.pacientes ?? 0, icon: <HeartPulse /> },
          { label: 'Turnos pendientes', value: stats?.turnosPendientes ?? 0, icon: <CalendarDays /> },
          { label: 'Consultas recientes', value: stats?.consultas ?? 0, icon: <Stethoscope /> },
        ]
      : [
          { label: 'Mis mascotas', value: stats?.mascotas ?? 0, icon: <HeartPulse /> },
          { label: 'Próximos turnos', value: stats?.turnosPendientes ?? 0, icon: <CalendarDays /> },
          { label: 'Consultas recientes', value: stats?.consultas ?? 0, icon: <Stethoscope /> },
        ];

  const proximos = turnos
    .filter((t) => !['Cancelado', 'Completado'].includes(t.estado))
    .slice(0, 6);

  const accionesTurno = (t: Appointment) => {
    if (!isVet) return null;
    return (
      <div className="row-actions">
        {t.estado === 'Pendiente' && (
          <button
            type="button"
            className="ghost sm"
            disabled={actionLoading === t.id}
            onClick={() => turnoAction(t.id, 'confirmar')}
          >
            <Check size={14} /> Confirmar
          </button>
        )}
        {['Pendiente', 'Confirmado'].includes(t.estado) && (
          <>
            <button
              type="button"
              className="ghost sm"
              disabled={actionLoading === t.id}
              onClick={() => turnoAction(t.id, 'completar')}
            >
              Completar
            </button>
            <button
              type="button"
              className="ghost sm danger-text"
              disabled={actionLoading === t.id}
              onClick={() => turnoAction(t.id, 'cancelar')}
            >
              <X size={14} /> Cancelar
            </button>
          </>
        )}
      </div>
    );
  };

  return (
    <section className="page">
      <span className="eyebrow">PANEL PRINCIPAL</span>
      <h1>Hola, {usuario?.nombre}</h1>
      <p className="muted">
        {isVet
          ? 'Estos son tus pacientes y la agenda del día.'
          : 'Todo lo importante de PetCare, en un solo lugar.'}
      </p>

      <div className="stats">
        {cards.map((card) => (
          <article className="stat" key={card.label}>
            <span>{card.icon}</span>
            <p>{card.label}</p>
            <strong>{card.value}</strong>
          </article>
        ))}
      </div>

      {feedback && <div className="success" role="status">{feedback}</div>}

      {isVet && (
        <>
          <div className="section-head">
            <h2>Agenda de hoy</h2>
            <p className="muted">Turnos programados para hoy.</p>
          </div>
          {agendaHoy.length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Hora</th>
                    <th>Mascota</th>
                    <th>Cliente</th>
                    <th>Motivo</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {agendaHoy.map((t) => (
                    <tr key={t.id}>
                      <td>{formatHora(t.hora)}</td>
                      <td>{t.mascota}</td>
                      <td>{t.cliente}</td>
                      <td>{t.motivo}</td>
                      <td><StatusBadge estado={t.estado} /></td>
                      <td>{accionesTurno(t)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <PageState type="empty" message="No hay turnos programados para hoy." />
          )}
        </>
      )}

      <div className="section-head">
        <h2>{isVet ? 'Próximos turnos' : 'Próximos turnos'}</h2>
        <p className="muted">Mantenete al día con la atención.</p>
      </div>

      {proximos.length ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Mascota</th>
                <th>{isVet ? 'Cliente' : 'Profesional'}</th>
                <th>Fecha</th>
                <th>Estado</th>
                {isVet && <th>Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {proximos.map((t) => (
                <tr key={t.id}>
                  <td>{t.mascota}</td>
                  <td>{isVet ? t.cliente : t.veterinario}</td>
                  <td>{formatFechaHora(t.fecha, t.hora)}</td>
                  <td><StatusBadge estado={t.estado} /></td>
                  {isVet && <td>{accionesTurno(t)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <PageState type="empty" message="No hay turnos pendientes." />
      )}
    </section>
  );
}
