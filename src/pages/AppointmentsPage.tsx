/**
 * Formulario y acciones sobre turnos.
 *
 * Detecta Veterinario con hasUserType, carga listados y ofrece acciones por estado. El
 * formulario exige mascota, veterinario, fecha, hora y motivo. Los servicios crean, cancelan o
 * cambian estado.
 *
 * Motivo y límites: Los campos requeridos del formulario no prueban disponibilidad horaria ni
 * pertenencia. Las reglas de transición y acceso se deciden nuevamente en petRoutes.
 *
 * Guía: docs/BRIEFING_AUTENTICACION_AUTORIZACION_VALIDACIONES.md
 */
import { USER_TYPES, hasUserType } from '../auth/userTypes';
// Pantalla de turnos para clientes y veterinarios, con listado, filtros, acciones y modales.
import { useEffect, useState } from 'react';
import { CalendarPlus, Check, Plus, X } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useAuth } from '../context/AuthContext';
import { appointmentService, type CreateAppointmentData, type VetOption } from '../services/appointmentService';
import { petService } from '../services/petService';
import { getErrorMessage } from '../services/api';
import type { Appointment, Pet } from '../types';
import { formatFecha, formatHora } from '../utils/fechas';
import PageState from '../components/PageState';
import StatusBadge from '../components/StatusBadge';
import ConfirmDialog from '../components/ConfirmDialog';
// Carga y muestra la lista de turnos, permite solicitar nuevos turnos (clientes),
//  y para veterinarios permite confirmar, completar o cancelar turnos.
export default function AppointmentsPage() {
  const { usuario } = useAuth();
  const isVet = hasUserType(usuario, USER_TYPES.VET);
  const [items, setItems] = useState<Appointment[]>([]);
  const [pets, setPets] = useState<Pet[]>([]);
  const [vets, setVets] = useState<VetOption[]>([]);
  const [modal, setModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Appointment | null>(null);

  const { register, handleSubmit, reset } = useForm<CreateAppointmentData>();

  const load = async () => {
    try {
      const data = await appointmentService.getAppointments();
      setItems(data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };
// Carga los turnos y, si es cliente, también las mascotas y veterinarios disponibles.
  useEffect(() => {
    load();
    if (!isVet) {
      petService.getPets().then(setPets).catch(() => {});
      appointmentService.getVeterinarians().then(setVets).catch(() => {});
    }
  }, [isVet]);

  const add = async (d: CreateAppointmentData) => {
    try {
      setSubmitting(true);
      await appointmentService.createAppointment(d);
      reset();
      setModal(false);
      setMessage('Turno solicitado correctamente.');
      await load();
    } catch (err) {
      setMessage(getErrorMessage(err, 'No se pudo solicitar el turno.'));
    } finally {
      setSubmitting(false);
    }
  };
// Maneja la acción de confirmar, completar o cancelar un turno; actualiza el estado y recarga la lista.
  const turnoAction = async (id: number, accion: 'confirmar' | 'completar' | 'cancelar') => {
    try {
      setActionLoading(id);
      const data = await appointmentService.updateAppointmentState(id, accion);
      setMessage(data.message);
      await load();
    } catch (err) {
      setMessage(getErrorMessage(err));
    } finally {
      setActionLoading(null);
    }
  };
// Maneja la acción de cancelar un turno desde el modal de confirmación; actualiza el estado y recarga la lista.
  const handleCancelAppointment = async () => {
    if (!cancelTarget) return;
    try {
      setActionLoading(cancelTarget.id);
      const data = await appointmentService.cancelAppointment(cancelTarget.id);
      setMessage(data.message);
      setCancelTarget(null);
      await load();
    } catch (err) {
      setMessage(getErrorMessage(err));
    } finally {
      setActionLoading(null);
    }
  };
// Renderiza la página de turnos con listado, filtros, acciones y modales según el rol del usuario (cliente o veterinario).
  return (
    <section className="page">
      <div className="title-row">
        <div>
          <span className="eyebrow">AGENDA</span>
          <h1>Turnos</h1>
          <p className="muted">
            {isVet ? 'Gestioná tus turnos y acciones pendientes.' : 'Solicitá y seguí la atención de tus mascotas.'}
          </p>
        </div>
        {!isVet && (
          <button type="button" className="primary" onClick={() => setModal(true)}>
            <Plus size={18} /> Solicitar turno
          </button>
        )}
      </div>

      {message && (
        <div className={message.includes('correctamente') || message.includes('Turno') ? 'success' : 'alert'} role="status">
          {message}
        </div>
      )}

      {loading ? (
        <PageState type="loading" message="Cargando agenda…" />
      ) : error ? (
        <PageState type="error" message={error} />
      ) : items.length ? (
        <div className="appointment-list full-width">
          {items.map((t) => (
            <article className="appointment" key={t.id}>
              <span className="date" aria-hidden="true">
                <b>{formatFecha(t.fecha).slice(0, 2)}</b>
                <small>{formatFecha(t.fecha).slice(3, 5)}</small>
              </span>
              <div className="appointment-body">
                <h2>{t.mascota}</h2>
                <p>{isVet ? t.cliente : t.veterinario} · {formatHora(t.hora)}</p>
                <small>{t.motivo}</small>
              </div>
              <StatusBadge estado={t.estado} />
              
              {/* Acciones para Veterinario */}
              {isVet && (
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
              )}

              {/* Acciones para Cliente: Cancelar turno si está Pendiente o Confirmado */}
              {!isVet && ['Pendiente', 'Confirmado'].includes(t.estado) && (
                <div className="row-actions">
                  <button
                    type="button"
                    className="ghost sm danger-text"
                    disabled={actionLoading === t.id}
                    onClick={() => setCancelTarget(t)}
                    title="Cancelar turno"
                    aria-label={`Cancelar turno de ${t.mascota}`}
                  >
                    <X size={14} /> Cancelar turno
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      ) : (
        <PageState type="empty" message={isVet ? 'No tenés turnos asignados.' : 'No tenés turnos. Solicitá uno para comenzar.'}>
          {!isVet && (
            <button type="button" className="primary" onClick={() => setModal(true)}>
              <CalendarPlus size={18} /> Solicitar turno
            </button>
          )}
        </PageState>
      )}

      {/* MODAL SOLICITAR TURNO */}
      {modal && (
        <div className="modal-bg" role="dialog" aria-modal="true" aria-labelledby="modal-turno-title">
          <form className="modal" onSubmit={handleSubmit(add)}>
            <button type="button" className="close" onClick={() => setModal(false)} aria-label="Cerrar"><X /></button>
            <h2 id="modal-turno-title">Solicitar turno</h2>
            <label htmlFor="turno-mascota">
              Mascota
              <select id="turno-mascota" {...register('mascota_id', { required: true })}>
                <option value="">Seleccionar</option>
                {pets.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </label>
            <label htmlFor="turno-vet">
              Veterinario
              <select id="turno-vet" {...register('veterinario_id', { required: true })}>
                <option value="">Seleccionar</option>
                {vets.map((v) => <option key={v.id} value={v.id}>Dr/a. {v.nombre} {v.apellido} {v.especialidad ? `(${v.especialidad})` : ''}</option>)}
              </select>
            </label>
            <div className="form-grid">
              <label htmlFor="turno-fecha">
                Fecha
                <input id="turno-fecha" type="date" {...register('fecha', { required: true })} />
              </label>
              <label htmlFor="turno-hora">
                Hora
                <input id="turno-hora" type="time" {...register('hora', { required: true })} />
              </label>
            </div>
            <label htmlFor="turno-motivo">
              Motivo
              <textarea id="turno-motivo" rows={3} placeholder="Describí brevemente el motivo de la consulta…" {...register('motivo', { required: true })} />
            </label>
            <button type="submit" className="primary" disabled={submitting}>
              {submitting ? 'Enviando…' : 'Confirmar solicitud'}
            </button>
          </form>
        </div>
      )}

      {/* CONFIRM CANCELAR TURNO */}
      <ConfirmDialog
        open={!!cancelTarget}
        title="Cancelar turno"
        message={`¿Confirmás que querés cancelar el turno de ${cancelTarget?.mascota} programado para el ${cancelTarget ? formatFecha(cancelTarget.fecha) : ''}?`}
        confirmLabel="Cancelar turno"
        danger
        loading={actionLoading === cancelTarget?.id}
        onConfirm={handleCancelAppointment}
        onCancel={() => setCancelTarget(null)}
      />
    </section>
  );
}
