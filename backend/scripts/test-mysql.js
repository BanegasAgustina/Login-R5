/**
 * Diagnóstico de conexión.
 *
 * Carga backend/.env y arma configuración DB_*. Prueba createConnection, SELECT 1 y estado TLS;
 * solo si funciona prueba el pool real. Acepta un puerto de diagnóstico y registra errores
 * mediante mensajes limitados.
 *
 * Motivo y límites: No modifica datos. La conexión manual usa DB_* mientras el pool puede
 * priorizar MYSQL_PUBLIC_URL; esa diferencia importa al interpretar un diagnóstico.
 *
 * Guía: docs/BRIEFING_AUTENTICACION_AUTORIZACION_VALIDACIONES.md
 */
import mysql from 'mysql2/promise';
import { fileURLToPath } from 'node:url';
import '../src/config/environment.js';

// Diagnóstico de solo lectura. No registra URLs, credenciales ni errores SQL completos.
const portArgument = process.argv.find(arg => arg.startsWith('--port='));
const config = {
  host: process.env.DB_HOST,
  port: Number(portArgument?.slice(7) || process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  connectTimeout: 30000,
};
const messages = {
  ETIMEDOUT: 'La conexión al host/puerto agotó el tiempo de espera.',
  ECONNREFUSED: 'El destino rechazó la conexión TCP.',
  ER_ACCESS_DENIED_ERROR: 'El servidor MySQL rechazó la autenticación.',
  HANDSHAKE_SSL_ERROR: 'No se pudo establecer TLS con validación de certificado.',
};
function failure(stage, error) {
  console.error(stage, {
    code: error.code, errno: error.errno, syscall: error.syscall,
    sqlState: error.sqlState, fatal: error.fatal,
    message: messages[error.code] || 'Falló el diagnóstico; detalle omitido para proteger secretos.',
  });
  process.exitCode = 1;
}
console.log('ENV', { path: fileURLToPath(new URL('../.env', import.meta.url)),
  host: config.host, port: config.port, database: config.database,
  userConfigured: Boolean(config.user), passwordConfigured: Boolean(config.password) });
console.log('URL configured', Object.fromEntries(['MYSQL_PUBLIC_URL', 'MYSQL_URL', 'DATABASE_URL'].map(key => [key, Boolean(process.env[key])])));
let connection;
let connected = false;
try {
  connection = await mysql.createConnection(config);
  console.log('MYSQL CONNECTION OK');
  const [rows] = await connection.query({ sql: 'SELECT 1 AS ok', timeout: 30000 });
  if (rows[0]?.ok !== 1) throw new Error('SELECT_ONE_FAILED');
  console.log('SELECT 1 OK');
  const [ssl] = await connection.query("SHOW SESSION STATUS LIKE 'Ssl_cipher'");
  console.log('TLS', { negotiated: Boolean(ssl[0]?.Value) });
  connected = true;
} catch (error) { failure('CREATECONNECTION / SELECT 1 FAIL', error); }
finally { if (connection) await connection.end(); }

if (connected && !portArgument) {
  const { pool } = await import('../src/config/database.js');
  let pooled;
  try {
    pooled = await pool.getConnection();
    console.log('POOL CONNECTION OK');
    const [rows] = await pooled.query({ sql: 'SELECT 1 AS ok', timeout: 30000 });
    if (rows[0]?.ok !== 1) throw new Error('POOL_SELECT_ONE_FAILED');
    console.log('POOL SELECT 1 OK');
  } catch (error) { failure('POOL FAIL', error); }
  finally { if (pooled) pooled.release(); await pool.end(); }
}
