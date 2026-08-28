import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Clock as ClockIcon, LogIn, LogOut, Loader2, PlayCircle, StopCircle,
  AlertTriangle, MapPin, MapPinOff,
} from 'lucide-react';
import {
  clockLogin, clearClockSession, fetchClockStatus, getClockName,
  hasLiveClockSession, punch, getCoords, type ClockStatus, type PunchLocationRecord,
} from '../lib/clockAuth';

// The page employees open on their phone. Deliberately one screen, one big
// button: whoever is using this is standing in a doorway, not reading a UI.

function timeOfDay(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function dayLabel(date: string): string {
  // date is YYYY-MM-DD in business time; parse as local parts so it does not
  // shift a day backwards in timezones behind UTC.
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

function distanceLabel(metres: number): string {
  return metres >= 1000 ? `${(metres / 1000).toFixed(1)} km` : `${Math.round(metres)} m`;
}

// Tells the employee plainly what was recorded. No scolding — if they are off
// site or have location off, their manager sees it; the punch still counted.
function LocationNote({ location }: { location: PunchLocationRecord }) {
  if (location.status === 'ok') {
    return (
      <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-slate-400">
        <MapPin size={13} /> Location recorded at the work site
      </p>
    );
  }
  if (location.status === 'out_of_range') {
    return (
      <p className="mt-4 flex items-start gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 text-left">
        <MapPin size={16} className="mt-0.5 shrink-0" />
        You punched in {location.distanceM === null ? 'away from' : `${distanceLabel(location.distanceM)} from`} the
        work site. Your hours still count — your manager will see this.
      </p>
    );
  }
  return (
    <p className="mt-4 flex items-start gap-2 text-sm text-slate-500 bg-surface-100 border border-surface-200 rounded-lg px-3 py-2 text-left">
      <MapPinOff size={16} className="mt-0.5 shrink-0" />
      No location was recorded for this punch. Turn on location for this site if
      your manager needs it.
    </p>
  );
}

// h.hh -> "7h 30m", which is how people read their own hours.
function hoursLabel(hours: number): string {
  const total = Math.round(hours * 60);
  return `${Math.floor(total / 60)}h ${String(total % 60).padStart(2, '0')}m`;
}

function elapsedLabel(since: string, now: number): string {
  if (!now) return '—:--:--'; // before the ticker has seeded
  const secs = Math.max(0, Math.floor((now - new Date(since).getTime()) / 1000));
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function Clock() {
  const [signedIn, setSignedIn] = useState(hasLiveClockSession());
  const [name, setName] = useState(getClockName());
  const [status, setStatus] = useState<ClockStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // Seeded by the ticking effect below — reading the clock during render is impure.
  const [now, setNow] = useState(0);

  // Login form
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');

  const load = useCallback(async () => {
    try {
      setStatus(await fetchClockStatus());
      setError('');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not load your timesheet.';
      setError(msg);
      if (!hasLiveClockSession()) setSignedIn(false);
    }
  }, []);

  useEffect(() => {
    if (signedIn) void load();
  }, [signedIn, load]);

  // Ticks the on-the-clock timer. One interval, only while it is on screen.
  useEffect(() => {
    if (!status?.onTheClock) return;
    setNow(Date.now()); // paint the real elapsed time now, not a second from now
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [status?.onTheClock]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const who = await clockLogin(login.trim(), password);
      setName(who);
      setPassword('');
      setSignedIn(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed.');
    } finally {
      setLoading(false);
    }
  }

  async function handlePunch(action: 'in' | 'out') {
    setLoading(true);
    setError('');
    try {
      // Only ask for GPS if the business has actually set up a work site, so
      // employees never see a permission prompt for an unused feature. A null
      // result (denied, off, timed out) still punches — it is recorded, not blocked.
      const coords = status?.locationRequired ? await getCoords() : null;
      setStatus(await punch(action, coords));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Punch failed.');
      // A 409 means our idea of their state was stale — resync so the button
      // shows what the server actually thinks.
      void load();
    } finally {
      setLoading(false);
    }
  }

  function handleSignOut() {
    clearClockSession();
    setSignedIn(false);
    setStatus(null);
    setName('');
  }

  if (!signedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-50 px-4 py-10">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <span className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-brand-700 text-white">
              <ClockIcon size={24} />
            </span>
            <h1 className="mt-3 text-xl font-bold text-brand-900">Time Clock</h1>
            <p className="mt-1 text-sm text-slate-500">Sign in to punch in or out</p>
          </div>

          <form onSubmit={handleLogin} className="bg-white rounded-2xl border border-surface-200 shadow-sm p-6 space-y-4">
            <div>
              <label htmlFor="login" className="block text-sm font-medium text-brand-900 mb-1">Username</label>
              <input
                id="login" type="text" inputMode="email" autoCapitalize="none" autoCorrect="off"
                autoComplete="username" value={login} onChange={(e) => setLogin(e.target.value)}
                className="w-full px-3 py-3 text-base rounded-lg border border-surface-200 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                required
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-brand-900 mb-1">Password</label>
              <input
                id="password" type="password" autoComplete="current-password"
                value={password} onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-3 text-base rounded-lg border border-surface-200 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                required
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
            )}

            <button
              type="submit" disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-brand-700 text-white rounded-lg font-medium hover:bg-brand-900 transition-colors disabled:opacity-60 cursor-pointer"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : <LogIn size={18} />}
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className="text-center mt-6">
            <Link to="/" className="text-sm text-slate-400 hover:text-brand-700">← Back to home</Link>
          </p>
        </div>
      </div>
    );
  }

  const onClock = status?.onTheClock ?? false;

  return (
    <div className="min-h-screen bg-surface-50 px-4 py-8">
      <div className="w-full max-w-md mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-500">Signed in as</p>
            <h1 className="text-xl font-bold text-brand-900">{name || 'Employee'}</h1>
          </div>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-slate-500 hover:text-brand-700 cursor-pointer"
          >
            <LogOut size={16} /> Sign out
          </button>
        </div>

        {/* Status + the one button that matters */}
        <div className="bg-white rounded-2xl border border-surface-200 shadow-sm p-6 text-center">
          {onClock && status?.openEntry ? (
            <>
              <p className="text-sm font-medium text-teal-600">On the clock</p>
              <p className="mt-2 text-4xl font-bold text-brand-900 tabular-nums">
                {elapsedLabel(status.openEntry.clockIn, now)}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Since {timeOfDay(status.openEntry.clockIn)}
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-slate-500">Not clocked in</p>
              <p className="mt-2 text-4xl font-bold text-brand-900 tabular-nums">
                {status ? hoursLabel(status.today.hours) : '—'}
              </p>
              <p className="mt-1 text-sm text-slate-500">Worked today</p>
            </>
          )}

          <button
            onClick={() => handlePunch(onClock ? 'out' : 'in')}
            disabled={loading || !status}
            className={`mt-6 w-full flex items-center justify-center gap-2 px-4 py-5 rounded-xl text-lg font-semibold text-white transition-colors disabled:opacity-60 cursor-pointer ${
              onClock ? 'bg-brand-900 hover:bg-brand-950' : 'bg-teal-600 hover:bg-teal-500'
            }`}
          >
            {loading
              ? <Loader2 size={22} className="animate-spin" />
              : onClock ? <StopCircle size={22} /> : <PlayCircle size={22} />}
            {loading ? 'Working…' : onClock ? 'Punch Out' : 'Punch In'}
          </button>

          {error && (
            <p className="mt-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 text-left">
              {error}
            </p>
          )}

          {status?.locationRequired && status.openEntry && (
            <LocationNote location={status.openEntry.inLocation} />
          )}

          {status?.openEntry?.stale && (
            <p className="mt-4 flex items-start gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 text-left">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              This shift has been open a long time. If you forgot to punch out, tell your
              manager so they can correct it.
            </p>
          )}
        </div>

        {/* Totals */}
        {status && (
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded-xl border border-surface-200 p-4">
              <p className="text-xs text-slate-500">Today</p>
              <p className="mt-1 text-lg font-bold text-brand-900">{hoursLabel(status.today.hours)}</p>
            </div>
            <div className="bg-white rounded-xl border border-surface-200 p-4">
              <p className="text-xs text-slate-500">Last {status.period.days} days</p>
              <p className="mt-1 text-lg font-bold text-brand-900">{hoursLabel(status.period.hours)}</p>
            </div>
          </div>
        )}

        {/* Recent punches — so an employee can check their own hours */}
        {status && status.recent.length > 0 && (
          <div className="bg-white rounded-2xl border border-surface-200 shadow-sm overflow-hidden">
            <h2 className="px-4 py-3 text-sm font-semibold text-brand-900 border-b border-surface-200">
              Recent shifts
            </h2>
            <ul className="divide-y divide-surface-200">
              {status.recent.map((e) => (
                <li key={e.id} className="flex items-center justify-between px-4 py-3 text-sm">
                  <div>
                    <p className="font-medium text-brand-900">{dayLabel(e.date)}</p>
                    <p className="text-slate-500">
                      {timeOfDay(e.clockIn)} – {e.clockOut ? timeOfDay(e.clockOut) : 'open'}
                      {e.edited && <span className="ml-2 text-xs text-slate-400">edited</span>}
                    </p>
                  </div>
                  <span className="font-semibold text-brand-900 tabular-nums">
                    {e.hours === null ? '—' : hoursLabel(e.hours)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
