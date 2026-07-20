import { pool } from '../db.js';

// Persistent cache of SKU -> product name (resolved from the Listings API for
// SKUs that aren't in current FBA inventory).

export async function getCachedNames(): Promise<Map<string, string>> {
  if (!pool) return new Map();
  const r = await pool.query('SELECT sku, name FROM sku_names');
  return new Map(r.rows.map((row: { sku: string; name: string }) => [row.sku, row.name]));
}

export async function saveNames(names: Map<string, string>): Promise<void> {
  if (!pool || names.size === 0) return;
  for (const [sku, name] of names) {
    await pool.query(
      `INSERT INTO sku_names (sku, name, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (sku) DO UPDATE SET name = $2, updated_at = NOW()`,
      [sku, name]
    );
  }
}
