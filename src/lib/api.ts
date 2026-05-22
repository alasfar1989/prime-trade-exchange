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
