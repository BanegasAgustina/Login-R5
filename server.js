// Punto de entrada del servidor Node/Express en la raíz del proyecto.
// Importa y ejecuta la API modular de PetCare configurada en backend/src/server.js.
import { server } from './backend/src/server.js';

// Mantiene el servidor en ejecución activa
process.stdin.resume();

process.on('SIGINT', () => {
  server.close(() => process.exit(0));
});
