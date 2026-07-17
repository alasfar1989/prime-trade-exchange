import { pool } from '../db.js';

// A per-SKU cost the user enters. One cost per SKU (latest/replacement cost).

export async function getAllCosts(): Promise<Map<string, number>> {
  if (!pool) return new Map();
  const r = await pool.query('SELECT sku, cost FROM item_costs');
  return new Map(r.rows.map((row: { sku: string; cost: string }) => [row.sku, parseFloat(row.cost)]));
}

export async function setCost(sku: string, cost: number): Promise<void> {
  if (!pool) throw new Error('Cost storage is not configured (no DATABASE_URL).');
  await pool.query(
    `INSERT INTO item_costs (sku, cost, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (sku) DO UPDATE SET cost = $2, updated_at = NOW()`,
    [sku, cost]
  );
}
