import { pool } from '../db.js';
import { hashPassword, verifyPassword } from './auth.js';
import {
  getWorkSite, evaluateLocation, type PunchLocation, type LocationStatus,
} from './worksite.js';

// Employee time clock. Employees punch in and out from their own phones; the
// admin sees the timesheets, can correct a punch (always with an audit row),
// and exports the pay period as CSV.

// Hours are stored as absolute instants (TIMESTAMPTZ). A "day" for grouping
// and for the payroll window is a day in the BUSINESS's timezone, not UTC and
// not the phone's — otherwise an 8pm punch lands on tomorrow's timesheet.
const BUSINESS_TZ = process.env.BUSINESS_TZ || 'America/New_York';
const dayFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: BUSINESS_TZ, year: 'numeric', month: '2-digit', day: '2-digit',
});

export function businessDate(d: Date): string {
  return dayFormatter.format(d); // en-CA renders as YYYY-MM-DD
}

// A shift left open this long is a forgotten punch-out, not a real shift.
const STALE_SHIFT_HOURS = 16;

export interface Employee {
  id: number;
  name: string;
  login: string;
  hourlyRate: number;
  active: boolean;
  createdAt: string;
}

export interface TimeEntry {
  id: number;
  employeeId: number;
  employeeName: string;
  date: string;            // business-timezone date of the punch-in
  clockIn: string;         // ISO instant
  clockOut: string | null; // null = still on the clock
  hours: number | null;    // null while open
  hourlyRate: number;
  laborCost: number | null;
  source: string;
  note: string | null;
  edited: boolean;
  stale: boolean;          // open far longer than a plausible shift
  // Where the punch happened. Recorded, never enforced.
  inLocation: PunchLocationRecord;
  outLocation: PunchLocationRecord | null;
}

