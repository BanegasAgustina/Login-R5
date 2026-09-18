type Props = {
  name?: string;
  size?: number;
  className?: string;
};
// Devuelve las iniciales de un nombre completo, o 'U' si no hay nombre.
function getInitials(name?: string): string {
  if (!name || !name.trim()) return 'U';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.length === 1
    ? parts[0].slice(0, 2).toUpperCase()
    : (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// PetCare no almacena ni muestra fotos de perfil: las iniciales identifican a cada usuario.
export default function Avatar({ name = '', size = 40, className = '' }: Props) {
  const initials = getInitials(name);
  return (
    <div
      className={`avatar-container avatar-initials ${className}`.trim()}
      style={{ width: size, height: size, fontSize: Math.max(12, Math.floor(size * 0.4)) }}
      role="img"
      aria-label={`Avatar con iniciales ${initials}`}
      title={name}
    >
      <span>{initials}</span>
    </div>
  );
}