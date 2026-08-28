// Employee time-clock session. Deliberately separate from the admin session in
// lib/auth.ts: an employee punching in on their phone and the owner signed into
// the dashboard are different people with different tokens, and a 401 on one
// must never bounce the other to the wrong login screen.

const TOKEN_KEY = 'pte_clock_token';
const NAME_KEY = 'pte_clock_name';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3002/api';
const API_KEY = import.meta.env.VITE_API_KEY || 'pte-api-2026-secret';

export type LocationStatus = 'ok' | 'out_of_range' | 'unavailable';

export interface PunchLocationRecord {
  lat: number | null;
  lng: number | null;
  accuracyM: number | null;
  distanceM: number | null;
  status: LocationStatus;
}

export interface PunchCoords {
  lat: number;
  lng: number;
  accuracyM: number | null;
}

export interface ClockEntry {
  id: number;
  employeeId: number;
  employeeName: string;
  date: string;
  clockIn: string;
  clockOut: string | null;
  hours: number | null;
  hourlyRate: number;
  laborCost: number | null;
  source: string;
  note: string | null;
  edited: boolean;
  stale: boolean;
  inLocation: PunchLocationRecord;
  outLocation: PunchLocationRecord | null;
}

export interface ClockStatus {
  locationRequired: boolean;
  onTheClock: boolean;
  openEntry: ClockEntry | null;
  today: { date: string; hours: number };
  period: { hours: number; days: number };
  recent: ClockEntry[];
}

export function getClockToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getClockName(): string {
  return localStorage.getItem(NAME_KEY) ?? '';
}

export function clearClockSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(NAME_KEY);
}

// Read the expiry out of the token so an obviously-dead session shows the login
// form immediately instead of after a failed punch.
export function hasLiveClockSession(): boolean {
  const token = getClockToken();
  if (!token) return false;
  try {
    const [data] = token.split('.');
    const payload = JSON.parse(atob(data.replace(/-/g, '+').replace(/_/g, '/'))) as { exp?: number };
    if (typeof payload.exp === 'number' && payload.exp < Date.now() / 1000) {
      clearClockSession();
      return false;
    }
    return true;
  } catch {
    clearClockSession();
    return false;
  }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = { 'X-API-Key': API_KEY };
  const token = getClockToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (init?.body) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  if (!res.ok) {
    if (res.status === 401) clearClockSession();
    let msg = `Something went wrong (${res.status})`;
    try {
      const j = await res.json();
      if (j?.error) msg = j.error;
    } catch { /* keep the status message */ }
    throw new Error(msg);
  }
  const json = (await res.json()) as { data: T };
  return json.data;
}

export async function clockLogin(login: string, password: string): Promise<string> {
  const data = await call<{ token: string; employee: { id: number; name: string } }>(
    '/clock/login',
    { method: 'POST', body: JSON.stringify({ login, password }) }
  );
  localStorage.setItem(TOKEN_KEY, data.token);
  localStorage.setItem(NAME_KEY, data.employee.name);
  return data.employee.name;
}

export function fetchClockStatus(): Promise<ClockStatus> {
  return call<ClockStatus>('/clock/status');
}

// Ask the phone where it is. NEVER rejects and never blocks: a denied
// permission, a disabled GPS, an old browser or a slow fix all resolve to null,
// the punch still goes through, and the server records it as 'unavailable'.
export function getCoords(timeoutMs = 8000): Promise<PunchCoords | null> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    let settled = false;
    const done = (v: PunchCoords | null) => { if (!settled) { settled = true; resolve(v); } };
    // Belt and braces: some mobile browsers never fire either callback if the
    // permission prompt is dismissed rather than answered.
    const timer = setTimeout(() => done(null), timeoutMs + 1000);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        clearTimeout(timer);
        done({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracyM: Number.isFinite(pos.coords.accuracy) ? pos.coords.accuracy : null,
        });
      },
      () => { clearTimeout(timer); done(null); },
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 30_000 }
    );
  });
}

export async function punch(
  action: 'in' | 'out', coords?: PunchCoords | null
): Promise<ClockStatus> {
  const data = await call<{ entry: ClockEntry; status: ClockStatus }>(
    '/clock/punch',
    { method: 'POST', body: JSON.stringify({ action, ...(coords ?? {}) }) }
  );
  return data.status;
}
