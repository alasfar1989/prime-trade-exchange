import type { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../services/auth.js';

// Gate for the dashboard data routes. Expects a Bearer token from the login flow.
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : String(req.headers['x-auth-token'] ?? '');
  if (!verifyToken(token)) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  next();
}
