// fs/url leen exclusivamente nuestra migración; el pool usa backend/.env.
import { readFile } from 'node:fs/promises';
import { pool } from '../src/config/database.js';

console.log('[OAuth migration] MySQL configuration', {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  userConfigured: Boolean(process.env.DB_USER),
  passwordConfigured: Boolean(process.env.DB_PASSWORD),
});

// MySQL hace commit implícito de DDL. Cada sentencia es repetible y no borra datos;
// si se interrumpe, se puede volver a ejecutar. No reconstruimos el esquema original.
try {
  const sql = await readFile(new URL('../migrations/001_oauth.sql', import.meta.url), 'utf8');
  // Evita informar éxito si la migración se vació o quedó incompleta.
  if (!sql.includes('CREATE TABLE IF NOT EXISTS oauth_accounts') || !sql.includes('CREATE TABLE IF NOT EXISTS oauth_flows')) {
    throw new Error('La migración OAuth está vacía o incompleta.');
  }
  for (const statement of sql.replace(/--[^\n]*/g, '').split(';').filter(s => s.trim())) {
    await pool.query(statement);
  }
  console.log('Migración OAuth aplicada; usuarios existentes conservados.');
} catch (error) {
  console.error('No se pudo aplicar la migración OAuth:', {
    code: error.code || 'ERROR',
    message: error.message,
    errno: error.errno,
    syscall: error.syscall,
    address: error.address,
    port: error.port,
  });
  process.exitCode = 1;
} finally {
  await pool.end();
}
