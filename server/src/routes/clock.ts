import { Router } from 'express';
import { signToken } from '../services/auth.js';
import { requireEmployee, type AuthedRequest } from '../middleware/requireAuth.js';
import {
  authenticateEmployee, getOpenEntry, punchIn, punchOut, listEntries, summarize,
  businessDate,
} from '../services/timeclock.js';
import { getWorkSite, type PunchLocation } from '../services/worksite.js';

// Employee-facing time clock. These are the only routes an employee token can
// reach — everything financial stays behind requireAuth.
const router = Router();

const ok = (data: unknown) => ({
  data, meta: { source: 'db', cachedAt: new Date().toISOString() },
});

// POST /api/clock/login — employee sign in (public)
router.post('/clock/login', async (req, res, next) => {
  try {
    const { login, password } = (req.body ?? {}) as { login?: string; password?: string };
    if (!login || !password) {
      res.status(400).json({ error: 'Enter your username and password.' });
      return;
    }
    const employee = await authenticateEmployee(login, password);
    if (!employee) {
      res.status(401).json({ error: 'Invalid username or password.' });
      return;
    }
    const token = signToken({ sub: String(login).toLowerCase(), role: 'employee', eid: employee.id });
    res.json(ok({ token, employee }));
  } catch (err) {
    next(err);
  }
});

// The last 14 days of the employee's own punches, plus their current state.
async function buildStatus(employeeId: number) {
  const open = await getOpenEntry(employeeId);
  const today = businessDate(new Date());
  const start = new Date();
  start.setDate(start.getDate() - 13);
  const recent = await listEntries(businessDate(start), today, employeeId);
  const todays = recent.filter((e) => e.date === today);
  const { totals } = summarize(recent);
  const site = await getWorkSite();
  return {
    // The phone only asks for GPS when a site is actually configured, so nobody
    // gets a permission prompt for a feature the business is not using.
    locationRequired: site !== null,
    onTheClock: open !== null,
    openEntry: open,
    today: { date: today, hours: summarize(todays).totals.hours },
    period: { hours: totals.hours, days: 14 },
    recent: recent.slice(0, 20),
  };
}

// GET /api/clock/status — am I clocked in, and what have I worked lately?
router.get('/clock/status', requireEmployee, async (req, res, next) => {
  try {
    res.json(ok(await buildStatus((req as AuthedRequest).employeeId!)));
  } catch (err) {
    next(err);
  }
});

// A phone that denies location, has GPS off, or simply times out sends nothing.
// That is a valid punch — it is recorded as 'unavailable', never rejected.
function readLocation(body: Record<string, unknown>): PunchLocation | null {
  const lat = Number(body.lat);
  const lng = Number(body.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  // Anything outside these ranges is a broken client, not a place on Earth.
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  const accuracy = Number(body.accuracyM);
  return { lat, lng, accuracyM: Number.isFinite(accuracy) ? accuracy : null };
}

// POST /api/clock/punch { action: 'in' | 'out', lat?, lng?, accuracyM? }
router.post('/clock/punch', requireEmployee, async (req, res, next) => {
  try {
    const employeeId = (req as AuthedRequest).employeeId!;
    const body = (req.body ?? {}) as Record<string, unknown>;
    const action = String(body.action ?? '');
    if (action !== 'in' && action !== 'out') {
      res.status(400).json({ error: "action must be 'in' or 'out'." });
      return;
    }
    const location = readLocation(body);
    try {
      const entry = action === 'in'
        ? await punchIn(employeeId, location)
        : await punchOut(employeeId, location);
      res.json(ok({ entry, status: await buildStatus(employeeId) }));
    } catch (err) {
      // "Already clocked in" / "not clocked in" are the employee's mistake, not
      // a server fault — 409 so the phone shows the message instead of a crash.
      res.status(409).json({ error: err instanceof Error ? err.message : 'Punch failed.' });
    }
  } catch (err) {
    next(err);
  }
});

export default router;
