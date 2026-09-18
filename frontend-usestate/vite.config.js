import { defineConfig, loadEnv } from 'vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const backendDir = fileURLToPath(new URL('../backend/', import.meta.url));
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, path.resolve(backendDir), '');
  const target = env.BACKEND_URL || `http://127.0.0.1:${env.PORT || '3000'}`;
  return { server: { proxy: { '/api': { target, changeOrigin: true }, '/uploads': { target, changeOrigin: true } } } };
});
