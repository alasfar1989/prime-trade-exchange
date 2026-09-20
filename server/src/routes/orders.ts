import { Router } from 'express';
import { fetchOrders, fetchOrdersUpdatedBetween, type Order } from '../services/orders.js';
import {
  hasOrdersDb,
  loadOrdersWindow,
  upsertOrders,
  latestOrderUpdate,
  pruneOrdersOlderThan,
} from '../services/ordersStore.js';
import { cacheGet, cacheGetStale, cacheSet } from '../cache/memoryCache.js';

const router = Router();
// ~2,700 orders/month = ~28 getOrders pages, against a quota of burst 20 +
// 1/min refill. The DB snapshot means a refresh only pulls orders CHANGED
// since the last sync (a page or two), so this TTL is about freshness, not
// quota survival.
const CACHE_TTL = 30 * 60 * 1000;
// Stale data younger than this is served instantly while a refresh runs in
// the background; anything older blocks on the refresh.
const SWR_MAX_AGE = 24 * 60 * 60 * 1000;
// Sync in ≤5-day windows: each window's pagination token stays fresh even
// when throttling slows pages down, and every finished window is persisted,
// so an interrupted sync resumes where it left off instead of starting over.
const SLICE_MS = 5 * 86400_000;
const OVERLAP_MS = 10 * 60_000;

const inflight = new Map<string, Promise<Order[]>>();

async function refreshOrders(days: number): Promise<Order[]> {
  if (!hasOrdersDb()) return fetchOrders(days); // no DB — direct pull, old behavior

  const before = new Date(Date.now() - 3 * 60_000); // SP-API rejects "now"
  const highWater = await latestOrderUpdate();
  // First-ever sync walks the whole window; after that we start just below
  // the newest change we've seen.
  let since = highWater
    ? new Date(Date.parse(highWater) - OVERLAP_MS)
    : new Date(Date.now() - days * 86400_000);

  while (since < before) {
    const end = new Date(Math.min(since.getTime() + SLICE_MS, before.getTime()));
    const changed = await fetchOrdersUpdatedBetween(since.toISOString(), end.toISOString());
    await upsertOrders(changed);
    since = end;
  }

  pruneOrdersOlderThan(60).catch(() => {});
  return loadOrdersWindow(days);
}

function startOrdersPull(days: number): Promise<Order[]> {
  const cacheKey = `orders:${days}`;
  let pull = inflight.get(cacheKey);
  if (!pull) {
    pull = refreshOrders(days);
    inflight.set(cacheKey, pull);
    pull.then(
      (orders) => {
        cacheSet(cacheKey, orders, CACHE_TTL);
        inflight.delete(cacheKey);
      },
      (err) => {
        inflight.delete(cacheKey);
        console.error('Orders refresh failed:', (err as Error)?.message ?? err);
      }
    );
  }
  return pull;
}

// On boot: serve whatever the DB already has immediately, then catch up with
// a delta sync in the background. A fresh deploy no longer waits on Amazon.
export async function warmOrdersCache(days = 30): Promise<void> {
  const cacheKey = `orders:${days}`;
  try {
    if (hasOrdersDb() && !cacheGet(cacheKey)) {
      const existing = await loadOrdersWindow(days);
      if (existing.length) cacheSet(cacheKey, existing, CACHE_TTL);
    }
  } catch (err) {
    console.error('Orders DB warm-up failed:', (err as Error)?.message ?? err);
  }
  startOrdersPull(days);
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
      // Serve the last good data instantly; the refresh keeps running behind us.
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
