// La pantalla del administrador que permite consultar, filtrar y ver en detalle
//  todas las mascotas registradas en la clínica veterinaria.
import { useEffect, useState } from 'react';
import { HeartPulse, Search } from 'lucide-react';
import { adminService } from '../../services/adminService';
import { petService, type Especie } from '../../services/petService';
import { getErrorMessage } from '../../services/api';
import type { AdminPet } from '../../types';
import { calcEdad } from '../../utils/fechas';
import StatusBadge from '../../components/StatusBadge';
import PageState from '../../components/PageState';
import { getAssetUrl } from '../../utils/assets';

export default function AdminPetsPage() {
  const [mascotas, setMascotas] = useState<AdminPet[]>([]);
  const [species, setSpecies] = useState<Especie[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [especieFilter, setEspecieFilter] = useState('');
  const [activoFilter, setActivoFilter] = useState<'' | '1' | '0'>('');
  const [sort, setSort] = useState<'nombre_asc' | 'nombre_desc' | 'recientes' | 'antiguos' | 'edad_desc' | 'edad_asc'>('recientes');

  // Solicita filtros y orden al servidor para trabajar con un único conjunto consistente.
  const loadPets = async () => {
    try {
      setError('');
      const [petsData, speciesData] = await Promise.all([
        adminService.getMascotas({
          q: search || undefined,
          especie: especieFilter || undefined,
          activo: activoFilter as '' | '1' | '0' | undefined,
          sort,
        }),
        petService.getSpecies().catch(() => []),
      ]);
      setMascotas(petsData);
      setSpecies(speciesData);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPets();
  }, [especieFilter, activoFilter, sort]);

  // La búsqueda se ejecuta al enviar el formulario; los selects recargan automáticamente.
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadPets();
  };
// Renderiza la página de administración de mascotas con filtros, 
// tabla de resultados y estado de carga/error.
  return (
    <section className="page admin-page">
      <span className="eyebrow">ADMINISTRACIÓN</span>
      <h1>Mascotas registradas</h1>
      <p className="muted">Listado general de pacientes y mascotas de todos los clientes.</p>

      {/* Filtros */}
      <div className="filters-card">
        <form className="filters" onSubmit={handleSearch}>
          <div className="search-field">
            <Search size={16} aria-hidden="true" />
            <input
              type="search"
              placeholder="Buscar por nombre de mascota o propietario…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Buscar mascotas"
            />
          </div>

          <select
            value={especieFilter}
            onChange={(e) => setEspecieFilter(e.target.value)}
            aria-label="Filtrar por especie"
          >
            <option value="">Todas las especies</option>
            {species.map((sp) => (
              <option key={sp.id} value={sp.nombre}>
                {sp.nombre}
              </option>
            ))}
          </select>

          <select
            value={activoFilter}
            onChange={(e) => setActivoFilter(e.target.value as '' | '1' | '0')}
            aria-label="Filtrar por estado"
          >
            <option value="">Todas (activas e inactivas)</option>
            <option value="1">Solo activas</option>
            <option value="0">Solo inactivas</option>
          </select>

          <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} aria-label="Ordenar mascotas">
            <option value="nombre_asc">Nombre A-Z</option>
            <option value="nombre_desc">Nombre Z-A</option>
            <option value="recientes">Más recientes</option>
            <option value="antiguos">Más antiguos</option>
            <option value="edad_desc">Edad mayor-menor</option>
            <option value="edad_asc">Edad menor-mayor</option>
          </select>
          <button type="submit" className="primary sm">
            Buscar
          </button>
        </form>
      </div>

      {loading ? (
        <PageState type="loading" />
      ) : error ? (
        <PageState type="error" message={error} />
      ) : mascotas.length ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Especie</th>
                <th>Raza</th>
                <th>Edad</th>
                <th>Sexo</th>
                <th>Propietario</th>
                <th>Estado mascota</th>
                <th>Estado dueño</th>
              </tr>
            </thead>
            <tbody>
              {mascotas.map((m) => (
                <tr key={m.id}>
                  <td data-label="Nombre">
                    <div className="table-pet-cell">
                      {m.foto_url ? (
                        <img
                          src={getAssetUrl(m.foto_url)}
                          alt={`Foto de ${m.nombre}`}
                          className="table-pet-thumb"
                        />
                      ) : (
                        <HeartPulse size={16} className="brand-icon" aria-hidden="true" />
                      )}
                      <b>{m.nombre}</b>
                    </div>
                  </td>
                  <td data-label="Especie">{m.especie}</td>
                  <td data-label="Raza">{m.raza || '—'}</td>
                  <td data-label="Edad">{calcEdad(m.fecha_nacimiento)}</td>
                  <td data-label="Sexo">{m.sexo}</td>
                  <td data-label="Propietario"><b>{m.propietario}</b></td>
                  <td data-label="Estado mascota">
                    <StatusBadge estado={m.activo === false || m.activo === 0 ? 'Inactivo' : 'Activo'} />
                  </td>
                  <td data-label="Estado dueño">
                    <StatusBadge estado={m.estado || 'Activo'} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <PageState type="empty" message="No se encontraron mascotas registradas con los filtros ingresados." />
      )}
    </section>
  );
}