export interface PunchLocationRecord {
  lat: number | null;
  lng: number | null;
  accuracyM: number | null;
  distanceM: number | null;
  status: LocationStatus;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

function noDb(): never {
  throw new Error('Time clock storage is not configured (no DATABASE_URL).');
}

function db() {
  if (!pool) noDb();
  return pool;
}

interface EmployeeRow {
  id: string; name: string; login: string; hourly_rate: string;
  active: boolean; created_at: Date;
}

function mapEmployee(r: EmployeeRow): Employee {
  return {
    id: Number(r.id),
    name: r.name,
    login: r.login,
    hourlyRate: parseFloat(r.hourly_rate),
    active: r.active,
    createdAt: r.created_at.toISOString(),
  };
}

interface EntryRow {
  id: string; employee_id: string; employee_name: string;
  clock_in: Date; clock_out: Date | null; hourly_rate: string;
  source: string; note: string | null; edited_at: Date | null;
  in_lat: string | null; in_lng: string | null; in_accuracy_m: string | null;
  in_distance_m: string | null; in_location_status: string | null;
  out_lat: string | null; out_lng: string | null; out_accuracy_m: string | null;
  out_distance_m: string | null; out_location_status: string | null;
}

const num = (v: string | null): number | null => (v === null ? null : parseFloat(v));

function locationFrom(
  lat: string | null, lng: string | null, acc: string | null,
  dist: string | null, status: string | null
): PunchLocationRecord {
  return {
    lat: num(lat), lng: num(lng), accuracyM: num(acc), distanceM: num(dist),
    // Rows written before location existed have no status; treat them as
    // unknown rather than silently claiming they were on site.
    status: (status as LocationStatus) ?? 'unavailable',
  };
}

function mapEntry(r: EntryRow): TimeEntry {
  const rate = parseFloat(r.hourly_rate);
  const openMs = Date.now() - r.clock_in.getTime();
  let hours: number | null = null;
  if (r.clock_out) {
    hours = round2((r.clock_out.getTime() - r.clock_in.getTime()) / 3_600_000);
  }
  return {
    id: Number(r.id),
    employeeId: Number(r.employee_id),
    employeeName: r.employee_name,
    date: businessDate(r.clock_in),
    clockIn: r.clock_in.toISOString(),
    clockOut: r.clock_out ? r.clock_out.toISOString() : null,
    hours,
    hourlyRate: rate,
    laborCost: hours === null ? null : round2(hours * rate),
    source: r.source,
    note: r.note,
    edited: r.edited_at !== null,
    stale: !r.clock_out && openMs > STALE_SHIFT_HOURS * 3_600_000,
    inLocation: locationFrom(r.in_lat, r.in_lng, r.in_accuracy_m, r.in_distance_m, r.in_location_status),
    outLocation: r.clock_out
      ? locationFrom(r.out_lat, r.out_lng, r.out_accuracy_m, r.out_distance_m, r.out_location_status)
      : null,
  };
}

const ENTRY_SELECT = `
  SELECT t.id, t.employee_id, e.name AS employee_name, t.clock_in, t.clock_out,
         t.hourly_rate, t.source, t.note, t.edited_at,
         t.in_lat, t.in_lng, t.in_accuracy_m, t.in_distance_m, t.in_location_status,
         t.out_lat, t.out_lng, t.out_accuracy_m, t.out_distance_m, t.out_location_status
    FROM time_entries t
    JOIN employees e ON e.id = t.employee_id`;

// --- Employees --------------------------------------------------------------

export async function listEmployees(includeInactive = true): Promise<Employee[]> {
  if (!pool) return [];
  const r = await pool.query(
    `SELECT id, name, login, hourly_rate, active, created_at
       FROM employees
      ${includeInactive ? '' : 'WHERE active'}
      ORDER BY active DESC, name`
  );
  return r.rows.map(mapEmployee);
}

export async function createEmployee(
  name: string, login: string, password: string, hourlyRate: number
): Promise<Employee> {
  const r = await db().query(
    `INSERT INTO employees (name, login, pass_hash, hourly_rate)
     VALUES ($1, $2, $3, $4)
     RETURNING id, name, login, hourly_rate, active, created_at`,
    [name, login.toLowerCase(), hashPassword(password), hourlyRate]
  );
  return mapEmployee(r.rows[0]);
}

// Password is only touched when a new one is supplied — saving a rate change
// must not wipe the employee's login.
export async function updateEmployee(
  id: number,
  fields: { name: string; login: string; hourlyRate: number; active: boolean; password?: string }
): Promise<Employee | null> {
  const sets = ['name = $2', 'login = $3', 'hourly_rate = $4', 'active = $5', 'updated_at = NOW()'];
  const params: unknown[] = [id, fields.name, fields.login.toLowerCase(), fields.hourlyRate, fields.active];
  if (fields.password) {
    params.push(hashPassword(fields.password));
    sets.push(`pass_hash = $${params.length}`);
  }
  const r = await db().query(
    `UPDATE employees SET ${sets.join(', ')} WHERE id = $1
     RETURNING id, name, login, hourly_rate, active, created_at`,
    params
  );
  return r.rows[0] ? mapEmployee(r.rows[0]) : null;
}

export async function deleteEmployee(id: number): Promise<boolean> {
  const r = await db().query('DELETE FROM employees WHERE id = $1', [id]);
  return (r.rowCount ?? 0) > 0;
}

// --- Employee login ---------------------------------------------------------

export async function authenticateEmployee(
  login: string, password: string
): Promise<{ id: number; name: string } | null> {
  if (!pool) return null;
  const r = await pool.query(
    'SELECT id, name, pass_hash, active FROM employees WHERE login = $1',
    [String(login).trim().toLowerCase()]
  );
  const row = r.rows[0];
  if (!row || !row.active) return null;
  if (!verifyPassword(password, row.pass_hash)) return null;
  return { id: Number(row.id), name: row.name };
}

// --- Punching ---------------------------------------------------------------

export async function getOpenEntry(employeeId: number): Promise<TimeEntry | null> {
  if (!pool) return null;
  const r = await pool.query(
    `${ENTRY_SELECT} WHERE t.employee_id = $1 AND t.clock_out IS NULL`,
    [employeeId]
  );
  return r.rows[0] ? mapEntry(r.rows[0]) : null;
}

export async function punchIn(
  employeeId: number, location?: PunchLocation | null
): Promise<TimeEntry> {
  const p = db();
  const loc = evaluateLocation(location, await getWorkSite());
  try {
    const r = await p.query(
      `INSERT INTO time_entries
         (employee_id, clock_in, hourly_rate, source,
          in_lat, in_lng, in_accuracy_m, in_distance_m, in_location_status)
       SELECT id, NOW(), hourly_rate, 'employee', $2, $3, $4, $5, $6
         FROM employees WHERE id = $1 AND active
       RETURNING id`,
      [employeeId, loc.lat, loc.lng, loc.accuracyM, loc.distanceM, loc.status]
    );
    if (!r.rows[0]) throw new Error('This account is no longer active.');
  } catch (err) {
    // The partial unique index is what actually prevents a double punch-in;
    // a double-tap on a phone hits this rather than opening a second shift.
    if ((err as { code?: string }).code === '23505') {
      throw new Error('You are already clocked in.', { cause: err });
    }
    throw err;
  }
  const entry = await getOpenEntry(employeeId);
  if (!entry) throw new Error('Punch in failed.');
  return entry;
}

export async function punchOut(
  employeeId: number, location?: PunchLocation | null
): Promise<TimeEntry> {
  const loc = evaluateLocation(location, await getWorkSite());
  const r = await db().query(
    `UPDATE time_entries
        SET clock_out = NOW(), updated_at = NOW(),
            out_lat = $2, out_lng = $3, out_accuracy_m = $4,
            out_distance_m = $5, out_location_status = $6
      WHERE employee_id = $1 AND clock_out IS NULL
      RETURNING id`,
    [employeeId, loc.lat, loc.lng, loc.accuracyM, loc.distanceM, loc.status]
  );
  if (!r.rows[0]) throw new Error('You are not clocked in.');
  const out = await db().query(`${ENTRY_SELECT} WHERE t.id = $1`, [r.rows[0].id]);
  return mapEntry(out.rows[0]);
}

// --- Timesheets -------------------------------------------------------------

// from/to are business-timezone dates. Query a padded UTC window and filter by
// business date in JS — that stays correct across DST without timezone maths
// in SQL, and the row counts here are tiny (employees x days).
function paddedWindow(from: string, to: string): [string, string] {
  const start = new Date(`${from}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() - 1);
  const end = new Date(`${to}T00:00:00Z`);
  end.setUTCDate(end.getUTCDate() + 2);
  return [start.toISOString(), end.toISOString()];
}

export async function listEntries(
  from: string, to: string, employeeId?: number
): Promise<TimeEntry[]> {
  if (!pool) return [];
  const [start, end] = paddedWindow(from, to);
  const params: unknown[] = [start, end];
  let sql = `${ENTRY_SELECT} WHERE t.clock_in >= $1 AND t.clock_in < $2`;
  if (employeeId) {
    params.push(employeeId);
    sql += ` AND t.employee_id = $${params.length}`;
  }
  sql += ' ORDER BY t.clock_in DESC';
  const r = await pool.query(sql, params);
  return r.rows.map(mapEntry).filter((e) => e.date >= from && e.date <= to);
}

export interface EmployeeTotal {
  employeeId: number;
  employeeName: string;
  hours: number;
  laborCost: number;
  entries: number;
  openShifts: number;
  offSitePunches: number;   // punches recorded outside the work site radius
  noLocationPunches: number; // punches with no usable GPS fix
}

// Count both ends of a shift, since an employee can punch in on site and out
// from the car park down the road — or vice versa.
function locationTally(e: TimeEntry): { offSite: number; noLocation: number } {
  // Tolerate a missing location outright: an entry shape without one must not
  // take down the whole timesheet.
  const ends = [e.inLocation, e.outLocation].filter((l): l is PunchLocationRecord => Boolean(l));
  return {
    offSite: ends.filter((l) => l.status === 'out_of_range').length,
    noLocation: ends.filter((l) => l.status === 'unavailable').length,
  };
}

// Totals sum the per-row rounded values, so the column on screen always adds
// up to the total under it — which is the first thing anyone checks on a
// timesheet before it goes to payroll.
export function summarize(entries: TimeEntry[]): {
  byEmployee: EmployeeTotal[];
  totals: {
    hours: number; laborCost: number; entries: number; openShifts: number;
    offSitePunches: number; noLocationPunches: number;
  };
} {
  const map = new Map<number, EmployeeTotal>();
  for (const e of entries) {
    const cur = map.get(e.employeeId) ?? {
      employeeId: e.employeeId, employeeName: e.employeeName,
      hours: 0, laborCost: 0, entries: 0, openShifts: 0,
      offSitePunches: 0, noLocationPunches: 0,
    };
    cur.hours = round2(cur.hours + (e.hours ?? 0));
    cur.laborCost = round2(cur.laborCost + (e.laborCost ?? 0));
    cur.entries += 1;
    if (e.clockOut === null) cur.openShifts += 1;
    const tally = locationTally(e);
    cur.offSitePunches += tally.offSite;
    cur.noLocationPunches += tally.noLocation;
    map.set(e.employeeId, cur);
  }
  const byEmployee = [...map.values()].sort((a, b) => b.hours - a.hours);
  return {
    byEmployee,
    totals: {
      hours: round2(byEmployee.reduce((s, r) => s + r.hours, 0)),
      laborCost: round2(byEmployee.reduce((s, r) => s + r.laborCost, 0)),
      entries: entries.length,
      openShifts: byEmployee.reduce((s, r) => s + r.openShifts, 0),
      offSitePunches: byEmployee.reduce((s, r) => s + r.offSitePunches, 0),
      noLocationPunches: byEmployee.reduce((s, r) => s + r.noLocationPunches, 0),
    },
  };
}

// --- Admin corrections (audited) --------------------------------------------

async function writeAudit(a: {
  entryId: number | null; employeeId: number; action: string; changedBy: string;
  reason: string | null; oldIn: Date | null; oldOut: Date | null;
  newIn: Date | null; newOut: Date | null;
}): Promise<void> {
  await db().query(
    `INSERT INTO time_entry_audit
       (entry_id, employee_id, action, changed_by, reason,
        old_clock_in, old_clock_out, new_clock_in, new_clock_out)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [a.entryId, a.employeeId, a.action, a.changedBy, a.reason,
     a.oldIn, a.oldOut, a.newIn, a.newOut]
  );
}

export async function createEntryAsAdmin(
  employeeId: number, clockIn: string, clockOut: string | null,
  note: string | null, changedBy: string, reason: string | null
): Promise<TimeEntry> {
  const p = db();
  const rate = await p.query('SELECT hourly_rate FROM employees WHERE id = $1', [employeeId]);
  if (!rate.rows[0]) throw new Error('Employee not found.');
  const r = await p.query(
    `INSERT INTO time_entries (employee_id, clock_in, clock_out, hourly_rate, source, note)
     VALUES ($1, $2, $3, $4, 'admin', $5) RETURNING id`,
    [employeeId, clockIn, clockOut, rate.rows[0].hourly_rate, note]
  );
  const id = Number(r.rows[0].id);
  await writeAudit({
    entryId: id, employeeId, action: 'create', changedBy, reason,
    oldIn: null, oldOut: null,
    newIn: new Date(clockIn), newOut: clockOut ? new Date(clockOut) : null,
  });
  const out = await p.query(`${ENTRY_SELECT} WHERE t.id = $1`, [id]);
  return mapEntry(out.rows[0]);
}

export async function updateEntry(
  id: number, clockIn: string, clockOut: string | null, note: string | null,
  changedBy: string, reason: string | null
): Promise<TimeEntry | null> {
  const p = db();
  const before = await p.query(
    'SELECT employee_id, clock_in, clock_out FROM time_entries WHERE id = $1', [id]
  );
  if (!before.rows[0]) return null;
  const r = await p.query(
    `UPDATE time_entries
        SET clock_in = $2, clock_out = $3, note = $4, edited_at = NOW(), updated_at = NOW()
      WHERE id = $1 RETURNING id`,
    [id, clockIn, clockOut, note]
  );
  if (!r.rows[0]) return null;
  await writeAudit({
    entryId: id,
    employeeId: Number(before.rows[0].employee_id),
    action: 'edit', changedBy, reason,
    oldIn: before.rows[0].clock_in, oldOut: before.rows[0].clock_out,
    newIn: new Date(clockIn), newOut: clockOut ? new Date(clockOut) : null,
  });
  const out = await p.query(`${ENTRY_SELECT} WHERE t.id = $1`, [id]);
  return mapEntry(out.rows[0]);
}

export async function deleteEntry(
  id: number, changedBy: string, reason: string | null
): Promise<boolean> {
  const p = db();
  const before = await p.query(
    'SELECT employee_id, clock_in, clock_out FROM time_entries WHERE id = $1', [id]
  );
  if (!before.rows[0]) return false;
  await p.query('DELETE FROM time_entries WHERE id = $1', [id]);
  await writeAudit({
    entryId: id,
    employeeId: Number(before.rows[0].employee_id),
    action: 'delete', changedBy, reason,
    oldIn: before.rows[0].clock_in, oldOut: before.rows[0].clock_out,
    newIn: null, newOut: null,
  });
  return true;
}

export interface AuditRow {
  id: number; entryId: number | null; employeeId: number; employeeName: string;
  action: string; changedBy: string; reason: string | null;
  oldClockIn: string | null; oldClockOut: string | null;
  newClockIn: string | null; newClockOut: string | null; changedAt: string;
}

export async function listAudit(limit = 100, entryId?: number): Promise<AuditRow[]> {
  if (!pool) return [];
  const params: unknown[] = [];
  let sql = `SELECT a.*, COALESCE(e.name, '(deleted)') AS employee_name
               FROM time_entry_audit a
               LEFT JOIN employees e ON e.id = a.employee_id`;
  if (entryId) {
    params.push(entryId);
    sql += ` WHERE a.entry_id = $${params.length}`;
  }
  params.push(limit);
  sql += ` ORDER BY a.changed_at DESC LIMIT $${params.length}`;
  const r = await pool.query(sql, params);
  const iso = (d: Date | null) => (d ? d.toISOString() : null);
  return r.rows.map((x) => ({
    id: Number(x.id),
    entryId: x.entry_id === null ? null : Number(x.entry_id),
    employeeId: Number(x.employee_id),
    employeeName: x.employee_name,
    action: x.action,
    changedBy: x.changed_by,
    reason: x.reason,
    oldClockIn: iso(x.old_clock_in),
    oldClockOut: iso(x.old_clock_out),
    newClockIn: iso(x.new_clock_in),
    newClockOut: iso(x.new_clock_out),
    changedAt: x.changed_at.toISOString(),
  }));
}

// --- Payroll export ---------------------------------------------------------

const timeFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: BUSINESS_TZ, hour: '2-digit', minute: '2-digit', hour12: false,
});

