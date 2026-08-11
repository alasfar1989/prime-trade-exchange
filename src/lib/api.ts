import { getToken, clearToken } from './auth';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3002/api';
const API_KEY = import.meta.env.VITE_API_KEY || 'pte-api-2026-secret';

interface ApiResponse<T> {
  data: T;
  meta: {
    source: 'sp-api' | 'cache';
    cachedAt: string;
  };
}

// Base headers for every call: API key + (when logged in) the Bearer token.
function authHeaders(json = false): Record<string, string> {
  const headers: Record<string, string> = { 'X-API-Key': API_KEY };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (json) headers['Content-Type'] = 'application/json';
  return headers;
}

// A 401 means the login token is missing/expired — drop it and return to login.
function handleUnauthorized(status: number): void {
  if (status === 401) {
    clearToken();
    if (window.location.pathname !== '/login') {
      window.location.assign('/login');
    }
  }
}

export async function fetchApi<T>(path: string, params?: Record<string, string>): Promise<ApiResponse<T>> {
  const url = new URL(`${API_BASE}${path}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }

  const res = await fetch(url.toString(), {
    headers: authHeaders(),
  });

  if (!res.ok) {
    handleUnauthorized(res.status);
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }

  return res.json();
}

// Shared write path for PUT/POST/DELETE — surfaces the server's `error`
// message when there is one instead of a bare status line.
async function writeApi<T>(method: 'PUT' | 'POST' | 'DELETE', path: string, body?: unknown): Promise<ApiResponse<T>> {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: authHeaders(body !== undefined),
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (!res.ok) {
    handleUnauthorized(res.status);
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
