//es la pantalla donde el usuario puede ver, agregar, editar y eliminar sus mascotas registradas, 
// así como actualizar su información y fotografías.
import { useEffect, useState } from 'react';
import { Pencil, Plus, Trash2, X } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { petService, type Especie, type Raza, type CreatePetData } from '../services/petService';
import { uploadService } from '../services/uploadService';
import { getErrorMessage } from '../services/api';
import type { Pet } from '../types';
import PageState from '../components/PageState';
import ConfirmDialog from '../components/ConfirmDialog';
import ImageUpload from '../components/ImageUpload';
import { validatePetName } from '../utils/validators';
import { getAssetUrl } from '../utils/assets';
import { calcEdad } from '../utils/fechas';
// Devuelve un emoji representativo de la especie de la mascota, o un emoji genérico si no se reconoce.
function getEspecieEmoji(especie?: string): string {
  const e = especie?.toLowerCase() ?? '';
  if (e.includes('perro') || e.includes('canino')) return '🐶';
  if (e.includes('gato') || e.includes('felino')) return '🐱';
  if (e.includes('conejo')) return '🐰';
  if (e.includes('ave') || e.includes('pájaro') || e.includes('pajaro') || e.includes('loro')) return '🐦';
  if (e.includes('pez')) return '🐠';
  if (e.includes('tortuga')) return '🐢';
  if (e.includes('hámster') || e.includes('hamster')) return '🐹';
  return '🐾';
}
// Componente principal de la página de mascotas, que permite al usuario gestionar sus mascotas registradas.
export default function PetsPage() {
  const [pets, setPets] = useState<Pet[]>([]);
  const [species, setSpecies] = useState<Especie[]>([]);
  const [breeds, setBreeds] = useState<Raza[]>([]);
  const [modal, setModal] = useState(false);
  const [editingPet, setEditingPet] = useState<Pet | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Pet | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<CreatePetData>({ mode: 'onTouched' });
  const selectedSpeciesId = watch('especie_id');
// Carga la lista de mascotas y especies al montar el componente; maneja errores de carga.
  const load = async () => {
    try {
      setError('');
      setPets(await petService.getPets());
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    petService.getSpecies().then(setSpecies).catch(() => {});
  }, []);

  // Las sugerencias cambian al elegir especie; escribir una raza nueva sigue siendo válido.
  useEffect(() => {
    if (!selectedSpeciesId) {
      setBreeds([]);
      return;
    }
    petService.getBreeds(selectedSpeciesId).then(setBreeds).catch(() => setBreeds([]));
  }, [selectedSpeciesId]);
  const closeModal = () => {
    setModal(false);
    setEditingPet(null);
    setImageFile(null);
    reset();
  };
// Abre el modal de creación de mascota, reseteando el formulario y la imagen seleccionada.
  const openCreate = () => {
    setEditingPet(null);
    setImageFile(null);
    reset({ nombre: '', especie_id: '', raza: '', sexo: 'Macho', peso: '', fecha_nacimiento: '' });
    setModal(true);
  };
// Abre el modal de edición de mascota, cargando los datos existentes en el formulario y la imagen.
  const openEdit = (pet: Pet) => {
    setEditingPet(pet);
    setImageFile(null);
    reset({
      nombre: pet.nombre,
      especie_id: pet.especie_id ?? '',
      raza: pet.raza ?? '',
      sexo: pet.sexo,
      peso: pet.peso ?? '',
      fecha_nacimiento: pet.fecha_nacimiento?.slice(0, 10) ?? '',
    });
    setModal(true);
  };
// Guarda los cambios de creación o edición de mascota, subiendo la imagen si se seleccionó una nueva, y recarga la lista.
  const save = async (data: CreatePetData) => {
    try {
      setSubmitting(true);
      setMessage('');
      const fotoUrl = imageFile
        ? await uploadService.uploadImage(imageFile, 'mascota')
        : editingPet?.foto_url ?? null;
      const payload = { ...data, nombre: data.nombre.trim(), foto_url: fotoUrl };
      const result = editingPet
        ? await petService.updatePet(editingPet.id, payload)
        : await petService.createPet(payload);
      closeModal();
      setMessage(result.message);
      await load();
    } catch (err) {
      setMessage(getErrorMessage(err, 'No se pudo guardar la mascota. Intentá nuevamente.'));
    } finally {
      setSubmitting(false);
    }
  };
// Confirma la eliminación de la mascota seleccionada, desactivándola en el backend y recargando la lista.
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      await petService.deactivatePet(deleteTarget.id);
      setMessage(`${deleteTarget.nombre} fue removida de tu listado correctamente.`);
      setDeleteTarget(null);
      await load();
    } catch (err) {
      setMessage(getErrorMessage(err, 'No se pudo quitar la mascota.'));
    } finally {
      setDeleting(false);
    }
  };
