//es la pantalla donde el veterinario puede consultar el padrón de mascotas y 
// acceder a la información clínica y al historial de turnos de cada una, sin poder modificar los datos.
import { useEffect, useState } from 'react';
import { Eye, HeartPulse, Mail, X } from 'lucide-react';
import { petService } from '../services/petService';
import { getErrorMessage } from '../services/api';
import type { Pet } from '../types';
import PageState from '../components/PageState';
import StatusBadge from '../components/StatusBadge';
import { getAssetUrl } from '../utils/assets';
import { calcEdad } from '../utils/fechas';

// Presenta el padrón clínico. Este componente no incluye acciones de edición:
// el veterinario solo tiene permiso de consulta sobre mascotas de otros clientes.
export default function PatientsPage() {
  const [pets, setPets] = useState<Pet[]>([]);
  const [selectedPet, setSelectedPet] = useState<Pet | null>(null);
  const [relatedAppointments, setRelatedAppointments] = useState<Array<{ id: number; fecha: string; hora: string; motivo: string; estado: string; veterinario: string }>>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    // El backend aplica el rol Veterinario y devuelve todas las mascotas activas.
    petService.getPets().then(setPets).catch((err) => setError(getErrorMessage(err))).finally(() => setLoading(false));
  }, []);

  // Carga información adicional solo cuando el profesional la solicita.
  const openDetail = async (pet: Pet) => {
    setSelectedPet(pet);
    setDetailLoading(true);
    try {
      const detail = await petService.getVetPetDetail(pet.id);
      setSelectedPet(detail.mascota);
      setRelatedAppointments(detail.turnos);
    } catch (err) {
      setError(getErrorMessage(err));
      setSelectedPet(null);
    } finally {
      setDetailLoading(false);
    }
  };
  return (
    <section className="page">
      <span className="eyebrow">🐾 PADRÓN CLÍNICO</span>
      <h1>Mascotas</h1>
      <p className="muted">Consultá todas las mascotas activas y los datos de contacto de sus dueños.</p>

      {loading ? <PageState type="loading" /> : error ? <PageState type="error" message={error} /> : pets.length ? (
        <div className="pet-grid">
          {pets.map((pet) => (
            <article className="pet-card" key={pet.id}>
              {pet.foto_url ? <div className="pet-image-container"><img src={getAssetUrl(pet.foto_url)} alt={`Foto de ${pet.nombre}`} /></div> : <div className="pet-no-photo"><HeartPulse aria-hidden="true" /></div>}
              <div className="pet-card-body">
                <h2 className="pet-card-name">🐾 {pet.nombre}</h2>
                <p className="pet-card-especie">{pet.especie}{pet.raza ? ` · ${pet.raza}` : ''}</p>
                <p className="pet-owner"><strong>Dueño:</strong> {pet.propietario}</p>
                {pet.email_propietario && <p className="pet-owner"><Mail size={14} aria-hidden="true" /> {pet.email_propietario}</p>}
              </div>
              <div className="pet-card-footer"><button type="button" className="ghost sm" onClick={() => openDetail(pet)}><Eye size={15} /> Ver detalle</button></div>
            </article>
          ))}
        </div>
      ) : <PageState type="empty" message="No hay mascotas activas registradas." />}

      {selectedPet && (
        <div className="modal-bg" role="dialog" aria-modal="true" aria-labelledby="pet-detail-title">
          <div className="modal">
            <button type="button" className="close" onClick={() => { setSelectedPet(null); setRelatedAppointments([]); }} aria-label="Cerrar detalle"><X /></button>
            <h2 id="pet-detail-title">🐾 {selectedPet.nombre}</h2>
            {selectedPet.foto_url && <div className="image-preview-frame"><img className="image-preview-img" src={getAssetUrl(selectedPet.foto_url)} alt={`Foto de ${selectedPet.nombre}`} /></div>}
            <div className="detail-list">
              <div><small className="muted">Especie y raza</small><p>{selectedPet.especie}{selectedPet.raza ? ` · ${selectedPet.raza}` : ''}</p></div>
              {selectedPet.fecha_nacimiento && <div><small className="muted">Edad</small><p>{calcEdad(selectedPet.fecha_nacimiento)}</p></div>}
              {selectedPet.sexo && <div><small className="muted">Sexo</small><p>{selectedPet.sexo}</p></div>}
              {selectedPet.peso && <div><small className="muted">Peso</small><p>{selectedPet.peso} kg</p></div>}
              <div><small className="muted">Estado</small><p><StatusBadge estado="Activo" /></p></div>
              <div><small className="muted">Dueño</small><p>{selectedPet.propietario}</p>{selectedPet.email_propietario && <p>{selectedPet.email_propietario}</p>}</div>
              <div><small className="muted">Turnos relacionados</small>{detailLoading ? <p>Cargando historial…</p> : relatedAppointments.length ? <ul className="pet-appointment-history">{relatedAppointments.map((appointment) => <li key={appointment.id}><strong>{appointment.fecha} {appointment.hora}</strong> · {appointment.estado}<br />{appointment.veterinario} · {appointment.motivo}</li>)}</ul> : <p>Sin turnos registrados.</p>}</div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}