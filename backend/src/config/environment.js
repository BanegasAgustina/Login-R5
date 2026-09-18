import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';

// Configuración compartida, independiente del adaptador de persistencia.
// No sobrescribe variables inyectadas por el host de producción.
dotenv.config({ path: fileURLToPath(new URL('../../.env', import.meta.url)) });
