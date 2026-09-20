import { Router } from 'express';
import { fetchOrders, type Order } from '../services/orders.js';
import { cacheGet, cacheGetStale, cacheSet } from '../cache/memoryCache.js';

const router = Router();
// ~2,700 orders/month = ~28 getOrders pages per pull, against a quota of
// burst 20 + 1/min refill. A 30-min TTL keeps us at ~56 calls/hour, just
// under the sustained limit.
const CACHE_TTL = 30 * 60 * 1000;
// Stale data younger than this is served instantly while a refresh runs in
// the background; anything older blocks on the (patient, retried) pull.
const SWR_MAX_AGE = 24 * 60 * 60 * 1000;

// Single-flight: concurrent viewers share one SP-API pull instead of each
// starting their own pagination run against the rate limit.
const inflight = new Map<string, Promise<Order[]>>();

function startOrdersPull(days: number): Promise<Order[]> {
  const cacheKey = `orders:${days}`;
  let pull = inflight.get(cacheKey);
  if (!pull) {
    pull = fetchOrders(days);
    inflight.set(cacheKey, pull);
    pull.then(
      (orders) => {
        cacheSet(cacheKey, orders, CACHE_TTL);
        inflight.delete(cacheKey);
      },
      (err) => {
        inflight.delete(cacheKey);
        console.error('Orders pull failed:', (err as Error)?.message ?? err);
      }
    );
  }
  return pull;
}

// Deploys restart the process with an empty cache, and the first pull can take
// minutes if the quota bucket is drained. Start it at boot so browsers find a
// warm cache instead of paying that wait.
export function warmOrdersCache(days = 30): void {
  if (!cacheGet(`orders:${days}`)) startOrdersPull(days);
}

router.get('/orders', async (req, res, next) => {
  const days = parseInt(req.query.days as string) || 30;
  const cacheKey = `orders:${days}`;
  try {
    const cached = cacheGet<Order[]>(cacheKey);
    if (cached) {
      res.json({
        data: cached.data,
        meta: { source: 'cache', cachedAt: cached.cachedAt },
      });
      return;
    }

    const pull = startOrdersPull(days);
    const stale = cacheGetStale<Order[]>(cacheKey);
    const staleAge = stale ? Date.now() - Date.parse(stale.cachedAt) : Infinity;

    if (stale && staleAge < SWR_MAX_AGE) {
      // Serve the last good pull instantly; the refresh keeps running behind us.
      res.json({
        data: stale.data,
        meta: { source: 'cache', cachedAt: stale.cachedAt },
      });
      return;
    }

    try {
      const orders = await pull;
      res.json({
        data: orders,
        meta: { source: 'sp-api', cachedAt: new Date().toISOString() },
      });
    } catch (err) {
      // Rate-limited (or otherwise failing) — even old stale data beats
      // breaking the Orders tab.
      if (!stale) throw err;
      res.json({
        data: stale.data,
        meta: { source: 'cache', cachedAt: stale.cachedAt },
      });
    }
  } catch (err) {
    next(err);
  }
});

export default router;
