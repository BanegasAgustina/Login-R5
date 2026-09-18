import path from 'node:path';
import { fileURLToPath } from 'node:url';
import './environment.js';

// Mismo directorio local; un host con disco persistente puede configurar otro.
// /tmp de serverless NO es almacenamiento persistente para fotos.
export const uploadsDirectory = process.env.UPLOADS_DIR
  ? path.resolve(process.env.UPLOADS_DIR)
  : fileURLToPath(new URL('../../uploads/', import.meta.url));
