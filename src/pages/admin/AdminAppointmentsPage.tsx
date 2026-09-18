//s la pantalla del administrador que permite consultar, filtrar y 
// ver en detalle todos los turnos de la clínica veterinaria.
import { useEffect, useState } from 'react';
import { Eye, Search, X } from 'lucide-react';
import { adminService } from '../../services/adminService';
import { getErrorMessage } from '../../services/api';
import type { AdminAppointment, AdminAppointmentDetail } from '../../types';
import { formatFecha, formatHora, formatFechaHora } from '../../utils/fechas';
import PageState from '../../components/PageState';
import StatusBadge from '../../components/StatusBadge';

export default function AdminAppointmentsPage() {
  const [turnos, setTurnos] = useState<AdminAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filtros
  const [estadoFilter, setEstadoFilter] = useState('');
  const [fechaFilter, setFechaFilter] = useState('');
  const [vetFilter, setVetFilter] = useState('');

  // Modal Ver Turno
  const [selectedTurno, setSelectedTurno] = useState<AdminAppointmentDetail | null>(null);
  // Conservamos el indicador de carga interno sin una variable sin uso que impedía compilar.
  const [, setModalLoading] = useState(false);
// Carga los turnos desde el backend según los filtros seleccionados.
  const loadTurnos = async () => {
    try {
      setError('');
      const data = await adminService.getTurnos({
        estado: estadoFilter || undefined,
        fecha: fechaFilter || undefined,
        veterinario: vetFilter || undefined,
      });
      setTurnos(data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };
// Carga los turnos cuando cambian los filtros de estado o fecha.
  useEffect(() => {
    loadTurnos();
  }, [estadoFilter, fechaFilter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadTurnos();
  };
// Abre el modal de detalle de turno y carga la información detallada desde el backend.
  const handleOpenTurnoDetail = async (id: number) => {
    try {
      setModalLoading(true);
      const detail = await adminService.getTurnoDetail(id);
      setSelectedTurno(detail);
    } catch {
      // Fallback si no está el endpoint detallado: buscar en lista local
      const local = turnos.find((t) => t.id === id);
      if (local) setSelectedTurno(local);
    } finally {
      setModalLoading(false);
    }
  };
// Renderiza la página de administración de turnos con filtros, tabla de resultados y modal de detalle.
  return (
    <section className="page admin-page">
      <span className="eyebrow">ADMINISTRACIÓN</span>
      <h1>Gestión de turnos</h1>
      <p className="muted">Visualizá y supervisá todos los turnos asignados en la clínica veterinaria.</p>

      {/* Filtros */}
      <div className="filters-card">
        <form className="filters" onSubmit={handleSearch}>
          <select
            value={estadoFilter}
            onChange={(e) => setEstadoFilter(e.target.value)}
            aria-label="Filtrar por estado"
          >
            <option value="">Pendientes y confirmados</option>
            <option value="Pendiente">Pendiente</option>
            <option value="Confirmado">Confirmado</option>
            <option value="Completado">Completado</option>
            <option value="Cancelado">Cancelado</option>
          </select>

          <input
            type="date"
            value={fechaFilter}
            onChange={(e) => setFechaFilter(e.target.value)}
            aria-label="Filtrar por fecha"
          />

          <div className="search-field">
            <Search size={16} aria-hidden="true" />
            <input
              type="search"
              placeholder="Veterinario…"
              value={vetFilter}
              onChange={(e) => setVetFilter(e.target.value)}
              aria-label="Buscar por veterinario"
            />
          </div>

          <button type="submit" className="primary sm">
            Filtrar
          </button>
        </form>
      </div>

      {loading ? (
        <PageState type="loading" />
      ) : error ? (
        <PageState type="error" message={error} />
      ) : turnos.length ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Mascota</th>
                <th>Propietario</th>
                <th>Veterinario</th>
                <th>Fecha y hora</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {turnos.map((t) => (
                <tr key={t.id}>
                  <td data-label="Mascota"><b>{t.mascota}</b></td>
                  <td data-label="Propietario">{t.propietario}</td>
                  <td data-label="Veterinario">{t.veterinario}</td>
                  <td data-label="Fecha y hora">{formatFechaHora(t.fecha, t.hora)}</td>
                  <td data-label="Estado">
                    <StatusBadge estado={t.estado} />
                  </td>
                  <td data-label="Acciones">
                    <button
                      type="button"
                      className="ghost sm"
                      onClick={() => handleOpenTurnoDetail(t.id)}
                      aria-label={`Ver detalles del turno de ${t.mascota}`}
                    >
                      <Eye size={14} /> Ver turno
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <PageState type="empty" message="No se encontraron turnos con los filtros seleccionados." />
      )}

      {/* MODAL DETALLE DE TURNO */}
      {selectedTurno && (
        <div className="modal-bg" role="dialog" aria-modal="true" aria-labelledby="turno-detail-title">
          <div className="modal">
            <button
              type="button"
              className="close"
              onClick={() => setSelectedTurno(null)}
              aria-label="Cerrar modal"
            >
              <X />
            </button>
            <h2 id="turno-detail-title">Detalle del turno</h2>
            <div className="detail-list">
              <div>
                <small className="muted">Mascota:</small>
                <p><b>{selectedTurno.mascota}</b> {selectedTurno.especie ? `(${selectedTurno.especie})` : ''}</p>
              </div>
              <div>
                <small className="muted">Propietario:</small>
                <p><b>{selectedTurno.propietario}</b></p>
                {selectedTurno.email_propietario && <small className="muted">{selectedTurno.email_propietario}</small>}
                {selectedTurno.telefono_propietario && <small className="muted"> · Tel: {selectedTurno.telefono_propietario}</small>}
              </div>
              <div>
                <small className="muted">Profesional asignado:</small>
                <p>Dr/a. {selectedTurno.veterinario} {selectedTurno.matricula ? `(Mat. ${selectedTurno.matricula})` : ''}</p>
              </div>
              <div>
                <small className="muted">Fecha y horario:</small>
                <p><b>{formatFecha(selectedTurno.fecha)}</b> a las <b>{formatHora(selectedTurno.hora)}</b></p>
              </div>
              <div>
                <small className="muted">Estado actual:</small>
                <p><StatusBadge estado={selectedTurno.estado} /></p>
              </div>
              <div>
                <small className="muted">Motivo de la consulta:</small>
                <p className="turno-motivo-box">{selectedTurno.motivo}</p>
              </div>
            </div>
            <button type="button" className="primary" onClick={() => setSelectedTurno(null)}>
              Cerrar
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
