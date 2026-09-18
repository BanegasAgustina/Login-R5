import { spawn } from 'node:child_process';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from '../src/config/database.js';

// Exporta mediante lecturas y snapshot InnoDB. Nunca importa ni modifica la BD.
// MYSQLDUMP_PATH permite usar el cliente instalado sin guardar credenciales.
const root = fileURLToPath(new URL('../../', import.meta.url));
const directory = path.join(root, 'database', 'exports');
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const output = path.join(directory, `petcare-railway-${stamp}.sql`);
const pending = output + '.partial';
const binary = process.env.MYSQLDUMP_PATH || (process.platform === 'win32' ? 'C:/xampp/mysql/bin/mysqldump.exe' : 'mysqldump');

try {
  await mkdir(directory, { recursive: true });
  const [tables] = await pool.query('SELECT TABLE_NAME, ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = "BASE TABLE" ORDER BY TABLE_NAME');
  if (!tables.length || tables.some(table => table.ENGINE !== 'InnoDB')) {
    throw new Error('Se requiere una base no vacía con tablas InnoDB para este snapshot.');
  }
  const args = [
    '--no-defaults', '--protocol=tcp',
    `--host=${process.env.DB_HOST}`, `--port=${process.env.DB_PORT || 3306}`,
    `--user=${process.env.DB_USER}`, '--single-transaction', '--quick',
    '--skip-lock-tables', '--skip-add-locks', '--skip-add-drop-table',
    '--skip-disable-keys', '--no-tablespaces', '--complete-insert',
    '--skip-extended-insert', '--hex-blob', '--default-character-set=utf8mb4',
    '--routines', '--events', '--triggers', `--result-file=${pending}`, process.env.DB_NAME,
  ];
  await new Promise((resolve, reject) => {
    const child = spawn(binary, args, {
      windowsHide: true,
      env: { ...process.env, MYSQL_PWD: process.env.DB_PASSWORD || '' },
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    let errorText = '';
    child.stderr.on('data', chunk => { errorText += chunk; });
    child.once('error', reject);
    child.once('close', code => code === 0 ? resolve() : reject(new Error(`Exportación fallida (${code}): ${errorText}`)));
  });
  const sql = await readFile(pending, 'utf8');
  if (/^\s*(?:DROP|DELETE|TRUNCATE|ALTER|CREATE DATABASE|USE\s)/im.test(sql)) {
    throw new Error('El export contiene instrucciones no previstas; revisar .partial antes de usarlo.');
  }
  const exportedTables = [...sql.matchAll(/^CREATE TABLE `([^`]+)`/gm)].map(match => match[1]);
  if (exportedTables.length !== tables.length || tables.some(table => !exportedTables.includes(table.TABLE_NAME))) {
    throw new Error('El export no contiene todas las tablas.');
  }
  const rows = Object.fromEntries(exportedTables.map(table => [table, 0]));
  for (const match of sql.matchAll(/^INSERT INTO `([^`]+)`/gm)) rows[match[1]]++;
  await rename(pending, output);
  await writeFile(output + '.manifest.json', JSON.stringify({ createdAt: new Date().toISOString(), tables: exportedTables.length, rows, bytes: Buffer.byteLength(sql), target: 'Importar una sola vez en una base MySQL vacía; no contiene CREATE DATABASE ni USE.' }, null, 2) + '\n');
  console.log(JSON.stringify({ output, tables: exportedTables.length, rows, bytes: Buffer.byteLength(sql) }, null, 2));
} finally {
  await pool.end();
}
