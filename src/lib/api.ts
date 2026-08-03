const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3002/api';
const API_KEY = import.meta.env.VITE_API_KEY || 'pte-api-2026-secret';

interface ApiResponse<T> {
  data: T;
  meta: {
    source: 'sp-api' | 'cache';
    cachedAt: string;
  };
}

export async function fetchApi<T>(path: string, params?: Record<string, string>): Promise<ApiResponse<T>> {
  const url = new URL(`${API_BASE}${path}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }

  const res = await fetch(url.toString(), {
    headers: { 'X-API-Key': API_KEY },
  });

  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }

  return res.json();
}

// Shared write path for PUT/POST/DELETE — surfaces the server's `error`
// message when there is one instead of a bare status line.
async function writeApi<T>(method: 'PUT' | 'POST' | 'DELETE', path: string, body?: unknown): Promise<ApiResponse<T>> {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: body === undefined
      ? { 'X-API-Key': API_KEY }
      : { 'X-API-Key': API_KEY, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (!res.ok) {
    let msg = `API error: ${res.status} ${res.statusText}`;
    try {
      const j = await res.json();
      if (j?.error) msg = j.error;
    } catch { /* ignore */ }
    throw new Error(msg);
  }

  return res.json();
}

export function putApi<T>(path: string, body: unknown): Promise<ApiResponse<T>> {
  return writeApi<T>('PUT', path, body);
}

export function postApi<T>(path: string, body: unknown): Promise<ApiResponse<T>> {
  return writeApi<T>('POST', path, body);
}

export function deleteApi<T>(path: string): Promise<ApiResponse<T>> {
  return writeApi<T>('DELETE', path);
}
