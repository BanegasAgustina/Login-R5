// Página de registro de nuevos usuarios, con validación de campos y manejo de errores.
import { useState } from 'react';
import { isAxiosError } from 'axios';
import { useForm } from 'react-hook-form';
import { HeartPulse } from 'lucide-react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import registerImage from '../assets/register-veterinaria.png';
import { authService } from '../services/authService';
import { getErrorMessage } from '../services/api';
import PasswordInput from '../components/PasswordInput';
import { useAuth } from '../context/AuthContext';
import PageState from '../components/PageState';
import {
  validatePersonName,
  validateEmail,
  validatePhone,
  validatePassword,
} from '../utils/validators';
// Define el tipo de datos para el formulario de registro, 
// incluyendo nombre, apellido, email, contraseña y teléfono.
type RegisterData = {
  nombre: string;
  apellido: string;
  email: string;
  password: string;
  confirmPassword: string;
  telefono: string;
};
// Componente principal de la página de registro que maneja la 
// lógica de creación de cuenta y redirección.
export default function RegisterPage() {
  const {
    register,
    handleSubmit,
    watch,
    setError: setFieldError,
    formState: { errors },
  } = useForm<RegisterData>({ mode: 'onTouched' });
  const navigate = useNavigate();
  const { usuario, loading } = useAuth();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);
// Si el usuario ya está autenticado, redirige a la página principal; si está c
// argando, muestra un estado de carga.
  if (loading) return <PageState type="loading" />;
  if (usuario) return <Navigate to="/" replace />;

  const submit = async (data: RegisterData) => {
    try {
      setError('');
      setSuccess('');
      setSubmitting(true);
      await authService.register({
        nombre: data.nombre.trim(),
        apellido: data.apellido.trim(),
        email: data.email.trim(),
        password: data.password,
        telefono: data.telefono ? data.telefono.trim() : undefined,
      });
      setSuccess('Usuario creado correctamente. Redirigiendo al inicio de sesión…');
      setTimeout(() => navigate('/login'), 1500);
    } catch (err) {
      if (isAxiosError(err) && err.response?.status === 409) {
        setFieldError('email', {
          type: 'server',
          message: getErrorMessage(err, 'Este email ya tiene una cuenta en PetCare. Iniciá sesión.'),
        }, { shouldFocus: true });
        return;
      }
      setError(getErrorMessage(err, 'No se pudo crear la cuenta. Intentá nuevamente.'));
    } finally {
      setSubmitting(false);
    }
  };
// Renderiza el formulario de registro con validaciones, 
// mensajes de error y éxito, y enlaces de navegación.
  return (
    <div className="auth-page">
      <section className="login-panel register-panel">
        <div className="login-image-wrap">
          <img
            className="login-image"
            src={registerImage}
            alt="Equipo veterinario con mascotas"
          />
          <div className="login-image-caption">
            <HeartPulse aria-hidden="true" />
            <span>Sumate a PetCare y cuidá a tus compañeros</span>
          </div>
        </div>

        <form className="auth-card login-form" onSubmit={handleSubmit(submit)} noValidate>
          <div className="brand mark">
            <HeartPulse aria-hidden="true" /> PetCare
          </div>
          <h1>Creá tu cuenta</h1>
          <p>Registrate como cliente para gestionar mascotas y turnos.</p>

          {error && (
            <div className="alert" role="alert">
              {error}
            </div>
          )}
          {success && (
            <div className="success" role="status">
              {success}
            </div>
          )}

          <div className="form-grid">
            <label htmlFor="nombre">
              Nombre
              <input
                id="nombre"
                placeholder="Ej: Agustina"
                {...register('nombre', {
                  validate: (v) => validatePersonName(v, 'El nombre') || true,
                })}
                aria-invalid={!!errors.nombre}
              />
              {errors.nombre && <small className="field-error">{errors.nombre.message}</small>}
            </label>

            <label htmlFor="apellido">
              Apellido
              <input
                id="apellido"
                placeholder="Ej: Banegas"
                {...register('apellido', {
                  validate: (v) => validatePersonName(v, 'El apellido') || true,
                })}
                aria-invalid={!!errors.apellido}
              />
              {errors.apellido && <small className="field-error">{errors.apellido.message}</small>}
            </label>
          </div>

          <label htmlFor="reg-email">
            Email
            <input
              id="reg-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="usuario@gmail.com"
              {...register('email', {
                validate: (v) => validateEmail(v) || true,
              })}
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? 'reg-email-error' : undefined}
            />
            {errors.email && <small id="reg-email-error" className="field-error" role="alert">{errors.email.message}</small>}
          </label>

          <label htmlFor="telefono">
            Teléfono <span className="optional">(opcional, 10 a 13 dígitos)</span>
            <input
              id="telefono"
              type="tel"
              inputMode="numeric"
              placeholder="Ej: 2231234567"
              {...register('telefono', {
                validate: (v) => validatePhone(v, false) || true,
              })}
              aria-invalid={!!errors.telefono}
            />
            {errors.telefono && <small className="field-error">{errors.telefono.message}</small>}
          </label>

          <label htmlFor="reg-password">
            Contraseña
            <PasswordInput
              id="reg-password"
              autoComplete="new-password"
              placeholder="••••••••"
              showStrengthMeter
              {...register('password', {
                validate: (v) => validatePassword(v) || true,
              })}
              aria-invalid={!!errors.password}
            />
            {errors.password && <small className="field-error">{errors.password.message}</small>}
          </label>

          <label htmlFor="confirm-password">
            Confirmar contraseña
            <PasswordInput
              id="confirm-password"
              autoComplete="new-password"
              placeholder="••••••••"
              {...register('confirmPassword', {
                required: 'Confirmá tu contraseña',
                validate: (v) => v === watch('password') || 'Las contraseñas no coinciden.',
              })}
              aria-invalid={!!errors.confirmPassword}
            />
            {errors.confirmPassword && (
              <small className="field-error">{errors.confirmPassword.message}</small>
            )}
          </label>

          <button className="primary" type="submit" disabled={submitting}>
            {submitting ? 'Creando cuenta…' : 'Crear cuenta'}
          </button>

          <p className="center">
            ¿Ya tenés cuenta? <Link to="/login">Iniciá sesión</Link>
          </p>
        </form>
      </section>
    </div>
  );
}
