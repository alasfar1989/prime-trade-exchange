import { Router } from 'express';
import { isTokenValid } from '../services/spApiAuth.js';
import { cacheStats } from '../cache/memoryCache.js';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    spApiToken: isTokenValid() ? 'valid' : 'needs refresh',
    cache: cacheStats(),
  });
});

export default router;
