import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Loader2, Plus, Pencil, Trash2, Download, Users, CalendarClock,
  AlertTriangle, History, X, MapPin, MapPinOff, Crosshair,
} from 'lucide-react';
import { fetchApi, postApi, putApi, deleteApi } from '../../lib/api';
import { getToken } from '../../lib/auth';

// Admin view of the employee time clock: who worked, how many hours, what it
// cost, plus corrections (always with a reason, always audited) and the
// payroll CSV export.

interface Employee {
  id: number; name: string; login: string;
  hourlyRate: number; active: boolean; createdAt: string;
}

type LocationStatus = 'ok' | 'out_of_range' | 'unavailable';

interface PunchLocationRecord {
  lat: number | null; lng: number | null; accuracyM: number | null;
  distanceM: number | null; status: LocationStatus;
}

interface WorkSite { lat: number; lng: number; radiusM: number; label: string }

interface TimeEntry {
  id: number; employeeId: number; employeeName: string; date: string;
  clockIn: string; clockOut: string | null; hours: number | null;
  hourlyRate: number; laborCost: number | null; source: string;
  note: string | null; edited: boolean; stale: boolean;
  inLocation: PunchLocationRecord; outLocation: PunchLocationRecord | null;
}

interface EmployeeTotal {
  employeeId: number; employeeName: string;
  hours: number; laborCost: number; entries: number; openShifts: number;
  offSitePunches: number; noLocationPunches: number;
}

interface TimesheetPayload {
  rows: TimeEntry[];
  byEmployee: EmployeeTotal[];
  totals: {
    hours: number; laborCost: number; entries: number; openShifts: number;
    offSitePunches: number; noLocationPunches: number;
  };
  range: { from: string; to: string };
  site: WorkSite | null;
}

interface AuditRow {
  id: number; entryId: number | null; employeeName: string; action: string;
  changedBy: string; reason: string | null;
  oldClockIn: string | null; oldClockOut: string | null;
  newClockIn: string | null; newClockOut: string | null; changedAt: string;
}

function locationWarning(
  totals: { offSitePunches: number; noLocationPunches: number },
  siteLabel: string
): string {
  const parts: string[] = [];
  if (totals.offSitePunches > 0) {
    parts.push(
      `${totals.offSitePunches} punch${totals.offSitePunches === 1 ? '' : 'es'} recorded away from ${siteLabel}`
    );
  }
  if (totals.noLocationPunches > 0) {
    parts.push(
      `${totals.noLocationPunches} punch${totals.noLocationPunches === 1 ? '' : 'es'} with no location`
    );
  }
  return `${parts.join(', ')}. These hours are still counted — review them before paying.`;
}

function distanceLabel(metres: number): string {
  return metres >= 1000 ? `${(metres / 1000).toFixed(1)} km` : `${Math.round(metres)} m`;
}

// One punch's location, as a compact badge. Off-site is the only thing that
// gets colour — a missing fix is a fact to notice, not an accusation.
function LocationBadge({ location, label }: { location: PunchLocationRecord | null; label: string }) {
  if (!location) return null;
  if (location.status === 'out_of_range') {
    return (
      <span
        className="inline-flex items-center gap-1 text-xs font-medium text-amber-700"
        title={`${label}: ${location.distanceM === null ? 'off site' : `${distanceLabel(location.distanceM)} from the work site`}`}
      >
        <MapPin size={12} />
        {location.distanceM === null ? 'off site' : distanceLabel(location.distanceM)}
      </span>
    );
  }
  if (location.status === 'unavailable') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-slate-400" title={`${label}: no location recorded`}>
        <MapPinOff size={12} /> none
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs text-teal-600" title={`${label}: at the work site`}>
      <MapPin size={12} /> on site
    </span>
  );
}

const money = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

const dateTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString([], {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  }) : '—';

