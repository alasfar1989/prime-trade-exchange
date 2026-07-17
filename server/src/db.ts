import pg from 'pg';
import { env } from './config/env.js';

const { Pool } = pg;

// Railway's internal Postgres host doesn't use TLS; the public proxy does.
function sslOption() {
  if (!env.DATABASE_URL) return false;
  return env.DATABASE_URL.includes('railway.internal') ? false : { rejectUnauthorized: false };
}

export const pool = env.DATABASE_URL
  ? new Pool({ connectionString: env.DATABASE_URL, ssl: sslOption() })
  : null;

// Create the cost table on boot. Best-effort — if there's no DATABASE_URL the
// SP-API endpoints still work; only cost/profit need the DB.
export async function initDb(): Promise<void> {
  if (!pool) {
    console.warn('No DATABASE_URL set — cost storage is disabled.');
    return;
  }
  await pool.query(`
    CREATE TABLE IF NOT EXISTS item_costs (
      sku        TEXT PRIMARY KEY,
      cost       NUMERIC(12,2) NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  console.log('Database ready (item_costs).');
}
