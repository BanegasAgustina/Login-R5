import mysql from 'mysql2/promise';
import './environment.js';

function fromPublicUrl(value) {
  if (!value) return {};
  const url = new URL(value);
  if (url.protocol !== 'mysql:') throw new Error('DB_URL debe usar el protocolo mysql://');
  return {
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.slice(1)),
  };
}

const urlConfig = fromPublicUrl(process.env.MYSQL_PUBLIC_URL);
const host = urlConfig.host || process.env.DB_HOST?.trim();
const port = urlConfig.port || Number(String(process.env.DB_PORT || 3306).trim());

// El pool y las conexiones directas comparten exactamente esta configuración.
export const databaseConfig = {
  host,
  port,
  user: urlConfig.user || process.env.DB_USER,
  password: urlConfig.password || process.env.DB_PASSWORD,
  database: urlConfig.database || process.env.DB_NAME,
  connectTimeout: Number(process.env.DB_CONNECT_TIMEOUT || 30000),
  waitForConnections: true,
  connectionLimit: 10,
};

console.info('[MySQL config]', {
  host: databaseConfig.host,
  port: databaseConfig.port,
  database: databaseConfig.database,
  sslEnabled: Boolean(databaseConfig.ssl),
  connectTimeout: databaseConfig.connectTimeout,
  userConfigured: Boolean(databaseConfig.user),
  passwordConfigured: Boolean(databaseConfig.password),
});

// El pool reutiliza conexiones y evita crear una conexión nueva en cada consulta.
export const pool = mysql.createPool(databaseConfig);

export async function checkDatabaseConnection() {
  const connection = await mysql.createConnection(databaseConfig);
  try {
    const [rows] = await connection.query('SELECT 1');
    return rows;
  } finally {
    await connection.end();
  }
}
