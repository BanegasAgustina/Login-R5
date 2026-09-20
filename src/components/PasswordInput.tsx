/**
 * Entrada y medidor de contraseña.
 *
 * forwardRef integra el input con React Hook Form. handleChange conserva texto para calcular
 * getPasswordStrength y propaga onChange. El botón alterna visibilidad y el medidor es
 * opcional.
 *
 * Motivo y límites: El medidor comunica reglas al usuario; no genera hashes ni cifra datos.
 * bcrypt se ejecuta en backend.
 *
 * Guía: docs/BRIEFING_AUTENTICACION_AUTORIZACION_VALIDACIONES.md
 */
import { forwardRef, useState } from 'react';
import { Eye, EyeOff, ShieldCheck, ShieldAlert } from 'lucide-react';
import { getPasswordStrength } from '../utils/validators';

type Props = React.InputHTMLAttributes<HTMLInputElement> & {
  showStrengthMeter?: boolean;
};

// Input de contraseña con botón mostrar/ocultar accesible y medidor visual de seguridad opcional.
const PasswordInput = forwardRef<HTMLInputElement, Props>(
  ({ showStrengthMeter = false, onChange, value, defaultValue, className = '', ...props }, ref) => {
    const [visible, setVisible] = useState(false);
    const [currentValue, setCurrentValue] = useState<string>(
      typeof value === 'string' ? value : typeof defaultValue === 'string' ? defaultValue : ''
    );
// Maneja el cambio de valor del input y actualiza el estado local.
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setCurrentValue(e.target.value);
      onChange?.(e);
    };
// Calcula la fuerza de la contraseña actual para mostrar el medidor de seguridad.
    const strength = getPasswordStrength(currentValue);
// Renderiza el input de contraseña con botón de mostrar/ocultar y medidor de seguridad si está habilitado.
    return (
      <div className="password-input-group">
        <div className="password-field">
          <input
            {...props}
            ref={ref}
            value={value}
            defaultValue={defaultValue}
            onChange={handleChange}
            type={visible ? 'text' : 'password'}
            className={`password-input ${className}`.trim()}
          />
          <button
            type="button"
            className="password-toggle"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            title={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            tabIndex={0}
          >
            {visible ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
          </button>
        </div>

        {showStrengthMeter && currentValue.length > 0 && (
          <div className="password-strength-container" aria-live="polite">
            <div className="strength-bar-track">
              <div
                className={`strength-bar-fill strength-${strength.label.toLowerCase()}`}
                style={{
                  width: `${strength.percent}%`,
                  backgroundColor: strength.color,
                }}
              />
            </div>
            <div className="strength-label-row">
              <span className="strength-icon" style={{ color: strength.color }}>
                {strength.score >= 3 ? (
                  <ShieldCheck size={14} aria-hidden="true" />
                ) : (
                  <ShieldAlert size={14} aria-hidden="true" />
                )}
              </span>
              <span className="strength-text" style={{ color: strength.color }}>
                Seguridad: <strong>{strength.label}</strong>
              </span>
            </div>
          </div>
        )}
      </div>
    );
  }
);
// Asigna un nombre al componente para facilitar la depuración y el desarrollo.
PasswordInput.displayName = 'PasswordInput';

export default PasswordInput;
