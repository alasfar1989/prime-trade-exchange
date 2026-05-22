import { Router } from 'express';
import { fetchInventory } from '../services/inventory.js';
import { cacheGet, cacheSet } from '../cache/memoryCache.js';

const router = Router();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

router.get('/inventory', async (_req, res, next) => {
  try {
    const cacheKey = 'inventory';
    const cached = cacheGet<ReturnType<typeof fetchInventory>>(cacheKey);

    if (cached) {
      res.json({
        data: await cached.data,
        meta: { source: 'cache', cachedAt: cached.cachedAt },
      });
      return;
    }

    const inventory = await fetchInventory();
    cacheSet(cacheKey, inventory, CACHE_TTL);

    res.json({
      data: inventory,
      meta: { source: 'sp-api', cachedAt: new Date().toISOString() },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
