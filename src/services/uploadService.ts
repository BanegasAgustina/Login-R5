/**
 * Envío multipart de imágenes.
 *
 * uploadImage incorpora el archivo en FormData bajo imagen, llama /uploads/mascota y devuelve
 * la URL relativa.
 *
 * Motivo y límites: Mantiene separado el transporte de la selección y previsualización. El
 * backend verifica tamaño, formato y firma.
 *
 * Guía: docs/BRIEFING_AUTENTICACION_AUTORIZACION_VALIDACIONES.md
 */
import api from './api';

export const uploadService = {
  /**
   * Sube una imagen de mascota al backend.
   * Valida en el servidor formato (JPG, PNG, WEBP) y tamaño máximo (5 MB).
   * Devuelve la URL relativa del archivo guardado (ej: /uploads/mascotas/xyz.jpg).
   */
  uploadImage: async (file: File, type: 'mascota'): Promise<string> => {
    const formData = new FormData();
    formData.append('imagen', file);

    const { data } = await api.post<{ url: string; message: string }>(
      `/uploads/${type}`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      },
    );

    return data.url;
  },
};
