// sirve para mostrar los estados de registros de forma visual 
// y diferenciarlos fácilmente mediante colores o estilos.
type Props = { estado: string };

const map: Record<string, string> = {
  Pendiente: 'badge-pending',
  Confirmado: 'badge-confirmed',
  Completado: 'badge-done',
  Cancelado: 'badge-cancelled',
  Activo: 'badge-confirmed',
  Inactivo: 'badge-cancelled',
};

export default function StatusBadge({ estado }: Props) {
  return <span className={`badge ${map[estado] || ''}`}>{estado}</span>;
}
