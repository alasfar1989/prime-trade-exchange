import { pool } from '../db.js';
import type { Order } from './orders.js';

// Postgres-backed snapshot of Amazon orders. getOrders' quota (burst 20,
// refill 1/min) can't support re-pulling ~28 pages per refresh, so the full
// pull happens once ever; after that only changed orders are fetched and
// upserted here.

export function hasOrdersDb(): boolean {
  return pool != null;
}

export async function loadOrdersWindow(daysBack: number): Promise<Order[]> {
  if (!pool) return [];
  const r = await pool.query(
    `SELECT payload FROM orders_snapshot
     WHERE purchase_date >= NOW() - ($1 || ' days')::interval
     ORDER BY purchase_date DESC`,
    [daysBack]
  );
  return r.rows.map((row) => row.payload as Order);
}

export async function upsertOrders(orders: Order[]): Promise<void> {
  if (!pool || orders.length === 0) return;
  const CHUNK = 200;
  for (let i = 0; i < orders.length; i += CHUNK) {
    const chunk = orders.slice(i, i + CHUNK);
    const values: unknown[] = [];
    const rows = chunk.map((o, j) => {
      const b = j * 4;
      values.push(o.orderId, JSON.stringify(o), o.purchaseDate, o.lastUpdateDate);
      return `($${b + 1}, $${b + 2}::jsonb, $${b + 3}, $${b + 4})`;
    });
    await pool.query(
      `INSERT INTO orders_snapshot (order_id, payload, purchase_date, last_update_date)
       VALUES ${rows.join(',')}
       ON CONFLICT (order_id) DO UPDATE SET
         payload = EXCLUDED.payload,
         purchase_date = EXCLUDED.purchase_date,
         last_update_date = EXCLUDED.last_update_date`,
      values
    );
  }
}

// The high-water mark the next delta sync starts from.
export async function latestOrderUpdate(): Promise<string | null> {
  if (!pool) return null;
  const r = await pool.query('SELECT MAX(last_update_date) AS m FROM orders_snapshot');
  const m = r.rows[0]?.m as Date | null;
  return m ? m.toISOString() : null;
}

export async function pruneOrdersOlderThan(days: number): Promise<void> {
  if (!pool) return;
  await pool.query(
    `DELETE FROM orders_snapshot WHERE purchase_date < NOW() - ($1 || ' days')::interval`,
    [days]
  );
}
