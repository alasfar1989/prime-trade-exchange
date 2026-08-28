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
  // --- Time clock -------------------------------------------------------
  // Employees punch in and out from their own phones, so each one needs its
  // own credentials. Separate from the single shared dashboard admin login.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS employees (
      id          BIGSERIAL PRIMARY KEY,
      name        TEXT NOT NULL,
      login       TEXT NOT NULL UNIQUE,
      pass_hash   TEXT NOT NULL,
      hourly_rate NUMERIC(10,2) NOT NULL DEFAULT 0,
      active      BOOLEAN NOT NULL DEFAULT TRUE,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  // One punch pair per row. clock_out IS NULL means "on the clock right now".
  // hourly_rate is snapshotted at punch-in so a later raise never rewrites the
  // labor cost of hours already worked.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS time_entries (
      id          BIGSERIAL PRIMARY KEY,
      employee_id BIGINT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
      clock_in    TIMESTAMPTZ NOT NULL,
      clock_out   TIMESTAMPTZ,
      hourly_rate NUMERIC(10,2) NOT NULL DEFAULT 0,
      source      TEXT NOT NULL DEFAULT 'employee',
      note        TEXT,
      edited_at   TIMESTAMPTZ,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  // The database — not application logic — is what guarantees an employee can
  // never have two shifts open at once, even if they double-tap Punch In.
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_time_entries_one_open
      ON time_entries(employee_id) WHERE clock_out IS NULL
  `);
  await pool.query(
    'CREATE INDEX IF NOT EXISTS idx_time_entries_lookup ON time_entries(employee_id, clock_in DESC)'
  );
  // Every admin change to a punch is recorded. entry_id is intentionally NOT a
  // cascading FK: if the entry is deleted the audit row must survive it.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS time_entry_audit (
      id            BIGSERIAL PRIMARY KEY,
      entry_id      BIGINT,
      employee_id   BIGINT,
      action        TEXT NOT NULL,
      changed_by    TEXT NOT NULL,
      reason        TEXT,
      old_clock_in  TIMESTAMPTZ,
      old_clock_out TIMESTAMPTZ,
      new_clock_in  TIMESTAMPTZ,
      new_clock_out TIMESTAMPTZ,
      changed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(
    'CREATE INDEX IF NOT EXISTS idx_time_audit_entry ON time_entry_audit(entry_id, changed_at DESC)'
  );

  // Where a punch happened. Added as ALTER so an already-deployed time_entries
  // table picks them up too. Location is RECORDED, never enforced: a punch is
  // always accepted, and an out-of-range or missing fix is flagged for the
  // admin instead of stopping someone from starting their shift.
  //   location_status: 'ok' | 'out_of_range' | 'unavailable'
  for (const col of [
    'in_lat NUMERIC(9,6)', 'in_lng NUMERIC(9,6)', 'in_accuracy_m NUMERIC(8,1)',
    'in_distance_m NUMERIC(10,1)', "in_location_status TEXT",
    'out_lat NUMERIC(9,6)', 'out_lng NUMERIC(9,6)', 'out_accuracy_m NUMERIC(8,1)',
    'out_distance_m NUMERIC(10,1)', "out_location_status TEXT",
  ]) {
    await pool.query(`ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS ${col}`);
  }

  // Small key/value store for admin-set configuration. Right now it holds the
  // work site the geofence is measured from.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key        TEXT PRIMARY KEY,
      value      JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  console.log('Database ready (item_costs, sku_names, expenses, time clock).');
}
