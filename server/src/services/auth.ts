import crypto from 'crypto';
import { env } from '../config/env.js';

// Lightweight, dependency-free signed tokens (HMAC-SHA256, JWT-like).
// Format: base64url(payload).base64url(signature)

const TTL_SECONDS = 60 * 60 * 12; // 12 hours

export function signToken(payload: Record<string, unknown>): string {
  const body = { ...payload, exp: Math.floor(Date.now() / 1000) + TTL_SECONDS };
  const data = Buffer.from(JSON.stringify(body)).toString('base64url');
  const sig = crypto.createHmac('sha256', env.AUTH.JWT_SECRET).update(data).digest('base64url');
  return `${data}.${sig}`;
}

export function verifyToken(token: string): Record<string, unknown> | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [data, sig] = parts;
  const expected = crypto.createHmac('sha256', env.AUTH.JWT_SECRET).update(data).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(data, 'base64url').toString('utf-8')) as { exp?: number };
    if (typeof parsed.exp === 'number' && parsed.exp < Math.floor(Date.now() / 1000)) return null;
    return parsed;
  } catch {
    return null;
  }
}

// Constant-time string comparison (length-safe — never throws).
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}
