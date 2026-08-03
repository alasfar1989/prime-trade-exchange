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
  // Cache of resolved product names for SKUs not in current FBA inventory
  // (sold-out / merchant-fulfilled), looked up from the Listings API.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sku_names (
      sku        TEXT PRIMARY KEY,
      name       TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  // Operating expenses the user logs by hand — shipping supplies, software,
  // prep services, storage overages and so on. Deliberately NOT part of the
  // profit calculation: /api/profit stays revenue - Amazon fees - COGS.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS expenses (
      id           BIGSERIAL PRIMARY KEY,
      expense_date DATE NOT NULL,
      category     TEXT NOT NULL,
      description  TEXT NOT NULL,
      amount       NUMERIC(12,2) NOT NULL,
      vendor       TEXT,
      notes        TEXT,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  // Every read is a date-window query, so expense_date carries the lookups.
  await pool.query('CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date DESC)');
  console.log('Database ready (item_costs, sku_names, expenses).');
}
