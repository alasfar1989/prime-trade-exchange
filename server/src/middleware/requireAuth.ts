import type { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../services/auth.js';

// Both the dashboard admin and individual employees carry tokens signed with
// the same secret, so every gate MUST check the role as well as the signature.
// Otherwise an employee's clock token would unlock the finance routes.

export interface AuthedRequest extends Request {
  employeeId?: number;
  authSubject?: string;
}

function readToken(req: Request): string {
  const header = req.headers.authorization ?? '';
  return header.startsWith('Bearer ') ? header.slice(7) : String(req.headers['x-auth-token'] ?? '');
}

// Admin gate for the dashboard data routes. Tokens issued before roles existed
// have no `role` claim; they are admin tokens and stay valid until they expire.
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const payload = verifyToken(readToken(req));
  if (!payload || payload.role === 'employee') {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  (req as AuthedRequest).authSubject = String(payload.sub ?? 'admin');
  next();
}

// Employee gate for the punch clock. Never accepts an admin token — the admin
// is not an employee and has no time entries of their own.
export function requireEmployee(req: Request, res: Response, next: NextFunction): void {
  const payload = verifyToken(readToken(req));
  const employeeId = Number(payload?.eid);
  if (!payload || payload.role !== 'employee' || !Number.isInteger(employeeId)) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  (req as AuthedRequest).employeeId = employeeId;
  (req as AuthedRequest).authSubject = String(payload.sub ?? '');
  next();
}
