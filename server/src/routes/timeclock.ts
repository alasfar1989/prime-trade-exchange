import { Router } from 'express';
import type { AuthedRequest } from '../middleware/requireAuth.js';
import {
  listEmployees, createEmployee, updateEmployee, deleteEmployee,
  listEntries, summarize, createEntryAsAdmin, updateEntry, deleteEntry,
  listAudit, toPayrollCsv, businessDate,
} from '../services/timeclock.js';
import { getWorkSite, setWorkSite, type WorkSite } from '../services/worksite.js';

// Admin side of the time clock. Mounted behind requireAuth in index.ts.
const router = Router();

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ok = (data: unknown) => ({
  data, meta: { source: 'db', cachedAt: new Date().toISOString() },
});

// Default window: the current month, in the business timezone.
function defaultRange(): { from: string; to: string } {
  const today = businessDate(new Date());
  return { from: `${today.slice(0, 7)}-01`, to: today };
}

function readRange(q: Record<string, string | undefined>): { from: string; to: string } {
  const def = defaultRange();
  const from = q.from && DATE_RE.test(q.from) ? q.from : def.from;
  const to = q.to && DATE_RE.test(q.to) ? q.to : def.to;
  return from <= to ? { from, to } : { from: to, to: from };
}

function readId(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

// A punch pair must be a real interval: parseable, in order, and not open-ended
// in the past. Returns ISO strings or an error message.
function parsePunchTimes(body: Record<string, unknown>):
  { clockIn: string; clockOut: string | null } | { error: string } {
  const inRaw = String(body.clockIn ?? '');
  const outRaw = String(body.clockOut ?? '').trim();
  const cin = new Date(inRaw);
  if (!inRaw || Number.isNaN(cin.getTime())) return { error: 'A valid clock-in time is required.' };
  if (!outRaw) return { clockIn: cin.toISOString(), clockOut: null };
  const cout = new Date(outRaw);
  if (Number.isNaN(cout.getTime())) return { error: 'The clock-out time is not a valid date.' };
  if (cout.getTime() <= cin.getTime()) return { error: 'Clock out must be after clock in.' };
  return { clockIn: cin.toISOString(), clockOut: cout.toISOString() };
}

// --- Employees --------------------------------------------------------------

router.get('/employees', async (_req, res, next) => {
  try {
    res.json(ok(await listEmployees()));
  } catch (err) { next(err); }
});

router.post('/employees', async (req, res, next) => {
  try {
    const b = (req.body ?? {}) as Record<string, unknown>;
    const name = String(b.name ?? '').trim();
    const login = String(b.login ?? '').trim().toLowerCase();
    const password = String(b.password ?? '');
    const hourlyRate = Number(b.hourlyRate ?? 0);
    if (!name) { res.status(400).json({ error: 'Name is required.' }); return; }
    if (!/^[a-z0-9._@-]{3,}$/.test(login)) {
      res.status(400).json({ error: 'Username must be at least 3 characters (letters, numbers, . _ - @).' });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters.' });
      return;
    }
    if (!Number.isFinite(hourlyRate) || hourlyRate < 0) {
      res.status(400).json({ error: 'Hourly rate must be zero or more.' });
      return;
    }
    try {
      res.status(201).json(ok(await createEmployee(name, login, password, hourlyRate)));
    } catch (err) {
      if ((err as { code?: string }).code === '23505') {
        res.status(409).json({ error: 'That username is already taken.' });
        return;
      }
      throw err;
    }
  } catch (err) { next(err); }
});

router.put('/employees/:id', async (req, res, next) => {
  try {
    const id = readId(req.params.id);
    if (!id) { res.status(400).json({ error: 'A valid employee id is required.' }); return; }
    const b = (req.body ?? {}) as Record<string, unknown>;
    const name = String(b.name ?? '').trim();
    const login = String(b.login ?? '').trim().toLowerCase();
    const hourlyRate = Number(b.hourlyRate ?? 0);
    const password = b.password ? String(b.password) : undefined;
    if (!name) { res.status(400).json({ error: 'Name is required.' }); return; }
    if (!/^[a-z0-9._@-]{3,}$/.test(login)) {
      res.status(400).json({ error: 'Username must be at least 3 characters (letters, numbers, . _ - @).' });
      return;
    }
    if (password !== undefined && password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters.' });
      return;
    }
    if (!Number.isFinite(hourlyRate) || hourlyRate < 0) {
      res.status(400).json({ error: 'Hourly rate must be zero or more.' });
      return;
    }
    try {
      const row = await updateEmployee(id, {
        name, login, hourlyRate, active: b.active !== false, password,
      });
      if (!row) { res.status(404).json({ error: 'Employee not found.' }); return; }
      res.json(ok(row));
    } catch (err) {
      if ((err as { code?: string }).code === '23505') {
        res.status(409).json({ error: 'That username is already taken.' });
        return;
      }
      throw err;
    }
  } catch (err) { next(err); }
});

// Deleting an employee removes their time entries too (FK cascade), which is
// usually not what you want mid-year — deactivating keeps the history.
router.delete('/employees/:id', async (req, res, next) => {
  try {
    const id = readId(req.params.id);
    if (!id) { res.status(400).json({ error: 'A valid employee id is required.' }); return; }
    const done = await deleteEmployee(id);
    if (!done) { res.status(404).json({ error: 'Employee not found.' }); return; }
    res.json(ok({ id }));
  } catch (err) { next(err); }
});

// --- Work site (the geofence punches are measured against) -------------------

// GET /api/timeclock/site -> the configured site, or null if tracking is off
router.get('/timeclock/site', async (_req, res, next) => {
  try {
    res.json(ok(await getWorkSite()));
  } catch (err) { next(err); }
});

// PUT /api/timeclock/site — set it, or send {clear:true} to turn tracking off
router.put('/timeclock/site', async (req, res, next) => {
  try {
    const b = (req.body ?? {}) as Record<string, unknown>;
    if (b.clear === true) {
      await setWorkSite(null);
      res.json(ok(null));
      return;
    }
    const lat = Number(b.lat);
    const lng = Number(b.lng);
    const radiusM = Number(b.radiusM);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
      res.status(400).json({ error: 'Latitude must be between -90 and 90.' });
      return;
    }
    if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
      res.status(400).json({ error: 'Longitude must be between -180 and 180.' });
      return;
    }
    // Below ~25m ordinary GPS drift alone would flag people standing inside the
    // building; above 20km it is not a geofence any more.
    if (!Number.isFinite(radiusM) || radiusM < 25 || radiusM > 20000) {
      res.status(400).json({ error: 'Radius must be between 25 and 20000 metres.' });
      return;
    }
    const site: WorkSite = {
      lat, lng, radiusM: Math.round(radiusM),
      label: String(b.label ?? '').trim() || 'Work site',
    };
    res.json(ok(await setWorkSite(site)));
  } catch (err) { next(err); }
});

