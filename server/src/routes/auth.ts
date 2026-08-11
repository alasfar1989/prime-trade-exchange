import { Router } from 'express';
import { env } from '../config/env.js';
import { signToken, safeEqual } from '../services/auth.js';

const router = Router();

router.post('/auth/login', (req, res) => {
  const { username, password } = (req.body ?? {}) as { username?: string; password?: string };
  const userOk = safeEqual(String(username ?? ''), env.AUTH.USER);
  const passOk = env.AUTH.PASS.length > 0 && safeEqual(String(password ?? ''), env.AUTH.PASS);
  if (!userOk || !passOk) {
    res.status(401).json({ error: 'Invalid username or password' });
    return;
  }
  const token = signToken({ sub: env.AUTH.USER });
  res.json({ token });
});

export default router;
