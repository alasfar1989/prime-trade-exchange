import { Router } from 'express';
import { fetchOrders } from '../services/orders.js';
import { cacheGet, cacheSet } from '../cache/memoryCache.js';

const router = Router();
const CACHE_TTL = 2 * 60 * 1000; // 2 minutes

router.get('/orders', async (req, res, next) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const cacheKey = `orders:${days}`;
    const cached = cacheGet<ReturnType<typeof fetchOrders>>(cacheKey);

    if (cached) {
      res.json({
        data: await cached.data,
        meta: { source: 'cache', cachedAt: cached.cachedAt },
      });
      return;
    }

    const orders = await fetchOrders(days);
    cacheSet(cacheKey, orders, CACHE_TTL);

    res.json({
      data: orders,
      meta: { source: 'sp-api', cachedAt: new Date().toISOString() },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
