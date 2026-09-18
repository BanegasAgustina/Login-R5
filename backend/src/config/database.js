import mysql from 'mysql2/promise';
import './environment.js';

// El pool reutiliza conexiones y evita crear una conexión nueva en cada consulta.
export const pool = mysql.createPool({
  host: process.env.DB_HOST,
  // Un puerto explícito permite probar OAuth en una instancia MySQL aislada.
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
});
