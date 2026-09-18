import './config/environment.js';
import express from 'express';
import cors from 'cors';
import authRoutes from './routes/authRoutes.js';
// El router OAuth extiende las rutas locales sin reemplazar login/registro.
import oauthRoutes from './routes/oauthRoutes.js';
import petRoutes from './routes/petRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import uploadRoutes from './routes/uploadRoutes.js';
import { securityHeaders } from './middleware/security.js';
import { frontendOrigin } from './config/oauth.js';
import { uploadsDirectory } from './config/uploads.js';

const app = express();

app.set('trust proxy', 1);
app.use(securityHeaders);
app.use(cors({
  origin: process.env.CLIENT_URL || frontendOrigin(),
  credentials: true,
}));
app.use(express.json({ limit: '100kb' }));

// Servir archivos subidos estáticamente de forma segura
app.use('/uploads', express.static(uploadsDirectory));

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/auth', authRoutes);
app.use('/api/auth', oauthRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api', petRoutes);

// Respuesta consistente para rutas inexistentes.
app.use((_req, res) => {
  res.status(404).json({ message: 'Recurso no encontrado.' });
});

// Manejo centralizado de errores no controlados sin exponer datos internos
app.use((error, _req, res, _next) => {
  console.error('[API Error]', error.message || error);
  const status = error.status || 500;
  res.status(status).json({
    success: false,
    message: error.expose ? error.message : 'Ocurrió un error en el servidor.',
  });
});

export { app };
export default app;
