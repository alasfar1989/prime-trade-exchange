import { pool } from '../db.js';

// The single work site punches are measured against. Stored in app_settings so
// the admin can set it from the dashboard (including a "use my current
// location" capture while standing in the warehouse) without a redeploy.

const KEY = 'work_site';

export interface WorkSite {
  lat: number;
  lng: number;
  radiusM: number;
  label: string;
}

export interface PunchLocation {
  lat: number | null;
  lng: number | null;
  accuracyM: number | null;
}

export type LocationStatus = 'ok' | 'out_of_range' | 'unavailable';

export async function getWorkSite(): Promise<WorkSite | null> {
  if (!pool) return null;
  const r = await pool.query('SELECT value FROM app_settings WHERE key = $1', [KEY]);
  const v = r.rows[0]?.value as WorkSite | undefined;
  if (!v || typeof v.lat !== 'number' || typeof v.lng !== 'number') return null;
  return { lat: v.lat, lng: v.lng, radiusM: Number(v.radiusM) || 200, label: v.label || 'Work site' };
}

export async function setWorkSite(site: WorkSite | null): Promise<WorkSite | null> {
  if (!pool) throw new Error('Settings storage is not configured (no DATABASE_URL).');
  if (site === null) {
    await pool.query('DELETE FROM app_settings WHERE key = $1', [KEY]);
    return null;
  }
  await pool.query(
    `INSERT INTO app_settings (key, value, updated_at) VALUES ($1, $2, NOW())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [KEY, JSON.stringify(site)]
  );
  return site;
}

// Great-circle distance in metres. Haversine is plenty here — we are comparing
// against a radius of a few hundred metres, not navigating.
export function distanceMetres(
  aLat: number, aLng: number, bLat: number, bLng: number
): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)) * 10) / 10;
}

export interface EvaluatedLocation {
  lat: number | null;
  lng: number | null;
  accuracyM: number | null;
  distanceM: number | null;
  status: LocationStatus;
}

// Decide what a punch's location means. Deliberately forgiving:
//  - no fix at all            -> 'unavailable' (recorded, never blocked)
//  - no work site configured  -> 'ok', because there is nothing to compare to
//  - inside radius + GPS accuracy slack -> 'ok'
// The accuracy slack matters: a phone reporting "within 80m" standing at the
// door would otherwise be flagged as off-site by a 50m radius.
export function evaluateLocation(
  loc: PunchLocation | null | undefined,
  site: WorkSite | null
): EvaluatedLocation {
  const lat = loc?.lat ?? null;
  const lng = loc?.lng ?? null;
  const accuracyM = loc?.accuracyM ?? null;

  if (lat === null || lng === null || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { lat: null, lng: null, accuracyM: null, distanceM: null, status: 'unavailable' };
  }
  if (!site) {
    return { lat, lng, accuracyM, distanceM: null, status: 'ok' };
  }
  const distanceM = distanceMetres(site.lat, site.lng, lat, lng);
  // Cap the slack so a wildly imprecise fix can't wave through any location.
  const slack = Math.min(accuracyM ?? 0, 250);
  const status: LocationStatus = distanceM <= site.radiusM + slack ? 'ok' : 'out_of_range';
  return { lat, lng, accuracyM, distanceM, status };
}
