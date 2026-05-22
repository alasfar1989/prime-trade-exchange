import { Router } from 'express';
import { fetchShipments } from '../services/shipments.js';
import { cacheGet, cacheSet } from '../cache/memoryCache.js';

const router = Router();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

router.get('/shipments', async (req, res, next) => {
  try {
    const cacheKey = 'shipments';
    const cached = cacheGet<ReturnType<typeof fetchShipments>>(cacheKey);

    if (cached) {
      res.json({
        data: await cached.data,
        meta: { source: 'cache', cachedAt: cached.cachedAt },
      });
      return;
    }

    const statuses = req.query.statuses
      ? (req.query.statuses as string).split(',')
      : undefined;

    const shipments = await fetchShipments(statuses);
    cacheSet(cacheKey, shipments, CACHE_TTL);

    res.json({
      data: shipments,
      meta: { source: 'sp-api', cachedAt: new Date().toISOString() },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
