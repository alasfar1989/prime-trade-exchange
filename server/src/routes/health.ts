import { Router } from 'express';
import { isTokenValid } from '../services/spApiAuth.js';
import { cacheStats } from '../cache/memoryCache.js';
import { pool } from '../db.js';
import { ordersDebug } from './orders.js';

const router = Router();

// Bumped on deploy-sensitive changes so we can confirm Railway picked them up.
const BUILD_TAG = '2026-09-20-orders-db-debug';

router.get('/health', async (_req, res) => {
  // Orders snapshot state: how many rows we hold and the sync high-water mark.
  let ordersDb: Record<string, unknown> = { available: false };
  if (pool) {
    try {
      const r = await pool.query(
        'SELECT COUNT(*)::int AS n, MAX(last_update_date) AS hw FROM orders_snapshot'
      );
      ordersDb = {
        available: true,
        rows: r.rows[0]?.n ?? 0,
        highWater: r.rows[0]?.hw ? new Date(r.rows[0].hw).toISOString() : null,
      };
    } catch (err) {
      ordersDb = { available: false, error: String((err as Error)?.message ?? err).slice(0, 200) };
    }
  }

  res.json({
    status: 'ok',
    build: BUILD_TAG,
    timestamp: new Date().toISOString(),
    spApiToken: isTokenValid() ? 'valid' : 'needs refresh',
    cache: cacheStats(),
    ordersDb,
    ordersSync: ordersDebug,
  });
});

export default router;
