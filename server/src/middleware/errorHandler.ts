import type { Request, Response, NextFunction } from 'express';

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
  console.error('Error:', err.message);

  if (err.message.includes('Missing required environment')) {
    res.status(500).json({ error: 'Server configuration error', detail: err.message });
    return;
  }

  const status = (err as any).status || 500;
  res.status(status).json({
    error: err.message || 'Internal server error',
  });
}