// Renderiza la página de mascotas con listado, formulario de creación/edición, y confirmación de eliminación.
  return (
    <section className="page">
      <div className="title-row">
        <div>
          <span className="eyebrow">🐾 MIS MASCOTAS</span>
          <h1>Mis mascotas</h1>
          <p className="muted">Administrá la información y fotografías de tus mascotas.</p>
        </div>
        <button type="button" className="primary" onClick={openCreate}><Plus size={18} /> Registrar mascota</button>
      </div>

      {message && <div className={message.includes('correctamente') || message.includes('removida') ? 'success' : 'alert'} role="status">{message}</div>}

      {loading ? <PageState type="loading" message="Cargando mascotas…" /> : error ? <PageState type="error" message={error} /> : pets.length ? (
        <div className="pet-grid">
          {pets.map((pet) => (
            <article className="pet-card" key={pet.id}>
              {pet.foto_url ? <div className="pet-image-container"><img src={getAssetUrl(pet.foto_url)} alt={`Foto de ${pet.nombre}`} /></div> : <div className="pet-no-photo" aria-hidden="true"><span className="pet-no-photo-emoji">{getEspecieEmoji(pet.especie)}</span></div>}
              <div className="pet-card-body">
                <h2 className="pet-card-name">{getEspecieEmoji(pet.especie)} {pet.nombre}</h2>
                <dl className="pet-details">
                  <div><dt>Especie</dt><dd>{pet.especie}</dd></div>
                  <div><dt>Raza</dt><dd>{pet.raza || 'Sin especificar'}</dd></div>
                  <div><dt>Edad</dt><dd>{calcEdad(pet.fecha_nacimiento)}</dd></div>
                </dl>
              </div>
              <div className="pet-card-footer">
                <button type="button" className="ghost sm" onClick={() => openEdit(pet)}><Pencil size={15} /> Editar</button>
                <button type="button" className="ghost sm danger-text" onClick={() => setDeleteTarget(pet)}><Trash2 size={15} /> Eliminar</button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="pets-empty-state">
          <div className="pets-empty-emojis" aria-hidden="true">🐶 🐱</div>
          <h2>Todavía no tenés mascotas registradas</h2>
          <p className="muted">Registrá a tu compañero para administrar su información y solicitar turnos.</p>
          <button type="button" className="primary" onClick={openCreate}><Plus size={18} /> Registrar mascota</button>
        </div>
      )}

      {modal && (
        <div className="modal-bg" role="dialog" aria-modal="true" aria-labelledby="modal-pet-title">
          <form className="modal" onSubmit={handleSubmit(save)}>
            <button type="button" className="close" onClick={closeModal} aria-label="Cerrar modal"><X /></button>
            <h2 id="modal-pet-title">{editingPet ? `Editar a ${editingPet.nombre}` : '🐾 Registrar mascota'}</h2>
            <ImageUpload label="Foto de la mascota" initialUrl={editingPet?.foto_url} onFileSelect={setImageFile} helperText="Formatos: JPG, JPEG, PNG o WEBP (máx. 5 MB)" />
            <label htmlFor="pet-nombre">Nombre de la mascota<input id="pet-nombre" {...register('nombre', { validate: (v) => validatePetName(v) || true })} aria-invalid={!!errors.nombre} />{errors.nombre && <small className="field-error">{errors.nombre.message}</small>}</label>
            <label htmlFor="pet-especie">Especie<select id="pet-especie" {...register('especie_id', { required: 'Seleccioná una especie' })} aria-invalid={!!errors.especie_id}><option value="">Seleccionar especie</option>{species.map((item) => <option value={item.id} key={item.id}>{getEspecieEmoji(item.nombre)} {item.nombre}</option>)}</select>{errors.especie_id && <small className="field-error">{errors.especie_id.message}</small>}</label>
                        <label htmlFor="pet-raza">Raza <span className="optional">(opcional)</span><input id="pet-raza" list="breed-suggestions" placeholder="Ej: Labrador" maxLength={80} {...register('raza')} /><datalist id="breed-suggestions">{breeds.map((breed) => <option key={breed.id} value={breed.nombre} />)}</datalist></label>            <div className="form-grid">
              <label htmlFor="pet-sexo">Sexo<select id="pet-sexo" {...register('sexo', { required: 'Seleccioná el sexo' })}><option value="Macho">Macho</option><option value="Hembra">Hembra</option></select></label>
              <label htmlFor="pet-fecha">Fecha de nacimiento <span className="optional">(opcional)</span><input id="pet-fecha" type="date" {...register('fecha_nacimiento')} /></label>
            </div>
            <label htmlFor="pet-peso">Peso (kg) <span className="optional">(opcional)</span><input id="pet-peso" type="number" step="0.1" min="0.1" max="300" {...register('peso')} /></label>
            <button type="submit" className="primary" disabled={submitting}>{submitting ? 'Guardando…' : editingPet ? 'Guardar cambios' : 'Guardar mascota'}</button>
          </form>
        </div>
      )}

      <ConfirmDialog open={!!deleteTarget} title="Eliminar mascota" message={`¿Estás seguro de que querés quitar a "${deleteTarget?.nombre}" de tus mascotas? La mascota dejará de aparecer en tu cuenta, pero su historial se conservará.`} confirmLabel="Eliminar" danger loading={deleting} onConfirm={confirmDelete} onCancel={() => setDeleteTarget(null)} />
    </section>
  );
}