/**
 * Destino de imágenes.
 *
 * uploadsDirectory usa UPLOADS_DIR si existe o backend/uploads como valor por defecto.
 *
 * Motivo y límites: Centraliza la ruta para que el router de carga y Express sirvan el mismo
 * directorio. La persistencia depende del almacenamiento del despliegue.
 *
 * Guía: docs/BRIEFING_AUTENTICACION_AUTORIZACION_VALIDACIONES.md
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import './environment.js';

// Mismo directorio local; un host con disco persistente puede configurar otro.
// /tmp de serverless NO es almacenamiento persistente para fotos.
export const uploadsDirectory = process.env.UPLOADS_DIR
  ? path.resolve(process.env.UPLOADS_DIR)
  : fileURLToPath(new URL('../../uploads/', import.meta.url));
