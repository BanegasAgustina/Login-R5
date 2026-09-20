/**
 * Selección y validación previa de imágenes.
 *
 * handleFileChange llama validateImageFile, crea una URL temporal y notifica onFileSelect.
 * handleRemove elimina selección. Los efectos sincronizan initialUrl y liberan ObjectURL.
 *
 * Motivo y límites: Evita subir un archivo que ya incumple reglas visibles y libera memoria de
 * las previsualizaciones. El componente no realiza el POST ni verifica bytes de imagen.
 *
 * Guía: docs/BRIEFING_AUTENTICACION_AUTORIZACION_VALIDACIONES.md
 */
// Componente de carga de imágenes con previsualización y validación.
//es el componente encargado de seleccionar, validar, previsualizar, 
// cambiar y eliminar imágenes dentro de la interfaz.
import { useEffect, useRef, useState } from 'react';
import { Upload, Trash2, Image as ImageIcon } from 'lucide-react';
import { validateImageFile } from '../utils/validators';
import { getAssetUrl } from '../utils/assets';

type Props = {
  label: string;
  initialUrl?: string | null;
  onFileSelect: (file: File | null) => void;
  disabled?: boolean;
  className?: string;
  helperText?: string;
};

export default function ImageUpload({
  label,
  initialUrl = null,
  onFileSelect,
  disabled = false,
  className = '',
  helperText = 'Formatos: JPG, PNG o WEBP (máx. 5 MB)',
}: Props) {
  const [preview, setPreview] = useState<string | null>(initialUrl ? getAssetUrl(initialUrl) : null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const objectUrlRef = useRef<string | null>(null);

  // Limpiar objeto URL al desmontar para evitar fugas de memoria
  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
    };
  }, []);

  // Sincronizar si cambia initialUrl externo
  useEffect(() => {
    if (!objectUrlRef.current) {
      setPreview(initialUrl ? getAssetUrl(initialUrl) : null);
    }
  }, [initialUrl]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validationErr = validateImageFile(file);
    if (validationErr) {
      setError(validationErr);
      if (inputRef.current) inputRef.current.value = '';
      return;
    }

    setError(null);
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
    }

    const newObjUrl = URL.createObjectURL(file);
    objectUrlRef.current = newObjUrl;
    setPreview(newObjUrl);
    onFileSelect(file);
  };
// Elimina la imagen seleccionada y limpia el estado.
  const handleRemove = () => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    setPreview(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = '';
    onFileSelect(null);
  };

  const handleTriggerClick = () => {
    inputRef.current?.click();
  };
// Renderiza el componente de carga de imágenes con previsualización y validación.
  return (
    <div className={`image-upload-wrapper ${className}`.trim()}>
      <span className="image-upload-label">{label}</span>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        style={{ display: 'none' }}
        onChange={handleFileChange}
        disabled={disabled}
        aria-label={label}
      />

      {preview ? (
        <div className="image-preview-card">
          <div className="image-preview-frame">
            <img src={preview} alt="Previsualización" className="image-preview-img" />
          </div>
          <div className="image-preview-actions">
            <button
              type="button"
              className="ghost sm"
              onClick={handleTriggerClick}
              disabled={disabled}
              aria-label={`Cambiar ${label.toLowerCase()}`}
            >
              <Upload size={14} aria-hidden="true" /> Cambiar imagen
            </button>
            <button
              type="button"
              className="ghost sm danger-text"
              onClick={handleRemove}
              disabled={disabled}
              aria-label={`Eliminar ${label.toLowerCase()}`}
            >
              <Trash2 size={14} aria-hidden="true" /> Eliminar
            </button>
          </div>
        </div>
      ) : (
        <div
          className="image-dropzone"
          onClick={handleTriggerClick}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleTriggerClick();
            }
          }}
          tabIndex={disabled ? -1 : 0}
          role="button"
          aria-label={`Seleccionar archivo para ${label}`}
        >
          <div className="dropzone-icon" aria-hidden="true">
            <ImageIcon size={26} />
          </div>
          <span className="dropzone-action">Seleccionar imagen</span>
          <small className="muted">{helperText}</small>
        </div>
      )}

      {error && <small className="field-error" role="alert">{error}</small>}
    </div>
  );
}
