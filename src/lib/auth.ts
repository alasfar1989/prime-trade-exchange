// Client-side auth: stores the login token and talks to /auth/login.
const TOKEN_KEY = 'pte_auth_token';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3002/api';
const API_KEY = import.meta.env.VITE_API_KEY || 'pte-api-2026-secret';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

// Locally decode the token's expiry so we don't send obviously-dead tokens.
export function isAuthenticated(): boolean {
  const token = getToken();
  if (!token) return false;
  const [data] = token.split('.');
  if (!data) return false;
  try {
    const json = atob(data.replace(/-/g, '+').replace(/_/g, '/'));
    const payload = JSON.parse(json) as { exp?: number };
    if (typeof payload.exp === 'number' && payload.exp < Date.now() / 1000) {
      clearToken();
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export async function login(username: string, password: string): Promise<void> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': API_KEY },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    let msg = 'Login failed';
    try {
      const j = await res.json();
      if (j?.error) msg = j.error;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  const { token } = (await res.json()) as { token: string };
  setToken(token);
}