// --- Timesheets -------------------------------------------------------------

// GET /api/timesheets?from&to&employeeId
router.get('/timesheets', async (req, res, next) => {
  try {
    const q = req.query as Record<string, string | undefined>;
    const { from, to } = readRange(q);
    const employeeId = q.employeeId ? readId(q.employeeId) ?? undefined : undefined;
    const rows = await listEntries(from, to, employeeId);
    const { byEmployee, totals } = summarize(rows);
    const site = await getWorkSite();
    res.json(ok({ rows, byEmployee, totals, range: { from, to }, site }));
  } catch (err) { next(err); }
});

// GET /api/timesheets/export?from&to&employeeId -> text/csv
router.get('/timesheets/export', async (req, res, next) => {
  try {
    const q = req.query as Record<string, string | undefined>;
    const { from, to } = readRange(q);
    const employeeId = q.employeeId ? readId(q.employeeId) ?? undefined : undefined;
    const rows = await listEntries(from, to, employeeId);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="timesheet-${from}_to_${to}.csv"`);
    res.send(toPayrollCsv(rows, from, to));
  } catch (err) { next(err); }
});

// GET /api/timesheets/audit?entryId&limit
router.get('/timesheets/audit', async (req, res, next) => {
  try {
    const q = req.query as Record<string, string | undefined>;
    const entryId = q.entryId ? readId(q.entryId) ?? undefined : undefined;
    const limit = Math.min(Number(q.limit) || 100, 500);
    res.json(ok(await listAudit(limit, entryId)));
  } catch (err) { next(err); }
});

// POST /api/timesheets — admin adds a missed punch
router.post('/timesheets', async (req, res, next) => {
  try {
    const b = (req.body ?? {}) as Record<string, unknown>;
    const employeeId = readId(String(b.employeeId ?? ''));
    if (!employeeId) { res.status(400).json({ error: 'An employee is required.' }); return; }
    const times = parsePunchTimes(b);
    if ('error' in times) { res.status(400).json({ error: times.error }); return; }
    const reason = String(b.reason ?? '').trim();
    if (!reason) { res.status(400).json({ error: 'A reason is required for a manual entry.' }); return; }
    const note = String(b.note ?? '').trim() || null;
    const changedBy = (req as AuthedRequest).authSubject ?? 'admin';
    try {
      const row = await createEntryAsAdmin(
        employeeId, times.clockIn, times.clockOut, note, changedBy, reason
      );
      res.status(201).json(ok(row));
    } catch (err) {
      if ((err as { code?: string }).code === '23505') {
        res.status(409).json({ error: 'That employee already has an open shift.' });
        return;
      }
      throw err;
    }
  } catch (err) { next(err); }
});

// PUT /api/timesheets/:id — correct a punch (reason required, always audited)
router.put('/timesheets/:id', async (req, res, next) => {
  try {
    const id = readId(req.params.id);
    if (!id) { res.status(400).json({ error: 'A valid entry id is required.' }); return; }
    const b = (req.body ?? {}) as Record<string, unknown>;
    const times = parsePunchTimes(b);
    if ('error' in times) { res.status(400).json({ error: times.error }); return; }
    const reason = String(b.reason ?? '').trim();
    if (!reason) { res.status(400).json({ error: 'A reason is required to change a punch.' }); return; }
    const note = String(b.note ?? '').trim() || null;
    const changedBy = (req as AuthedRequest).authSubject ?? 'admin';
    try {
      const row = await updateEntry(id, times.clockIn, times.clockOut, note, changedBy, reason);
      if (!row) { res.status(404).json({ error: 'Time entry not found.' }); return; }
      res.json(ok(row));
    } catch (err) {
      if ((err as { code?: string }).code === '23505') {
        res.status(409).json({ error: 'That employee already has another open shift.' });
        return;
      }
      throw err;
    }
  } catch (err) { next(err); }
});

// DELETE /api/timesheets/:id — reason required, audit row survives the delete
router.delete('/timesheets/:id', async (req, res, next) => {
  try {
    const id = readId(req.params.id);
    if (!id) { res.status(400).json({ error: 'A valid entry id is required.' }); return; }
    const reason = String((req.query as Record<string, string | undefined>).reason ?? '').trim();
    if (!reason) { res.status(400).json({ error: 'A reason is required to delete a punch.' }); return; }
    const changedBy = (req as AuthedRequest).authSubject ?? 'admin';
    const done = await deleteEntry(id, changedBy, reason);
    if (!done) { res.status(404).json({ error: 'Time entry not found.' }); return; }
    res.json(ok({ id }));
  } catch (err) { next(err); }
});

export default router;
