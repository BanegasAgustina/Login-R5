//es la pantalla donde el usuario puede consultar el historial de las 
// atenciones veterinarias realizadas a sus mascotas.
import { useEffect, useState } from 'react';
import { Stethoscope } from 'lucide-react';
import { appointmentService } from '../services/appointmentService';
import { getErrorMessage } from '../services/api';
import type { Consulta } from '../types';
import { formatFecha, formatFechaHora } from '../utils/fechas';
import PageState from '../components/PageState';

export default function ConsultasPage() {
  const [consultas, setConsultas] = useState<Consulta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
// Carga las consultas desde el backend al montar el componente.
  useEffect(() => {
    appointmentService
      .getConsultas()
      .then((data) => setConsultas(data))
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  return (
    <section className="page">
      <span className="eyebrow">HISTORIAL</span>
      <h1>Consultas</h1>
      <p className="muted">Registro de consultas realizadas.</p>

      {loading ? (
        <PageState type="loading" />
      ) : error ? (
        <PageState type="error" message={error} />
      ) : consultas.length ? (
        <div className="appointment-list full-width">
          {consultas.map((c) => (
            <article className="appointment" key={c.id}>
              <span className="pet-icon"><Stethoscope aria-hidden="true" /></span>
              <div className="appointment-body">
                <h2>{c.mascota}</h2>
                {c.veterinario && <p>{c.veterinario}</p>}
                <small>
                  {c.fecha_consulta
                    ? formatFecha(c.fecha_consulta)
                    : c.fecha
                      ? formatFechaHora(c.fecha, c.hora || '')
                      : '—'}
                </small>
                {c.diagnostico && <p className="consulta-detail">Diagnóstico: {c.diagnostico}</p>}
                {c.tratamiento && <p className="consulta-detail">Tratamiento: {c.tratamiento}</p>}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <PageState type="empty" message="No hay consultas registradas." />
      )}
    </section>
  );
}
