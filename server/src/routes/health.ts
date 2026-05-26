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
  const rt = env.SP_API.REFRESH_TOKEN;
  const cs = env.SP_API.CLIENT_SECRET;
  const charCodes = Array.from(rt.substring(0, 10)).map(c => c.charCodeAt(0));
  try {
    const token = await getAccessToken();
    res.json({
      status: 'success',
      tokenPrefix: token.substring(0, 20) + '...',
    });
  } catch (err: any) {
    res.json({
      status: 'error',
      error: err.response?.data || err.message,
      refreshTokenFirst10Chars: rt.substring(0, 10),
      refreshTokenCharCodes: charCodes,
      refreshTokenLength: rt.length,
      clientSecretLast10: cs.substring(cs.length - 10),
      clientSecretLength: cs.length,
    });
  }
});

export default router;
