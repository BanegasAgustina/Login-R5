// La pantalla del administrador que permite consultar, filtrar y ver en detalle
//  todos los usuarios de la clínica veterinaria.
import { useEffect, useState } from 'react';
import { Eye, Edit2, Search, Trash2, X, PawPrint } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { adminService, type Role } from '../../services/adminService';
import { getErrorMessage } from '../../services/api';
import type { AdminUser } from '../../types';
import { formatFecha } from '../../utils/fechas';
import PageState from '../../components/PageState';
import StatusBadge from '../../components/StatusBadge';
import ConfirmDialog from '../../components/ConfirmDialog';
import Avatar from '../../components/Avatar';
import { useAuth } from '../../context/AuthContext';
import { validatePersonName, validateEmail } from '../../utils/validators';
// Tipos para el formulario de edición de usuario
type EditFormData = {
  nombre: string;
  apellido: string;
  email: string;
  rolId: number;
};
// Renderiza la página de administración de usuarios con filtros, tabla de resultados
//  y modales para ver, editar, activar/desactivar y eliminar usuarios.
export default function AdminUsersPage() {
  const { usuario: currentUser } = useAuth();
  const [roles, setRoles] = useState<Role[]>([]);
  const [usuarios, setUsuarios] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'alert'; msg: string } | null>(null);

  // Filtros
  const [search, setSearch] = useState('');
  const [rolFilter, setRolFilter] = useState('');
  const [estadoFilter, setEstadoFilter] = useState('');
  const [mascotasFilter, setMascotasFilter] = useState('');
  // El backend ordena para combinar búsqueda, filtro y orden en una misma consulta.
  const [sort, setSort] = useState<'nombre_asc' | 'nombre_desc' | 'recientes' | 'antiguos'>('recientes');

  // Modales
  const [viewUser, setViewUser] = useState<AdminUser | null>(null);
  const [editUser, setEditUser] = useState<AdminUser | null>(null);
  const [confirmToggle, setConfirmToggle] = useState<{ user: AdminUser; newEstadoId: number } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<AdminUser | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<EditFormData>({ mode: 'onTouched' });

  // Centraliza la consulta para que búsqueda, filtros y orden viajen juntos al backend.
  const loadUsers = async () => {
    try {
      setError('');
      const [data, catalog] = await Promise.all([adminService.getUsuarios({
        q: search || undefined,
        rol: rolFilter || undefined,
        estado: estadoFilter || undefined,
        mascotas: mascotasFilter || undefined,
        sort,
      }), adminService.getRoles()]);
      setRoles(catalog);
      setUsuarios(data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, [rolFilter, estadoFilter, mascotasFilter, sort]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadUsers();
  };

  // Precarga el formulario con el usuario seleccionado antes de abrir el modal.
  const openEditModal = (u: AdminUser) => {
    setEditUser(u);
    reset({
      nombre: u.nombre,
      apellido: u.apellido,
      // OAuth puede no compartir correo; el input controlado necesita una cadena.
      email: u.email || '',
      rolId: u.rolId,
    });
  };
// Maneja el envío del formulario de edición; actualiza el usuario y recarga la lista.
  const onEditSubmit = async (data: EditFormData) => {
    if (!editUser) return;
    try {
      setActionLoading(true);
      const res = await adminService.updateUsuario(editUser.id, {
        nombre: data.nombre.trim(),
        // Si OAuth no entregó estos datos, omitirlos conserva su ausencia en BD.
        apellido: data.apellido.trim() || undefined,
        email: data.email.trim() || undefined,
        rolId: Number(data.rolId),
      });
      setFeedback({ type: 'success', msg: res.message || 'Usuario actualizado correctamente.' });
      setEditUser(null);
      await loadUsers();
    } catch (err) {
      setFeedback({
        type: 'alert',
        msg: getErrorMessage(err, 'No se pudo actualizar el usuario. Intentá nuevamente.'),
      });
    } finally {
      setActionLoading(false);
    }
  };
// Maneja la confirmación de activación/desactivación de usuario; 
// actualiza el estado y recarga la lista.
  const handleToggleEstado = async () => {
    if (!confirmToggle) return;
    try {
      setActionLoading(true);
      const res = await adminService.setUsuarioEstado(confirmToggle.user.id, confirmToggle.newEstadoId);
      setFeedback({ type: 'success', msg: res.message });
      setConfirmToggle(null);
      await loadUsers();
    } catch (err) {
      setFeedback({ type: 'alert', msg: getErrorMessage(err) });
    } finally {
      setActionLoading(false);
    }
  };
// Maneja la confirmación de eliminación de usuario; elimina el usuario y recarga la lista.
  const handleDeleteUser = async () => {
    if (!confirmDelete) return;
    try {
      setActionLoading(true);
      const res = await adminService.deleteUsuario(confirmDelete.id);
      setFeedback({ type: 'success', msg: res.message });
      setConfirmDelete(null);
      await loadUsers();
    } catch (err) {
      setFeedback({ type: 'alert', msg: getErrorMessage(err) });
    } finally {
      setActionLoading(false);
    }
  };
// Carga los usuarios desde el backend según los filtros seleccionados y el orden.
  return (
    <section className="page admin-page">
      <span className="eyebrow">ADMINISTRACIÓN</span>
      <h1>Gestión de usuarios</h1>
      <p className="muted">Administrá cuentas, roles, mascotas asociadas y estados de los usuarios en PetCare.</p>

      {feedback && (
        <div className={feedback.type === 'success' ? 'success' : 'alert'} role="status">
          {feedback.msg}
        </div>
      )}

      {/* Controles de Búsqueda y Filtros */}
      <div className="filters-card">
        <form className="filters" onSubmit={handleSearch}>
          <div className="search-field">
            <Search size={16} aria-hidden="true" />
            <input
              type="search"
              placeholder="Buscar por nombre, apellido o email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Buscar usuarios"
            />
          </div>

          <select
            value={rolFilter}
            onChange={(e) => setRolFilter(e.target.value)}
            aria-label="Filtrar por rol"
          >
            <option value="">Todos los roles</option>
            {roles.map(role => <option key={role.id} value={role.nombre}>{role.nombre}</option>)}
          </select>

          <select
            value={estadoFilter}
            onChange={(e) => setEstadoFilter(e.target.value)}
            aria-label="Filtrar por estado"
          >
            <option value="">Todos los estados</option>
            <option value="Activo">Activo</option>
            <option value="Inactivo">Inactivo</option>
          </select>

          <select
            value={mascotasFilter}
            onChange={(e) => setMascotasFilter(e.target.value)}
            aria-label="Filtrar por tenencia de mascotas"
          >
            <option value="">Todas (con y sin mascotas)</option>
            <option value="con">Con mascotas</option>
            <option value="sin">Sin mascotas</option>
          </select>

          <button type="submit" className="primary sm">
            Buscar
          </button>
          <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} aria-label="Ordenar clientes">
            <option value="nombre_asc">Nombre A-Z</option>
            <option value="nombre_desc">Nombre Z-A</option>
            <option value="recientes">Más recientes</option>
            <option value="antiguos">Más antiguos</option>
          </select>
        </form>
      </div>

      {loading ? (
        <PageState type="loading" />
      ) : error ? (
        <PageState type="error" message={error} />
      ) : usuarios.length ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Apellido</th>
                <th>Email</th>
                <th>Rol</th>
                <th>Mascotas</th>
                <th>Estado</th>
                <th>Fecha de creación</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u) => (
                <tr key={u.id}>
                  <td data-label="Usuario">
                    <div className="table-user-cell">
                      <Avatar
                        name={`${u.nombre} ${u.apellido}`}
                        size={32}
                      />
                      <b>{u.nombre}</b>
                    </div>
                  </td>
                  <td data-label="Apellido">{u.apellido}</td>
                  <td data-label="Email">{u.email}</td>
                  <td data-label="Rol">
                    <span className="badge badge-confirmed">{u.rol}</span>
                  </td>
                  <td data-label="Mascotas">
                    {u.mascotas && u.mascotas.length > 0 ? (
                      u.mascotas.length <= 2 ? (
                        <span className="user-pets-text">{u.mascotas.join(', ')}</span>
                      ) : (
                        <span className="user-pets-text" title={u.mascotas.join(', ')}>
                          {u.mascotas.slice(0, 2).join(', ')}{' '}
                          <span className="badge badge-more">+{u.mascotas.length - 2}</span>
                        </span>
                      )
                    ) : (
                      <span className="muted">Sin mascotas</span>
                    )}
                  </td>
                  <td data-label="Estado">
                    <StatusBadge estado={u.estado || 'Activo'} />
                  </td>
                  <td data-label="Fecha creación">
                    {u.fechaCreacion ? formatFecha(u.fechaCreacion) : '—'}
                  </td>
                  <td data-label="Acciones">
                    <div className="row-actions">
                      <button
                        type="button"
                        className="ghost sm"
                        onClick={() => setViewUser(u)}
                        title="Ver detalles"
                        aria-label={`Ver detalles de ${u.nombre} ${u.apellido}`}
                      >
                        <Eye size={14} /> Ver
                      </button>

                      <button
                        type="button"
                        className="ghost sm"
                        onClick={() => openEditModal(u)}
                        title="Editar usuario"
                        aria-label={`Editar ${u.nombre} ${u.apellido}`}
                      >
                        <Edit2 size={14} /> Editar
                      </button>

                      {currentUser?.id !== u.id && (
                        <>
                          <button
                            type="button"
                            className="ghost sm"
                            onClick={() =>
                              setConfirmToggle({
                                user: u,
                                newEstadoId: u.estado === 'Activo' ? 2 : 1,
                              })
                            }
                            aria-label={`${u.estado === 'Activo' ? 'Desactivar' : 'Activar'} a ${u.nombre}`}
                          >
                            {u.estado === 'Activo' ? 'Desactivar' : 'Activar'}
                          </button>

                          <button
                            type="button"
                            className="ghost sm danger-text"
                            onClick={() => setConfirmDelete(u)}
                            title="Eliminar usuario"
                            aria-label={`Eliminar usuario ${u.nombre}`}
                          >
                            <Trash2 size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <PageState type="empty" message="No se encontraron usuarios con los filtros aplicados." />
      )}

      {/* MODAL VER USUARIO */}
      {viewUser && (
        <div className="modal-bg" role="dialog" aria-modal="true" aria-labelledby="view-user-title">
          <div className="modal">
            <button type="button" className="close" onClick={() => setViewUser(null)} aria-label="Cerrar modal">
              <X />
            </button>
            <h2 id="view-user-title">Detalle del usuario</h2>

            <div className="view-user-header">
              <Avatar
                name={`${viewUser.nombre} ${viewUser.apellido}`}
                size={64}
              />
              <div>
                <h3 style={{ margin: '0 0 4px', fontSize: '1.25rem' }}>
                  {viewUser.nombre} {viewUser.apellido}
                </h3>
                <span className="badge badge-confirmed">{viewUser.rol}</span>
              </div>
            </div>

            <div className="detail-list">
              <div>
                <small className="muted">Email:</small>
                <p>{viewUser.email}</p>
              </div>
              <div>
                <small className="muted">Estado de la cuenta:</small>
                <p>
                  <StatusBadge estado={viewUser.estado || 'Activo'} />
                </p>
              </div>
              <div>
                <small className="muted">Mascotas pertenecientes:</small>
                <p>
                  {viewUser.mascotas && viewUser.mascotas.length > 0 ? (
                    <span className="pets-badge-group">
                      <PawPrint size={14} className="brand-icon" aria-hidden="true" />
                      {viewUser.mascotas.join(', ')}
                    </span>
                  ) : (
                    <span className="muted">Sin mascotas registradas</span>
                  )}
                </p>
              </div>
              <div>
                <small className="muted">Fecha de registro:</small>
                <p>{viewUser.fechaCreacion ? formatFecha(viewUser.fechaCreacion) : '—'}</p>
              </div>
            </div>
            <button type="button" className="primary" onClick={() => setViewUser(null)}>
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* MODAL EDITAR USUARIO */}
      {editUser && (
        <div className="modal-bg" role="dialog" aria-modal="true" aria-labelledby="edit-user-title">
          <form className="modal" onSubmit={handleSubmit(onEditSubmit)} noValidate>
            <button type="button" className="close" onClick={() => setEditUser(null)} aria-label="Cerrar modal">
              <X />
            </button>
            <h2 id="edit-user-title">Editar usuario</h2>

            <div className="form-grid">
              <label htmlFor="edit-nombre">
                Nombre
                <input
                  id="edit-nombre"
                  {...register('nombre', {
                    validate: (v) => validatePersonName(v, 'El nombre') || true,
                  })}
                  aria-invalid={!!errors.nombre}
                />
                {errors.nombre && <small className="field-error">{errors.nombre.message}</small>}
              </label>

              <label htmlFor="edit-apellido">
                Apellido
                <input
                  id="edit-apellido"
                  {...register('apellido', {
                    validate: (v) => !v && !editUser?.apellido ? true : validatePersonName(v, 'El apellido') || true,
                  })}
                  aria-invalid={!!errors.apellido}
                />
                {errors.apellido && <small className="field-error">{errors.apellido.message}</small>}
              </label>
            </div>

            <label htmlFor="edit-email">
              Email
              <input
                id="edit-email"
                type="email"
                inputMode="email"
                {...register('email', {
                  validate: (v) => !v && !editUser?.email ? true : validateEmail(v) || true,
                })}
                aria-invalid={!!errors.email}
              />
              {errors.email && <small className="field-error">{errors.email.message}</small>}
            </label>

            <label htmlFor="edit-rol">
              Rol
              <select id="edit-rol" {...register('rolId', { required: 'Seleccioná un rol' })}>
                {roles.map(role => <option key={role.id} value={role.id}>{role.nombre}</option>)}
              </select>
            </label>

            <div className="confirm-actions">
              <button
                type="button"
                className="ghost"
                onClick={() => setEditUser(null)}
                disabled={actionLoading}
              >
                Cancelar
              </button>
              <button type="submit" className="primary" disabled={actionLoading}>
                {actionLoading ? 'Guardando…' : 'Guardar cambios'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* CONFIRM TOGGLE ESTADO */}
      <ConfirmDialog
        open={!!confirmToggle}
        title={confirmToggle?.newEstadoId === 2 ? 'Desactivar usuario' : 'Activar usuario'}
        message={`¿Estás seguro de que deseás ${
          confirmToggle?.newEstadoId === 2 ? 'desactivar' : 'activar'
        } a ${confirmToggle?.user.nombre} ${confirmToggle?.user.apellido}?`}
        confirmLabel={confirmToggle?.newEstadoId === 2 ? 'Desactivar' : 'Activar'}
        danger={confirmToggle?.newEstadoId === 2}
        loading={actionLoading}
        onConfirm={handleToggleEstado}
        onCancel={() => setConfirmToggle(null)}
      />

      {/* CONFIRM DELETE */}
      <ConfirmDialog
        open={!!confirmDelete}
        title="Eliminar usuario"
        message={`¿Confirmás que querés eliminar la cuenta de ${confirmDelete?.nombre} ${confirmDelete?.apellido}? Esta acción eliminará su acceso a la plataforma.`}
        confirmLabel="Eliminar usuario"
        danger
        loading={actionLoading}
        onConfirm={handleDeleteUser}
        onCancel={() => setConfirmDelete(null)}
      />
    </section>
  );
}
