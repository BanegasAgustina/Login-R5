// Formatea fechas de la API a presentación humana en español (Argentina).
const TZ = 'America/Argentina/Buenos_Aires';

function parseDate(value: string): Date | null {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatFecha(value: string): string {
  const date = parseDate(value);
  if (!date) return value;
  return date.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: TZ });
}

export function formatHora(value: string): string {
  if (!value) return '';
  const parts = value.split(':');
  if (parts.length >= 2) return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')} hs`;
  return `${value} hs`;
}

export function formatFechaHora(fecha: string, hora?: string): string {
  if (!fecha) return '—';
  const f = formatFecha(fecha);
  if (hora) {
    return `${f} - ${formatHora(hora)}`;
  }
  // Si fecha incluye hora (ISO string)
  const d = parseDate(fecha);
  if (d && fecha.includes('T')) {
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    return `${f} - ${h}:${m} hs`;
  }
  return f;
}

export function calcEdad(fechaNacimiento?: string): string {
  if (!fechaNacimiento) return '—';
  const nac = parseDate(fechaNacimiento);
  if (!nac) return '—';
  const hoy = new Date();
  let años = hoy.getFullYear() - nac.getFullYear();
  const mes = hoy.getMonth() - nac.getMonth();
  if (mes < 0 || (mes === 0 && hoy.getDate() < nac.getDate())) años -= 1;
  return años >= 0 ? `${años} año${años === 1 ? '' : 's'}` : '—';
}

export function hoyISO(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
