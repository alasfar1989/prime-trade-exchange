import { Router } from 'express';
import { isTokenValid, getAccessToken } from '../services/spApiAuth.js';
import { cacheStats } from '../cache/memoryCache.js';
import { env } from '../config/env.js';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    spApiToken: isTokenValid() ? 'valid' : 'needs refresh',
    cache: cacheStats(),
  });
});

router.get('/debug-auth', async (_req, res) => {
  try {
    const token = await getAccessToken();
    res.json({
      status: 'success',
      tokenPrefix: token.substring(0, 20) + '...',
      clientIdPrefix: env.SP_API.CLIENT_ID.substring(0, 30) + '...',
      refreshTokenPrefix: env.SP_API.REFRESH_TOKEN.substring(0, 20) + '...',
    });
  } catch (err: any) {
    res.json({
      status: 'error',
      error: err.response?.data || err.message,
      clientIdPrefix: env.SP_API.CLIENT_ID.substring(0, 30) + '...',
      refreshTokenPrefix: env.SP_API.REFRESH_TOKEN.substring(0, 20) + '...',
    });
  }
});

export default router;
