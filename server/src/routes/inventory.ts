import { Router } from 'express';
import { fetchInventory } from '../services/inventory.js';
import { fetchFbaSkuSet } from '../services/listings.js';
import { cacheGet, cacheSet } from '../cache/memoryCache.js';

const router = Router();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const FBA_SET_TTL = 60 * 60 * 1000; // 1 hour (report is slow; catalog rarely changes)

interface InventoryResult {
  rows: Awaited<ReturnType<typeof fetchInventory>>;
  fbaFiltered: boolean;
  total: number;
}

async function buildInventory(): Promise<InventoryResult> {
  // Ledger (all summaries) + the authoritative FBA listing set, in parallel.
  const [rows, fbaSet] = await Promise.all([
    fetchInventory(),
    (async () => {
      const cached = cacheGet<Promise<Set<string> | null>>('fba-sku-set');
      if (cached) return (await cached.data) as Set<string> | null;
      const set = await fetchFbaSkuSet();
      cacheSet('fba-sku-set', set, FBA_SET_TTL);
      return set;
    })(),
  ]);

  // Filter the ledger down to real FBA-catalog SKUs. If the report is
  // unavailable, don't filter — better to show everything than a blank tab.
  if (fbaSet && fbaSet.size) {
    return { rows: rows.filter((r) => fbaSet.has(r.sku)), fbaFiltered: true, total: rows.length };
  }
  return { rows, fbaFiltered: false, total: rows.length };
}

router.get('/inventory', async (_req, res, next) => {
  try {
    const cacheKey = 'inventory';
    const cached = cacheGet<Promise<InventoryResult>>(cacheKey);

    if (cached) {
      const result = (await cached.data) as InventoryResult;
      res.json({
        data: result.rows,
        meta: { source: 'cache', cachedAt: cached.cachedAt, fbaFiltered: result.fbaFiltered, total: result.total, shown: result.rows.length },
      });
      return;
    }

    const result = await buildInventory();
    cacheSet(cacheKey, result, CACHE_TTL);

    res.json({
      data: result.rows,
      meta: { source: 'sp-api', cachedAt: new Date().toISOString(), fbaFiltered: result.fbaFiltered, total: result.total, shown: result.rows.length },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
