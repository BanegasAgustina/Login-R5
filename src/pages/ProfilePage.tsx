//Es la pantalla donde el usuario puede ver sus datos personales, su rol y el estado de su cuenta dentro de PetCare.
import { Mail, Shield, Calendar, Activity, Phone } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { formatFecha } from "../utils/fechas";
import StatusBadge from "../components/StatusBadge";
// Componente de la página de perfil que muestra información del usuario autenticado.
export default function ProfilePage() {
  const { usuario } = useAuth();

  if (!usuario) return null;
// Renderiza la información del perfil del usuario, incluyendo nombre, correo, rol, estado y detalles adicionales.
  return (
    <section className="page profile-page">
      <span className="eyebrow">MI CUENTA</span>
      <h1>Perfil de usuario</h1>
      <p className="muted">Información personal y detalles de tu cuenta.</p>

      <div className="profile-card">
        <div className="profile-header">
          <div className="profile-title">
            <h2>
              {usuario.nombre} {usuario.apellido}
            </h2>
            <div className="profile-badges">
              <span className="badge badge-confirmed">{usuario.rol}</span>
              <StatusBadge estado={usuario.estado || "Activo"} />
            </div>
          </div>
        </div>

        <div className="profile-details-grid">
          <div className="profile-item">
            <div className="profile-item-icon" aria-hidden="true">
              <Mail size={18} />
            </div>
            <div>
              <small className="muted">Correo electrónico</small>
              <p>
                {/* Una identidad externa válida puede no compartir su correo. */}
                <strong>{usuario.email || 'No proporcionado por el proveedor'}</strong>
              </p>
            </div>
          </div>

          <div className="profile-item">
            <div className="profile-item-icon" aria-hidden="true">
              <Shield size={18} />
            </div>
            <div>
              <small className="muted">Rol en el sistema</small>
              <p>
                <strong>{usuario.rol}</strong>
              </p>
            </div>
          </div>

          <div className="profile-item">
            <div className="profile-item-icon" aria-hidden="true">
              <Activity size={18} />
            </div>
            <div>
              <small className="muted">Estado de la cuenta</small>
              <p>
                <strong>{usuario.estado || "Activo"}</strong>
              </p>
            </div>
          </div>

          {usuario.telefono && (
            <div className="profile-item">
              <div className="profile-item-icon" aria-hidden="true">
                <Phone size={18} />
              </div>
              <div>
                <small className="muted">Teléfono de contacto</small>
                <p>
                  <strong>{usuario.telefono}</strong>
                </p>
              </div>
            </div>
          )}

          {usuario.fechaCreacion && (
            <div className="profile-item">
              <div className="profile-item-icon" aria-hidden="true">
                <Calendar size={18} />
              </div>
              <div>
                <small className="muted">Miembro desde</small>
                <p>
                  <strong>{formatFecha(usuario.fechaCreacion)}</strong>
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
