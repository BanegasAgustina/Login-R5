/**
 * Carga del entorno.
 *
 * dotenv carga backend/.env mediante una ruta relativa a import.meta.url, convertida con
 * fileURLToPath.
 *
 * Motivo y límites: La ruta no depende del directorio desde el que se inicia Node. Las
 * variables ya inyectadas en process.env se conservan; no se usa override.
 *
 * Guía: docs/BRIEFING_AUTENTICACION_AUTORIZACION_VALIDACIONES.md
 */
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';

// Configuración compartida, independiente del adaptador de persistencia.
// No sobrescribe variables inyectadas por el host de producción.
dotenv.config({ path: fileURLToPath(new URL('../../.env', import.meta.url)) });
