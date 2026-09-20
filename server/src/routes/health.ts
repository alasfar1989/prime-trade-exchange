import { Router } from 'express';
import { isTokenValid } from '../services/spApiAuth.js';
import { cacheStats } from '../cache/memoryCache.js';

const router = Router();

// Bumped on deploy-sensitive changes so we can confirm Railway picked them up.
const BUILD_TAG = '2026-09-20-orders-warmup';

router.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    build: BUILD_TAG,
    timestamp: new Date().toISOString(),
    spApiToken: isTokenValid() ? 'valid' : 'needs refresh',
    cache: cacheStats(),
  });
});

export default router;