// <input type="datetime-local"> speaks local wall-clock time with no zone, so
// convert in both directions explicitly rather than letting the server guess.
function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function fromLocalInput(value: string): string | null {
  if (!value) return null;
  const d = new Date(value); // no zone suffix -> parsed as local time
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function monthStart(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function TimeclockView() {
  const [tab, setTab] = useState<'timesheets' | 'employees' | 'audit' | 'site'>('timesheets');
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(today());
  const [employeeId, setEmployeeId] = useState('');

  const [sheet, setSheet] = useState<TimesheetPayload | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);

  const [entryModal, setEntryModal] = useState<{ entry: TimeEntry | null } | null>(null);
  const [employeeModal, setEmployeeModal] = useState<{ employee: Employee | null } | null>(null);

  const loadSheet = useCallback(async () => {
    const params: Record<string, string> = { from, to };
    if (employeeId) params.employeeId = employeeId;
    const res = await fetchApi<TimesheetPayload>('/timesheets', params);
    setSheet(res.data);
  }, [from, to, employeeId]);

  const loadEmployees = useCallback(async () => {
    const res = await fetchApi<Employee[]>('/employees');
    setEmployees(res.data);
  }, []);

  const loadAudit = useCallback(async () => {
    const res = await fetchApi<AuditRow[]>('/timesheets/audit');
    setAudit(res.data);
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      await Promise.all([loadSheet(), loadEmployees(), loadAudit()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the time clock.');
    } finally {
      setLoading(false);
    }
  }, [loadSheet, loadEmployees, loadAudit]);

  useEffect(() => { void loadAll(); }, [loadAll]);

  // The CSV route needs the auth headers, so it cannot be a plain <a href>.
  async function handleExport() {
    setExporting(true);
    setError('');
    try {
      const base = import.meta.env.VITE_API_URL || 'http://localhost:3002/api';
      const key = import.meta.env.VITE_API_KEY || 'pte-api-2026-secret';
      const url = new URL(`${base}/timesheets/export`);
      url.searchParams.set('from', from);
      url.searchParams.set('to', to);
      if (employeeId) url.searchParams.set('employeeId', employeeId);
      const res = await fetch(url.toString(), {
        headers: { 'X-API-Key': key, Authorization: `Bearer ${getToken() ?? ''}` },
      });
      if (!res.ok) throw new Error(`Export failed (${res.status})`);
      const blob = await res.blob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = href;
      a.download = `timesheet-${from}_to_${to}.csv`;
      a.click();
      URL.revokeObjectURL(href);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed.');
    } finally {
      setExporting(false);
    }
  }

  async function handleDeleteEntry(entry: TimeEntry) {
    const reason = window.prompt(
      `Delete ${entry.employeeName}'s shift on ${entry.date}?\n\nReason (recorded in the audit trail):`
    );
    if (reason === null) return;
    if (!reason.trim()) { setError('A reason is required to delete a punch.'); return; }
    try {
      await deleteApi(`/timesheets/${entry.id}?reason=${encodeURIComponent(reason.trim())}`);
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed.');
    }
  }

  async function handleDeleteEmployee(emp: Employee) {
    const sure = window.confirm(
      `Delete ${emp.name}?\n\nThis also deletes every time entry they have. ` +
      `To keep their history, edit them and untick Active instead.`
    );
    if (!sure) return;
    try {
      await deleteApi(`/employees/${emp.id}`);
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed.');
    }
  }

  const activeCount = useMemo(() => employees.filter((e) => e.active).length, [employees]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-500">
        <Loader2 size={20} className="animate-spin mr-2" /> Loading time clock…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
      )}

      {/* Sub-navigation */}
      <div className="flex items-center gap-1 border-b border-surface-200">
        {([
          { id: 'timesheets', label: 'Timesheets', icon: CalendarClock },
          { id: 'employees', label: 'Employees', icon: Users },
          { id: 'audit', label: 'Change log', icon: History },
          { id: 'site', label: 'Work site', icon: MapPin },
        ] as const).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
              tab === t.id
                ? 'border-brand-500 text-brand-700'
                : 'border-transparent text-slate-500 hover:text-brand-900'
            }`}
          >
            <t.icon size={15} /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'timesheets' && sheet && (
        <>
          {/* Filters */}
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-sm">
              <span className="block text-xs text-slate-500 mb-1">From</span>
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
                className="px-3 py-2 rounded-lg border border-surface-200 text-sm" />
            </label>
            <label className="text-sm">
              <span className="block text-xs text-slate-500 mb-1">To</span>
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
                className="px-3 py-2 rounded-lg border border-surface-200 text-sm" />
            </label>
            <label className="text-sm">
              <span className="block text-xs text-slate-500 mb-1">Employee</span>
              <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}
                className="px-3 py-2 rounded-lg border border-surface-200 text-sm">
                <option value="">All employees</option>
                {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </label>
            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={() => setEntryModal({ entry: null })}
                className="flex items-center gap-2 px-3 py-2 bg-brand-50 text-brand-700 rounded-lg text-sm font-medium hover:bg-brand-100 cursor-pointer"
              >
                <Plus size={15} /> Add entry
              </button>
              <button
                onClick={handleExport} disabled={exporting}
                className="flex items-center gap-2 px-3 py-2 bg-brand-700 text-white rounded-lg text-sm font-medium hover:bg-brand-900 disabled:opacity-60 cursor-pointer"
              >
                {exporting ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
                Export payroll CSV
              </button>
            </div>
          </div>

          {/* Summary */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <SummaryTile label="Total hours" value={sheet.totals.hours.toFixed(2)} />
            <SummaryTile label="Labor cost" value={money(sheet.totals.laborCost)} />
            <SummaryTile label="Shifts" value={String(sheet.totals.entries)} />
            <SummaryTile
              label="Still clocked in"
              value={String(sheet.totals.openShifts)}
              warn={sheet.totals.openShifts > 0}
            />
          </div>

          {sheet.site && (sheet.totals.offSitePunches > 0 || sheet.totals.noLocationPunches > 0) && (
            <p className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
              <MapPin size={16} className="mt-0.5 shrink-0" />
              <span>{locationWarning(sheet.totals, sheet.site.label)}</span>
            </p>
          )}

          {!sheet.site && (
            <p className="flex items-start gap-2 text-sm text-slate-500 bg-surface-100 border border-surface-200 rounded-lg px-3 py-2">
              <MapPinOff size={16} className="mt-0.5 shrink-0" />
              Location tracking is off — punches are not checked against a work site.
              Set one under <button onClick={() => setTab('site')} className="underline cursor-pointer">Work site</button> to
              see where people punch in from.
            </p>
          )}

          {sheet.totals.openShifts > 0 && (
            <p className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              {sheet.totals.openShifts} shift{sheet.totals.openShifts === 1 ? ' is' : 's are'} still
              open. Open shifts contribute no hours until they are punched out or corrected, so the
              totals above are short until then.
            </p>
          )}

          {/* Per-employee rollup */}
          {sheet.byEmployee.length > 0 && (
            <Panel title="Hours by employee">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500 border-b border-surface-200">
                    <th className="px-4 py-2 font-medium">Employee</th>
                    <th className="px-4 py-2 font-medium text-right">Shifts</th>
                    <th className="px-4 py-2 font-medium text-right">Hours</th>
                    <th className="px-4 py-2 font-medium text-right">Labor cost</th>
                    {sheet.site && <th className="px-4 py-2 font-medium text-right">Off site</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-200">
                  {sheet.byEmployee.map((r) => (
                    <tr key={r.employeeId}>
                      <td className="px-4 py-2.5 font-medium text-brand-900">{r.employeeName}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{r.entries}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-semibold">{r.hours.toFixed(2)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{money(r.laborCost)}</td>
                      {sheet.site && (
                        <td className={`px-4 py-2.5 text-right tabular-nums ${r.offSitePunches > 0 ? 'text-amber-700 font-semibold' : 'text-slate-400'}`}>
                          {r.offSitePunches || '—'}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-surface-200 font-semibold text-brand-900">
                    <td className="px-4 py-2.5">Total</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{sheet.totals.entries}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{sheet.totals.hours.toFixed(2)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{money(sheet.totals.laborCost)}</td>
                    {sheet.site && (
                      <td className="px-4 py-2.5 text-right tabular-nums">{sheet.totals.offSitePunches || '—'}</td>
                    )}
                  </tr>
                </tfoot>
              </table>
            </Panel>
          )}

          {/* Individual punches */}
          <Panel title="Punches">
            {sheet.rows.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-slate-500">
                No punches in this date range.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500 border-b border-surface-200">
                    <th className="px-4 py-2 font-medium">Employee</th>
                    <th className="px-4 py-2 font-medium">Date</th>
                    <th className="px-4 py-2 font-medium">In</th>
                    <th className="px-4 py-2 font-medium">Out</th>
                    {sheet.site && <th className="px-4 py-2 font-medium">Location</th>}
                    <th className="px-4 py-2 font-medium text-right">Hours</th>
                    <th className="px-4 py-2 font-medium text-right">Cost</th>
                    <th className="px-4 py-2 font-medium"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-200">
                  {sheet.rows.map((e) => (
                    <tr key={e.id} className={e.stale ? 'bg-amber-50' : undefined}>
                      <td className="px-4 py-2.5 font-medium text-brand-900">{e.employeeName}</td>
                      <td className="px-4 py-2.5 text-slate-500">{e.date}</td>
                      <td className="px-4 py-2.5">{dateTime(e.clockIn)}</td>
                      <td className="px-4 py-2.5">
                        {e.clockOut ? dateTime(e.clockOut) : (
                          <span className="text-teal-600 font-medium">on the clock</span>
                        )}
                      </td>
                      {sheet.site && (
                        <td className="px-4 py-2.5">
                          <div className="flex flex-col gap-0.5">
                            <LocationBadge location={e.inLocation} label="Punch in" />
                            {e.clockOut && <LocationBadge location={e.outLocation} label="Punch out" />}
                          </div>
                        </td>
                      )}
                      <td className="px-4 py-2.5 text-right tabular-nums font-semibold">
                        {e.hours === null ? '—' : e.hours.toFixed(2)}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">
                        {e.laborCost === null ? '—' : money(e.laborCost)}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center justify-end gap-1">
                          {e.edited && (
                            <span className="text-xs text-slate-400 mr-1" title="This punch was corrected">edited</span>
                          )}
                          {e.source === 'admin' && (
                            <span className="text-xs text-slate-400 mr-1" title="Added by an admin">manual</span>
                          )}
                          <button onClick={() => setEntryModal({ entry: e })}
                            className="p-1.5 text-slate-400 hover:text-brand-700 cursor-pointer" title="Edit">
                            <Pencil size={15} />
                          </button>
                          <button onClick={() => void handleDeleteEntry(e)}
                            className="p-1.5 text-slate-400 hover:text-red-600 cursor-pointer" title="Delete">
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>
        </>
      )}

      {tab === 'employees' && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">
              {employees.length} employee{employees.length === 1 ? '' : 's'} · {activeCount} active
            </p>
            <button
              onClick={() => setEmployeeModal({ employee: null })}
              className="flex items-center gap-2 px-3 py-2 bg-brand-700 text-white rounded-lg text-sm font-medium hover:bg-brand-900 cursor-pointer"
            >
              <Plus size={15} /> Add employee
            </button>
          </div>

          <Panel title="Employees">
            {employees.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-slate-500">
                No employees yet. Add one, then give them the username and password —
                they punch in at <span className="font-mono">/clock</span> on their phone.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500 border-b border-surface-200">
                    <th className="px-4 py-2 font-medium">Name</th>
                    <th className="px-4 py-2 font-medium">Username</th>
                    <th className="px-4 py-2 font-medium text-right">Rate</th>
                    <th className="px-4 py-2 font-medium">Status</th>
                    <th className="px-4 py-2 font-medium"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-200">
                  {employees.map((e) => (
                    <tr key={e.id}>
                      <td className="px-4 py-2.5 font-medium text-brand-900">{e.name}</td>
                      <td className="px-4 py-2.5 font-mono text-slate-500">{e.login}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{money(e.hourlyRate)}/hr</td>
                      <td className="px-4 py-2.5">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          e.active ? 'bg-teal-50 text-teal-600' : 'bg-surface-100 text-slate-500'
                        }`}>
                          {e.active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => setEmployeeModal({ employee: e })}
                            className="p-1.5 text-slate-400 hover:text-brand-700 cursor-pointer" title="Edit">
                            <Pencil size={15} />
                          </button>
                          <button onClick={() => void handleDeleteEmployee(e)}
                            className="p-1.5 text-slate-400 hover:text-red-600 cursor-pointer" title="Delete">
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>
        </>
      )}

      {tab === 'audit' && (
        <Panel title="Every change made to a punch">
          {audit.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-slate-500">
              No corrections have been made yet.
            </p>
          ) : (
            <ul className="divide-y divide-surface-200">
              {audit.map((a) => (
                <li key={a.id} className="px-4 py-3 text-sm">
                  <div className="flex items-center justify-between gap-4">
                    <p className="font-medium text-brand-900">
                      <span className="capitalize">{a.action}</span> · {a.employeeName}
                    </p>
                    <span className="text-xs text-slate-400 shrink-0">{dateTime(a.changedAt)}</span>
                  </div>
                  <p className="mt-1 text-slate-500">
                    {a.action === 'delete'
                      ? `Removed ${dateTime(a.oldClockIn)} – ${dateTime(a.oldClockOut)}`
                      : a.action === 'create'
                        ? `Added ${dateTime(a.newClockIn)} – ${dateTime(a.newClockOut)}`
                        : `${dateTime(a.oldClockIn)} – ${dateTime(a.oldClockOut)} → ${dateTime(a.newClockIn)} – ${dateTime(a.newClockOut)}`}
                  </p>
                  {a.reason && <p className="mt-0.5 text-slate-500 italic">“{a.reason}”</p>}
                  <p className="mt-0.5 text-xs text-slate-400">by {a.changedBy}</p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}

      {tab === 'site' && (
        <WorkSitePanel
          site={sheet?.site ?? null}
          onSaved={async () => { await loadAll(); }}
        />
      )}

      {entryModal && (
        <EntryModal
          entry={entryModal.entry}
          employees={employees}
          onClose={() => setEntryModal(null)}
          onSaved={async () => { setEntryModal(null); await loadAll(); }}
        />
      )}

      {employeeModal && (
        <EmployeeModal
          employee={employeeModal.employee}
          onClose={() => setEmployeeModal(null)}
          onSaved={async () => { setEmployeeModal(null); await loadAll(); }}
        />
      )}
    </div>
  );
}

// Where punches are measured from. The capture button is the point: the admin
// stands in the warehouse, taps it, and the geofence is set — no looking up
// coordinates, which is where this kind of feature usually dies.
function WorkSitePanel({ site, onSaved }: { site: WorkSite | null; onSaved: () => void | Promise<void> }) {
  const [lat, setLat] = useState(site ? String(site.lat) : '');
  const [lng, setLng] = useState(site ? String(site.lng) : '');
  const [radiusM, setRadiusM] = useState(String(site?.radiusM ?? 150));
  const [label, setLabel] = useState(site?.label ?? 'Warehouse');
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');

  function capture() {
    setError('');
    setSaved('');
    if (!navigator.geolocation) {
      setError('This browser cannot report a location. Enter the coordinates by hand.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(6));
        setLng(pos.coords.longitude.toFixed(6));
        setAccuracy(Number.isFinite(pos.coords.accuracy) ? pos.coords.accuracy : null);
        setLocating(false);
      },
      (err) => {
        setError(
          err.code === err.PERMISSION_DENIED
            ? 'Location permission was denied. Allow it for this site, or enter the coordinates by hand.'
            : 'Could not get a location fix. Try again outdoors, or enter the coordinates by hand.'
        );
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10_000 }
    );
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSaved('');
    try {
      await putApi('/timeclock/site', {
        lat: Number(lat), lng: Number(lng), radiusM: Number(radiusM), label,
      });
      setSaved('Work site saved. New punches are checked against it.');
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  }

  async function turnOff() {
    if (!window.confirm('Turn location tracking off? Punches will no longer be checked against a work site.')) return;
    setSaving(true);
    setError('');
    setSaved('');
    try {
      await putApi('/timeclock/site', { clear: true });
      setLat(''); setLng(''); setAccuracy(null);
      setSaved('Location tracking is off.');
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not turn tracking off.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-4">
      <div className="bg-white rounded-2xl border border-surface-200 shadow-sm p-6">
        <h3 className="font-semibold text-brand-900">Work site</h3>
        <p className="mt-1 text-sm text-slate-500">
          Punches are compared against this spot. Nobody is ever blocked from punching —
          a punch from outside the radius is recorded and flagged on the timesheet.
        </p>

        <div className={`mt-4 flex items-center gap-2 text-sm rounded-lg px-3 py-2 ${
          site ? 'bg-teal-50 text-teal-600' : 'bg-surface-100 text-slate-500'
        }`}>
          {site ? <MapPin size={16} /> : <MapPinOff size={16} />}
          {site
            ? `Tracking is on — ${site.label}, ${site.radiusM} m radius`
            : 'Tracking is off — punch locations are not being checked'}
        </div>

        <form onSubmit={save} className="mt-5 space-y-4">
          <button
            type="button" onClick={capture} disabled={locating}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-brand-50 text-brand-700 rounded-lg font-medium hover:bg-brand-100 disabled:opacity-60 cursor-pointer"
          >
            {locating ? <Loader2 size={17} className="animate-spin" /> : <Crosshair size={17} />}
            {locating ? 'Getting your location…' : 'Use my current location'}
          </button>
          <p className="text-xs text-slate-400 text-center -mt-2">
            Do this standing at the warehouse for the most accurate geofence.
            {accuracy !== null && ` Last fix was accurate to about ${Math.round(accuracy)} m.`}
          </p>

          <label className="block">
            <span className="block text-sm font-medium text-brand-900 mb-1">Name</span>
            <input type="text" value={label} onChange={(e) => setLabel(e.target.value)}
              className={inputClass} placeholder="Warehouse" required />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-sm font-medium text-brand-900 mb-1">Latitude</span>
              <input type="number" step="any" min="-90" max="90" value={lat}
                onChange={(e) => setLat(e.target.value)} className={inputClass} required />
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-brand-900 mb-1">Longitude</span>
              <input type="number" step="any" min="-180" max="180" value={lng}
                onChange={(e) => setLng(e.target.value)} className={inputClass} required />
            </label>
          </div>

          <label className="block">
            <span className="block text-sm font-medium text-brand-900 mb-1">Radius (metres)</span>
            <input type="number" min="25" max="20000" step="5" value={radiusM}
              onChange={(e) => setRadiusM(e.target.value)} className={inputClass} required />
            <span className="block mt-1 text-xs text-slate-400">
              150 m suits a warehouse and its car park. Phone GPS accuracy is added on top,
              so someone standing inside the building is not flagged by ordinary drift.
            </span>
          </label>

          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}
          {saved && <p className="text-sm text-teal-600 bg-teal-50 border border-teal-100 rounded-lg px-3 py-2">{saved}</p>}

          <div className="flex items-center justify-between pt-1">
            {site ? (
              <button type="button" onClick={turnOff} disabled={saving}
                className="px-4 py-2 text-sm text-slate-500 hover:text-red-600 cursor-pointer">
                Turn tracking off
              </button>
            ) : <span />}
            <button type="submit" disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-brand-700 text-white rounded-lg text-sm font-medium hover:bg-brand-900 disabled:opacity-60 cursor-pointer">
              {saving && <Loader2 size={15} className="animate-spin" />} Save work site
            </button>
          </div>
        </form>
      </div>

      <p className="text-xs text-slate-400">
        Employees punch from their own phones, so a location is only as honest as the
        device reporting it. This catches casual "punching in from home", not someone
        deliberately faking GPS.
      </p>
    </div>
  );
}

function SummaryTile({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 ${warn ? 'border-amber-200 bg-amber-50' : 'border-surface-200 bg-white'}`}>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-brand-900 tabular-nums">{value}</p>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-surface-200 shadow-sm overflow-hidden">
      <h3 className="px-4 py-3 text-sm font-semibold text-brand-900 border-b border-surface-200">{title}</h3>
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-950/40 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-200">
          <h3 className="font-semibold text-brand-900">{title}</h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-brand-900 cursor-pointer">
            <X size={18} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

const inputClass =
  'w-full px-3 py-2 rounded-lg border border-surface-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent';

function EntryModal({ entry, employees, onClose, onSaved }: {
  entry: TimeEntry | null;
  employees: Employee[];
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const [employeeId, setEmployeeId] = useState(String(entry?.employeeId ?? employees[0]?.id ?? ''));
  const [clockIn, setClockIn] = useState(toLocalInput(entry?.clockIn ?? null));
  const [clockOut, setClockOut] = useState(toLocalInput(entry?.clockOut ?? null));
  const [note, setNote] = useState(entry?.note ?? '');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const body = {
        employeeId: Number(employeeId),
        clockIn: fromLocalInput(clockIn),
        clockOut: fromLocalInput(clockOut),
        note, reason,
      };
      if (entry) await putApi(`/timesheets/${entry.id}`, body);
      else await postApi('/timesheets', body);
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={entry ? 'Correct punch' : 'Add a missed punch'} onClose={onClose}>
      <form onSubmit={handleSave} className="space-y-4">
        {!entry && (
          <label className="block">
            <span className="block text-sm font-medium text-brand-900 mb-1">Employee</span>
            <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className={inputClass} required>
              {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </label>
        )}
        {entry && (
          <p className="text-sm text-slate-500">
            {entry.employeeName} · {entry.date}
          </p>
        )}

        <label className="block">
          <span className="block text-sm font-medium text-brand-900 mb-1">Clock in</span>
          <input type="datetime-local" value={clockIn} onChange={(e) => setClockIn(e.target.value)}
            className={inputClass} required />
        </label>

        <label className="block">
          <span className="block text-sm font-medium text-brand-900 mb-1">
            Clock out <span className="font-normal text-slate-400">— leave blank to leave the shift open</span>
          </span>
          <input type="datetime-local" value={clockOut} onChange={(e) => setClockOut(e.target.value)}
            className={inputClass} />
        </label>

        <label className="block">
          <span className="block text-sm font-medium text-brand-900 mb-1">
            Note <span className="font-normal text-slate-400">— optional</span>
          </span>
          <input type="text" value={note} onChange={(e) => setNote(e.target.value)} className={inputClass} />
        </label>

        <label className="block">
          <span className="block text-sm font-medium text-brand-900 mb-1">Reason for the change</span>
          <input type="text" value={reason} onChange={(e) => setReason(e.target.value)}
            className={inputClass} placeholder="e.g. forgot to punch out" required />
          <span className="block mt-1 text-xs text-slate-400">
            Recorded in the change log with your name and the before/after times.
          </span>
        </label>

        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose}
            className="px-4 py-2 text-sm text-slate-500 hover:text-brand-900 cursor-pointer">Cancel</button>
          <button type="submit" disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-brand-700 text-white rounded-lg text-sm font-medium hover:bg-brand-900 disabled:opacity-60 cursor-pointer">
            {saving && <Loader2 size={15} className="animate-spin" />} Save
          </button>
        </div>
      </form>
    </Modal>
  );
}

function EmployeeModal({ employee, onClose, onSaved }: {
  employee: Employee | null;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const [name, setName] = useState(employee?.name ?? '');
  const [login, setLogin] = useState(employee?.login ?? '');
  const [hourlyRate, setHourlyRate] = useState(String(employee?.hourlyRate ?? '0'));
  const [active, setActive] = useState(employee?.active ?? true);
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const body: Record<string, unknown> = {
        name, login, hourlyRate: Number(hourlyRate), active,
      };
      if (password) body.password = password;
      if (employee) await putApi(`/employees/${employee.id}`, body);
      else await postApi('/employees', body);
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={employee ? 'Edit employee' : 'Add employee'} onClose={onClose}>
      <form onSubmit={handleSave} className="space-y-4">
        <label className="block">
          <span className="block text-sm font-medium text-brand-900 mb-1">Full name</span>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} required />
        </label>

        <label className="block">
          <span className="block text-sm font-medium text-brand-900 mb-1">Username</span>
          <input type="text" value={login} onChange={(e) => setLogin(e.target.value)}
            className={inputClass} autoCapitalize="none" required />
          <span className="block mt-1 text-xs text-slate-400">
            What they type at /clock. Letters, numbers, . _ - @
          </span>
        </label>

        <label className="block">
          <span className="block text-sm font-medium text-brand-900 mb-1">
            {employee ? 'New password — leave blank to keep the current one' : 'Password'}
          </span>
          <input type="text" value={password} onChange={(e) => setPassword(e.target.value)}
            className={inputClass} autoComplete="new-password" required={!employee} minLength={6} />
          <span className="block mt-1 text-xs text-slate-400">
            Shown in plain text so you can read it out to them. At least 6 characters.
          </span>
        </label>

        <label className="block">
          <span className="block text-sm font-medium text-brand-900 mb-1">Hourly rate</span>
          <input type="number" step="0.01" min="0" value={hourlyRate}
            onChange={(e) => setHourlyRate(e.target.value)} className={inputClass} required />
          <span className="block mt-1 text-xs text-slate-400">
            Used for labor cost. Changing it only affects shifts started from now on.
          </span>
        </label>

        <label className="flex items-center gap-2 text-sm text-brand-900">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)}
            className="rounded border-surface-200" />
          Active — can sign in and punch
        </label>

        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose}
            className="px-4 py-2 text-sm text-slate-500 hover:text-brand-900 cursor-pointer">Cancel</button>
          <button type="submit" disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-brand-700 text-white rounded-lg text-sm font-medium hover:bg-brand-900 disabled:opacity-60 cursor-pointer">
            {saving && <Loader2 size={15} className="animate-spin" />} Save
          </button>
        </div>
      </form>
    </Modal>
  );
}
