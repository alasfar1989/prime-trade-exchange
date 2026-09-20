import { Router } from 'express';
import { fetchOrders, type Order } from '../services/orders.js';
import { cacheGet, cacheGetStale, cacheSet } from '../cache/memoryCache.js';

const router = Router();
// getOrders refills at ~1 request/minute, and one dashboard load can burn
// several requests paginating — keep the cache long enough to stay under it.
const CACHE_TTL = 10 * 60 * 1000;

// Single-flight: concurrent viewers share one SP-API pull instead of each
// starting their own pagination run against the rate limit.
const inflight = new Map<string, Promise<Order[]>>();

// Deploys restart the process with an empty cache, and the first pull can take
// minutes if the quota bucket is drained. Start it at boot so browsers find a
// warm cache instead of paying that wait.
export function warmOrdersCache(days = 30): void {
  const cacheKey = `orders:${days}`;
  if (cacheGet(cacheKey) || inflight.has(cacheKey)) return;
  const pull = fetchOrders(days);
  inflight.set(cacheKey, pull);
  pull.then(
    (orders) => {
      cacheSet(cacheKey, orders, CACHE_TTL);
      inflight.delete(cacheKey);
    },
    (err) => {
      inflight.delete(cacheKey);
      console.error('Orders cache warm-up failed:', (err as Error)?.message ?? err);
    }
  );
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

    let pull = inflight.get(cacheKey);
    if (!pull) {
      pull = fetchOrders(days);
      inflight.set(cacheKey, pull);
      const clear = () => inflight.delete(cacheKey);
      pull.then(clear, clear);
    }
    const orders = await pull;
    cacheSet(cacheKey, orders, CACHE_TTL);

    res.json({
      data: orders,
      meta: { source: 'sp-api', cachedAt: new Date().toISOString() },
    });
  } catch (err) {
    // Rate-limited (or otherwise failing) — serve the last good pull if we
    // have one rather than breaking the Orders tab.
    const stale = cacheGetStale<Order[]>(cacheKey);
    if (stale) {
      res.json({
        data: stale.data,
        meta: { source: 'cache', cachedAt: stale.cachedAt },
      });
      return;
    }
    next(err);
  }
});

export default router;