// Human-readable in a spreadsheet: "on site", "OFF SITE 2.4 km", "no location".
export function locationCell(l: PunchLocationRecord | null): string {
  if (!l) return '';
  if (l.status === 'unavailable') return 'no location';
  if (l.status === 'out_of_range') {
    return l.distanceM === null ? 'OFF SITE' : `OFF SITE ${formatDistance(l.distanceM)}`;
  }
  return 'on site';
}

export function formatDistance(metres: number): string {
  return metres >= 1000 ? `${(metres / 1000).toFixed(1)} km` : `${Math.round(metres)} m`;
}

function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toPayrollCsv(entries: TimeEntry[], from: string, to: string): string {
  const { byEmployee, totals } = summarize(entries);
  const lines: string[] = [];
  lines.push(`Payroll timesheet,${from} to ${to},Timezone,${BUSINESS_TZ}`);
  lines.push('');
  lines.push('Employee,Date,Clock in,Clock out,Hours,Rate,Labor cost,In location,Out location,Source,Edited,Note');
  // Chronological is what payroll expects to read, so reverse the newest-first list.
  for (const e of [...entries].reverse()) {
    lines.push([
      e.employeeName, e.date,
      timeFormatter.format(new Date(e.clockIn)),
      e.clockOut ? timeFormatter.format(new Date(e.clockOut)) : 'STILL CLOCKED IN',
      e.hours ?? '', e.hourlyRate.toFixed(2), e.laborCost ?? '',
      locationCell(e.inLocation), e.clockOut ? locationCell(e.outLocation) : '',
      e.source, e.edited ? 'yes' : '', e.note ?? '',
    ].map(csvCell).join(','));
  }
  lines.push('');
  lines.push('Employee,Total hours,Labor cost,Shifts');
  for (const r of byEmployee) {
    lines.push([r.employeeName, r.hours, r.laborCost.toFixed(2), r.entries].map(csvCell).join(','));
  }
  lines.push(['ALL EMPLOYEES', totals.hours, totals.laborCost.toFixed(2), totals.entries].map(csvCell).join(','));
  if (totals.openShifts > 0) {
    lines.push('');
    lines.push(csvCell(`WARNING: ${totals.openShifts} shift(s) still open — those hours are not counted.`));
  }
  if (totals.offSitePunches > 0 || totals.noLocationPunches > 0) {
    lines.push('');
    lines.push(csvCell(
      `NOTE: ${totals.offSitePunches} punch(es) recorded away from the work site, ` +
      `${totals.noLocationPunches} with no location. Hours are still counted — review before paying.`
    ));
  }
  return lines.join('\n');
}
