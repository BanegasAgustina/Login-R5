// Componente de estado de página que muestra mensajes y iconos para los estados de carga, vacío y error.
//sirve para mostrarle al usuario de forma clara qué está pasando cuando una página está cargando, no tiene datos o tuvo un error.
import type { ReactNode } from 'react';
import { AlertCircle, Inbox, Loader2 } from 'lucide-react';

type Props = {
  type: 'loading' | 'empty' | 'error';
  message?: string;
  children?: ReactNode;
};

// Estados visuales reutilizables para listados y páginas.
export default function PageState({ type, message, children }: Props) {
  const defaults = {
    loading: 'Estamos cargando los datos…',
    empty: 'No hay datos para mostrar.',
    error: 'No se pudieron cargar los datos.',
  };

  const icons = {
    loading: <Loader2 className="spin" aria-hidden="true" />,
    empty: <Inbox aria-hidden="true" />,
    error: <AlertCircle aria-hidden="true" />,
  };

  return (
    <div className={`page-state state-${type}`} role="status">
      {icons[type]}
      <p>{message || defaults[type]}</p>
      {children}
    </div>
  );
}
