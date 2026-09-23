/**
 * Intentos OAuth de un solo uso.
 *
 * randomSecret produce valores aleatorios; hash usa SHA-256 hexadecimal y challenge SHA-256
 * base64url para PKCE. createFlow guarda hashes de state/browser, verifier y nonce, con
 * vencimiento de 10 minutos. consumeFlow verifica formato, proveedor y navegador dentro de una
 * transacción.
 *
 * Motivo y límites: SELECT FOR UPDATE y DELETE consumen el intento atómicamente.
 * timingSafeEqual compara hashes. La limpieza elimina intentos vencidos; verifier y nonce se
 * guardan como valores, no como los hashes de state/browser.
 *
 * Guía: docs/BRIEFING_AUTENTICACION_AUTORIZACION_VALIDACIONES.md
 */
// crypto genera secretos impredecibles y hashes; el pool persiste intentos breves.
import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import { pool } from '../config/database.js';

export const randomSecret = () => randomBytes(32).toString('base64url');
export const hash = value => createHash('sha256').update(value).digest('hex');
export const challenge = verifier => createHash('sha256').update(verifier).digest('base64url');

function flowDbError(provider, operation, error) {
  console.error(`[OAuth][${provider}][flow] DB query failed`, {
    operation,
    code: error?.code,
    errno: error?.errno,
    sqlState: error?.sqlState,
    syscall: error?.syscall,
  });
}

// state protege contra login CSRF; la cookie liga el intento al navegador que lo
// inició. Conocer solo state (visible en la URL del proveedor) no permite canjearlo.
export async function createFlow(provider, pkce, database = pool) {
  const state = randomSecret();
  const browser = randomSecret();
  const verifier = pkce ? randomSecret() : null;
  const nonce = provider === 'google' ? randomSecret() : null;
  try {
    await database.query('DELETE FROM oauth_flows WHERE expires_at < UTC_TIMESTAMP()');
  } catch (error) {
    flowDbError(provider, 'delete_expired_flows', error);
    throw error;
  }
  try {
    await database.query(
      `INSERT INTO oauth_flows(state_hash, browser_hash, provider, verifier, nonce, expires_at)
       VALUES (?, ?, ?, ?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 10 MINUTE))`,
      [hash(state), hash(browser), provider, verifier, nonce]);
  } catch (error) {
    flowDbError(provider, 'insert_flow', error);
    throw error;
  }
  return { state, browser, verifier, nonce };
}

// SELECT FOR UPDATE + DELETE consumen state atómicamente, incluso con varias APIs.
// Un callback vencido, repetido, de otro proveedor o de otro navegador se rechaza.
export async function consumeFlow(provider, state, browser, database = pool) {
  if (typeof state !== 'string' || !/^[\w-]{43}$/.test(state) || !/^[\w-]{43}$/.test(browser || '')) throw new Error('OAUTH_STATE');
  // Una conexión reservada mantiene bloqueo, consumo y commit en la misma
  // transacción; release la devuelve al pool al terminar.
  const connection = await database.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.query(
      'SELECT * FROM oauth_flows WHERE state_hash = ? AND expires_at > UTC_TIMESTAMP() FOR UPDATE', [hash(state)]);
    const flow = rows[0];
    if (!flow || flow.provider !== provider || typeof flow.browser_hash !== 'string' || !/^[a-f0-9]{64}$/i.test(flow.browser_hash) || !timingSafeEqual(Buffer.from(flow.browser_hash, 'hex'), Buffer.from(hash(browser), 'hex'))) throw new Error('OAUTH_STATE');
    await connection.query('DELETE FROM oauth_flows WHERE state_hash = ?', [hash(state)]);
    await connection.commit();
    return flow;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
