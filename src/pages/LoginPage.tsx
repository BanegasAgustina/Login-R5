import { USER_TYPES, hasUserType } from '../auth/userTypes';
//es la pantalla encargada de autenticar al usuario, validar sus datos y 
// llevarlo automáticamente a la sección correspondiente según su rol.
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { HeartPulse } from 'lucide-react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import registerImage from '../assets/register-veterinaria.png';
import { useAuth } from '../context/AuthContext';
import PasswordInput from '../components/PasswordInput';
import { getErrorMessage } from '../services/api';
import PageState from '../components/PageState';
// Los botones agregan acceso externo sin tocar la validación del formulario local.
import OAuthButtons from '../components/OAuthButtons';
import '../styles/oauth.css';

// Solo mostramos mensajes propios; nunca renderizamos error_description del proveedor.
const oauthErrors: Record<string, string> = {
  OAUTH_STATE: 'El intento venció o no corresponde a este navegador. Volvé a intentarlo.',
  OAUTH_EMAIL_CONFLICT: 'Ese correo ya pertenece a una cuenta. Ingresá con su método habitual; por seguridad no vinculamos cuentas automáticamente.',
  OAUTH_INACTIVE: 'La cuenta está inactiva. Contactá al administrador.',
  OAUTH_CANCELLED: 'Cancelaste el acceso con el proveedor. Podés volver a intentarlo.',
  OAUTH_NOT_CONFIGURED: 'Este proveedor todavía no está configurado.',
  OAUTH_FAILED: 'No se pudo completar el acceso externo. Intentá nuevamente o usá tu cuenta habitual.',
};

type LoginData = { email: string; password: string };
// Componente de la página de login que maneja la autenticación del usuario y redirige según su rol.
export default function LoginPage() {
  const { register, handleSubmit, formState: { errors } } = useForm<LoginData>();
  const { login, usuario, loading } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState(() => {
    const code = new URLSearchParams(window.location.search).get('oauth_error') || '';
    if (import.meta.env.DEV && code) console.info('[OAuth] frontend error:', code);
    return oauthErrors[code] || '';
  });
  const [submitting, setSubmitting] = useState(false);

  if (loading) return <PageState type="loading" message="Verificando sesión…" />;
  if (usuario) return <Navigate to={hasUserType(usuario, USER_TYPES.ADMIN) ? '/admin' : '/'} replace />;
// Maneja el envío del formulario de login, llama al servicio de autenticación y redirige según el rol del usuario.
  const submit = async (data: LoginData) => {
    try {
      setError('');
      setSubmitting(true);
      const loggedUser = await login(data.email, data.password);
      navigate(hasUserType(loggedUser, USER_TYPES.ADMIN) ? '/admin' : '/', { replace: true });
    } catch (err) {
      setError(getErrorMessage(err, 'El email o la contraseña son incorrectos.'));
    } finally {
      setSubmitting(false);
    }
  };
// Renderiza la página de login con formulario, validaciones y mensajes de error.
  return (
    <div className="auth-page">
      <section className="login-panel">
        <div className="login-image-wrap">
          <img
            className="login-image"
            src={registerImage}
            alt="Equipo veterinario con mascotas"
          />
          <div className="login-image-caption">
            <HeartPulse aria-hidden="true" />
            <span>Cuidamos a quienes más querés</span>
          </div>
        </div>

        <form className="auth-card login-form" onSubmit={handleSubmit(submit)} noValidate>
          <div className="brand mark"><HeartPulse aria-hidden="true" /> PetCare</div>
          <h1>Bienvenido de nuevo</h1>
          <p>Ingresá para cuidar mejor a quienes más querés.</p>

          {error && (
            <div className="alert" role="alert">{error}</div>
          )}

          <label htmlFor="email">
            Email
            <input
              id="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="nombre@email.com"
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? 'email-error' : undefined}
              {...register('email', {
                required: 'Ingresá tu email',
                pattern: {
                  value: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
                  message: 'Ingresá un email válido con dominio completo (ej: usuario@gmail.com)',
                },
              })}
            />
          </label>
          {errors.email && <small id="email-error" className="field-error">{errors.email.message}</small>}

          <label htmlFor="password">
            Contraseña
            <PasswordInput
              id="password"
              autoComplete="current-password"
              placeholder="••••••••"
              aria-invalid={!!errors.password}
              aria-describedby={errors.password ? 'password-error' : undefined}
              {...register('password', { required: 'Ingresá tu contraseña' })}
            />
          </label>
          {errors.password && <small id="password-error" className="field-error">{errors.password.message}</small>}

          <button className="primary" type="submit" disabled={submitting}>
            {submitting ? 'Ingresando…' : 'Iniciar sesión'}
          </button>

          <p className="center">
            ¿No tenés cuenta? <Link to="/registro">Registrate</Link>
          </p>
          {/* type="button" impide que OAuth envíe el formulario de email/contraseña. */}
          <OAuthButtons />
        </form>
      </section>
    </div>
  );
}
