// Helper para resolver URLs de imágenes y assets de PetCare

const API_URL = import.meta.env.VITE_API_URL || '/api';
const SERVER_ORIGIN = API_URL.replace(/\/api\/?$/, '');

/**
 * Resuelve la URL completa para una imagen de la API o blob local.
 */
export function getAssetUrl(path?: string | null): string {
  if (!path) return '';
  if (
    path.startsWith('http://') ||
    path.startsWith('https://') ||
    path.startsWith('blob:') ||
    path.startsWith('data:')
  ) {
    return path;
  }
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${SERVER_ORIGIN}${cleanPath}`;
}
