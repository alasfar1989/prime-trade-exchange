import { useState } from 'react';
import { useExpenses, type Expense, type ExpenseInput } from '../../hooks/useExpenses';
import { RefreshCw, AlertCircle, Plus, Pencil, Trash2, Receipt, X } from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths, subDays, isSameDay } from 'date-fns';

const fmt = (d: Date) => format(d, 'yyyy-MM-dd');

function buildPresets() {
  const now = new Date();
  const lastMonth = subMonths(now, 1);
  return [
    { key: 'this-month', label: 'This month', from: fmt(startOfMonth(now)), to: fmt(endOfMonth(now)) },
    { key: 'last-month', label: 'Last month', from: fmt(startOfMonth(lastMonth)), to: fmt(endOfMonth(lastMonth)) },
    { key: 'last-30', label: 'Last 30 days', from: fmt(subDays(now, 30)), to: fmt(now) },
    { key: 'last-90', label: 'Last 90 days', from: fmt(subDays(now, 90)), to: fmt(now) },
  ];
}

function periodLabel(from: string, to: string): string {
  const f = new Date(from + 'T00:00:00');
  const t = new Date(to + 'T00:00:00');
  if (isNaN(f.getTime()) || isNaN(t.getTime())) return `${from} – ${to}`;
  const fullMonth = f.getDate() === 1 && isSameDay(t, endOfMonth(f))
    && f.getMonth() === t.getMonth() && f.getFullYear() === t.getFullYear();
  if (fullMonth) return format(f, 'MMMM yyyy');
  return `${format(f, 'MMM d')} – ${format(t, 'MMM d, yyyy')}`;
}

function money(n: number): string {
  return (n < 0 ? '-' : '') + '$' + Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Render a stored YYYY-MM-DD without constructing a UTC Date (which would
// shift the day backwards in negative-offset timezones).
function displayDate(d: string): string {
  const [y, m, day] = d.split('-');
  return `${m}/${day}/${y}`;
}

const initial = (() => {
  const now = new Date();
  return { from: fmt(startOfMonth(now)), to: fmt(endOfMonth(now)) };
})();

const EMPTY_FORM: ExpenseInput = {
  expenseDate: fmt(new Date()),
  category: '',
  description: '',
  amount: 0,
  vendor: '',
  notes: '',
};

export function ExpensesView() {
  const {
    data, from, to, setRange, loading, error, cachedAt, refresh,
    create, update, remove,
  } = useExpenses(initial.from, initial.to);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [form, setForm] = useState<ExpenseInput>(EMPTY_FORM);
  const [amountText, setAmountText] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const presets = buildPresets();
  const activeKey = presets.find((p) => p.from === from && p.to === to)?.key;
  const label = periodLabel(from, to);
  const monthValue = from.slice(0, 7);

  const rows = data?.rows ?? [];
  const totals = data?.totals;
  const byCategory = data?.byCategory ?? [];
  const categories = data?.categories ?? [];
  // Bars scale against the largest category so the biggest always fills the
  // track; the share of total is shown as text alongside.
  const maxCat = byCategory.reduce((m, c) => Math.max(m, Math.abs(c.amount)), 0) || 1;

  function openAdd() {
    setEditing(null);
    // Default into the range being viewed so entries don't land outside it:
    // today when today is inside the window, otherwise its first day.
    const today = fmt(new Date());
    const within = today >= from && today <= to;
    setForm({ ...EMPTY_FORM, expenseDate: within ? today : from });
    setAmountText('');
    setFormError(null);
    setModalOpen(true);
  }

  function openEdit(e: Expense) {
    setEditing(e);
    setForm({
      expenseDate: e.expenseDate,
      category: e.category,
      description: e.description,
      amount: e.amount,
      vendor: e.vendor ?? '',
      notes: e.notes ?? '',
    });
    setAmountText(String(e.amount));
    setFormError(null);
    setModalOpen(true);
  }

  async function handleSave() {
    const amount = Number(amountText);
    if (!form.category.trim()) { setFormError('Category is required.'); return; }
    if (!form.description.trim()) { setFormError('Description is required.'); return; }
    if (!amountText.trim() || !Number.isFinite(amount)) { setFormError('Enter a valid amount.'); return; }

    setSaving(true);
    setFormError(null);
    try {
      const payload: ExpenseInput = { ...form, amount };
      if (editing) await update(editing.id, payload);
      else await create(payload);
      setModalOpen(false);
      // An entry saved outside the current window would otherwise vanish —
      // widen the range so it stays visible.
      if (payload.expenseDate < from) setRange(payload.expenseDate, to);
      else if (payload.expenseDate > to) setRange(from, payload.expenseDate);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(e: Expense) {
    if (!confirm(`Delete "${e.description}"? This cannot be undone.`)) return;
    setDeletingId(e.id);
    try {
      await remove(e.id);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setDeletingId(null);
    }
  }

  function exportCsv() {
    const cell = (v: unknown) => {
      const s = v == null ? '' : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [['Date', 'Category', 'Description', 'Vendor', 'Notes', 'Amount'].join(',')];
    rows.forEach((r) => {
      lines.push([r.expenseDate, r.category, r.description, r.vendor, r.notes, r.amount.toFixed(2)].map(cell).join(','));
    });
    lines.push(['', '', '', '', 'TOTAL', (totals?.amount ?? 0).toFixed(2)].map(cell).join(','));
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `expenses-${from}-to-${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading && !data) {
    return (
      <div className="bg-surface-0 rounded-[var(--radius-card)] shadow-[var(--shadow-card)] p-12 text-center">
        <RefreshCw size={24} className="mx-auto text-brand-500 animate-spin mb-3" />
        <p className="text-sm text-slate-400">Loading expenses…</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="bg-surface-0 rounded-[var(--radius-card)] shadow-[var(--shadow-card)] p-12 text-center">
        <AlertCircle size={24} className="mx-auto text-status-red mb-3" />
        <p className="text-sm text-status-red">{error}</p>
        <button onClick={refresh} className="mt-4 bg-surface-100 text-brand-900 px-4 py-2 rounded-lg font-medium text-sm border border-surface-200 hover:bg-surface-200 cursor-pointer">Retry</button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Range controls */}
      <div className="bg-surface-0 rounded-[var(--radius-card)] shadow-[var(--shadow-card)] p-4 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 flex-wrap">
            {presets.map((p) => (
              <button
                key={p.key}
                onClick={() => setRange(p.from, p.to)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                  activeKey === p.key ? 'bg-brand-700 text-white' : 'bg-surface-100 text-slate-600 hover:bg-surface-200'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            {cachedAt && <span className="text-xs text-slate-400">Updated {new Date(cachedAt).toLocaleTimeString()}</span>}
            <button onClick={refresh} className="p-1.5 rounded-lg hover:bg-surface-100 cursor-pointer" disabled={loading} title="Refresh">
              <RefreshCw size={14} className={`text-slate-400 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={exportCsv}
              disabled={!rows.length}
              className="bg-surface-100 text-brand-900 px-3.5 py-1.5 rounded-lg font-medium text-sm border border-surface-200 hover:bg-surface-200 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              Export CSV
            </button>
            <button
              onClick={openAdd}
              className="flex items-center gap-1.5 bg-brand-500 text-white px-3.5 py-1.5 rounded-lg font-medium text-sm hover:bg-brand-600 cursor-pointer"
            >
              <Plus size={14} /> Add Expense
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4 flex-wrap border-t border-surface-200 pt-3">
          <label className="flex items-center gap-2 text-xs text-slate-500">
            Month
            <input
              type="month"
              value={monthValue}
              onChange={(e) => {
                const [y, m] = e.target.value.split('-').map(Number);
                if (!y || !m) return;
                const first = new Date(y, m - 1, 1);
                setRange(fmt(startOfMonth(first)), fmt(endOfMonth(first)));
              }}
              className="text-xs text-brand-900 border border-surface-200 rounded-lg px-2 py-1.5 bg-surface-0 cursor-pointer hover:border-brand-300 transition-colors"
            />
          </label>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            Custom
            <input
              type="date" value={from} max={to}
              onChange={(e) => e.target.value && setRange(e.target.value, to)}
              className="text-xs text-brand-900 border border-surface-200 rounded-lg px-2 py-1.5 bg-surface-0 cursor-pointer hover:border-brand-300 transition-colors"
            />
            <span className="text-slate-400">to</span>
            <input
              type="date" value={to} min={from}
              onChange={(e) => e.target.value && setRange(from, e.target.value)}
              className="text-xs text-brand-900 border border-surface-200 rounded-lg px-2 py-1.5 bg-surface-0 cursor-pointer hover:border-brand-300 transition-colors"
            />
          </div>
          <span className="text-xs font-semibold text-brand-700 ml-auto">{label}</span>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          <AlertCircle size={16} className="text-status-red shrink-0" />
          <p className="text-sm text-status-red">Couldn't load this range: {error}. Showing the last data — tap the refresh icon to retry.</p>
        </div>
      )}

      <div className={`space-y-6 transition-opacity ${loading ? 'opacity-40 pointer-events-none' : ''}`}>
        {/* Summary */}
        {totals && (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-surface-0 rounded-[var(--radius-card)] shadow-[var(--shadow-card)] p-6">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Expenses</p>
              <p className="text-3xl font-bold text-status-red mt-2">{money(totals.amount)}</p>
              <p className="text-xs text-slate-400 mt-1">{label}</p>
            </div>
            <div className="bg-surface-0 rounded-[var(--radius-card)] shadow-[var(--shadow-card)] p-6">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Entries</p>
              <p className="text-3xl font-bold text-brand-900 mt-2">{totals.count}</p>
              <p className="text-xs text-slate-400 mt-1">{byCategory.length} categor{byCategory.length === 1 ? 'y' : 'ies'}</p>
            </div>
            <div className="bg-surface-0 rounded-[var(--radius-card)] shadow-[var(--shadow-card)] p-6">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Biggest Category</p>
              <p className="text-2xl font-bold text-brand-900 mt-2 truncate">{byCategory[0]?.category ?? '—'}</p>
              <p className="text-xs text-slate-400 mt-1">
                {byCategory[0] ? `${money(byCategory[0].amount)}${byCategory[0].pct != null ? ` · ${byCategory[0].pct.toFixed(0)}% of total` : ''}` : 'nothing logged yet'}
              </p>
            </div>
          </div>
        )}

        {/* Category breakdown */}
        {byCategory.length > 0 && (
          <div className="bg-surface-0 rounded-[var(--radius-card)] shadow-[var(--shadow-card)] p-5">
            <h3 className="text-sm font-semibold text-brand-900 mb-4">By category</h3>
            <div className="space-y-2">
              {byCategory.map((c) => (
                <div key={c.category} className="grid grid-cols-[minmax(90px,150px)_1fr_auto] gap-3 items-center">
                  <span className="text-sm text-brand-900 truncate" title={c.category}>{c.category}</span>
                  <div className="bg-surface-100 rounded-full h-2 overflow-hidden">
                    <div className="bg-brand-500 h-full rounded-full" style={{ width: `${Math.max(2, (Math.abs(c.amount) / maxCat) * 100)}%` }} />
                  </div>
                  <span className="text-sm font-semibold text-brand-900 tabular-nums whitespace-nowrap">
                    {money(c.amount)}
                    {c.pct != null && <span className="text-xs font-normal text-slate-400 ml-1.5">{c.pct.toFixed(1)}%</span>}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Table */}
        <div className="bg-surface-0 rounded-[var(--radius-card)] shadow-[var(--shadow-card)] overflow-hidden">
          <div className="px-5 py-4 border-b border-surface-200 flex items-center gap-2">
            <Receipt size={16} className="text-brand-500" />
            <h3 className="text-sm font-semibold text-brand-900">Expenses · {label}</h3>
            <span className="text-xs text-slate-400 bg-surface-100 px-2 py-0.5 rounded-full">{rows.length}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-surface-50">
                  <th className="text-xs font-semibold uppercase tracking-wider text-slate-500 px-4 py-3">Date</th>
                  <th className="text-xs font-semibold uppercase tracking-wider text-slate-500 px-4 py-3">Category</th>
                  <th className="text-xs font-semibold uppercase tracking-wider text-slate-500 px-4 py-3">Description</th>
                  <th className="text-xs font-semibold uppercase tracking-wider text-slate-500 px-4 py-3">Vendor</th>
                  <th className="text-xs font-semibold uppercase tracking-wider text-slate-500 px-4 py-3 text-right">Amount</th>
                  <th className="text-xs font-semibold uppercase tracking-wider text-slate-500 px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-surface-200 hover:bg-brand-50/30 transition-colors">
                    <td className="px-4 py-3 text-sm text-slate-500 whitespace-nowrap">{displayDate(r.expenseDate)}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-semibold bg-brand-50 text-brand-700 px-2 py-0.5 rounded-full whitespace-nowrap">{r.category}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-brand-900 max-w-[280px]">
                      {r.description}
                      {r.notes && <span className="block text-xs text-slate-400">{r.notes}</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500">{r.vendor || <span className="text-slate-300">—</span>}</td>
                    <td className={`px-4 py-3 text-sm font-semibold text-right tabular-nums ${r.amount < 0 ? 'text-status-green' : 'text-brand-900'}`}>{money(r.amount)}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button onClick={() => openEdit(r)} className="p-1.5 rounded-lg hover:bg-surface-100 cursor-pointer" title="Edit">
                        <Pencil size={14} className="text-slate-400" />
                      </button>
                      <button onClick={() => handleDelete(r)} disabled={deletingId === r.id} className="p-1.5 rounded-lg hover:bg-red-50 cursor-pointer disabled:opacity-40" title="Delete">
                        <Trash2 size={14} className="text-status-red" />
                      </button>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && !loading && (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-sm text-slate-400">
                      No expenses logged for {label}. Click <strong>Add Expense</strong> to log one.
                    </td>
                  </tr>
                )}
              </tbody>
              {rows.length > 0 && totals && (
                <tfoot>
                  <tr className="bg-surface-50 border-t-2 border-surface-200">
                    <td colSpan={4} className="px-4 py-3 text-sm font-semibold text-brand-900">Total</td>
                    <td className="px-4 py-3 text-sm font-bold text-right tabular-nums text-brand-900">{money(totals.amount)}</td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>

      {/* Add / Edit modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/45 flex items-center justify-center z-50 p-4" onClick={() => !saving && setModalOpen(false)}>
          <div className="bg-surface-0 rounded-[var(--radius-card)] w-full max-w-md p-6 max-h-[90vh] overflow-y-auto shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-brand-900">{editing ? 'Edit Expense' : 'Add Expense'}</h2>
              <button onClick={() => setModalOpen(false)} disabled={saving} className="p-1 rounded-lg hover:bg-surface-100 cursor-pointer">
                <X size={18} className="text-slate-400" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-semibold text-slate-600">Date</span>
                  <input
                    type="date" value={form.expenseDate}
                    onChange={(e) => setForm({ ...form, expenseDate: e.target.value })}
                    className="mt-1 w-full text-sm border border-surface-200 rounded-lg px-2.5 py-2 bg-surface-0"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-slate-600">Amount ($)</span>
                  <input
                    type="number" step="0.01" value={amountText} placeholder="0.00"
                    onChange={(e) => setAmountText(e.target.value)}
                    className="mt-1 w-full text-sm border border-surface-200 rounded-lg px-2.5 py-2 bg-surface-0"
                  />
                  <span className="text-[11px] text-slate-400">Negative for a refund/credit.</span>
                </label>
              </div>

              <label className="block">
                <span className="text-xs font-semibold text-slate-600">Category</span>
                <input
                  type="text" list="expenseCategories" value={form.category} placeholder="Shipping supplies"
                  autoComplete="off"
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="mt-1 w-full text-sm border border-surface-200 rounded-lg px-2.5 py-2 bg-surface-0"
                />
                <datalist id="expenseCategories">
                  {categories.map((c) => <option key={c} value={c} />)}
                </datalist>
                <span className="text-[11px] text-slate-400">Type anything — categories you've used before will autocomplete.</span>
              </label>

              <label className="block">
                <span className="text-xs font-semibold text-slate-600">Description</span>
                <input
                  type="text" value={form.description} placeholder="Boxes and poly mailers"
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="mt-1 w-full text-sm border border-surface-200 rounded-lg px-2.5 py-2 bg-surface-0"
                />
              </label>

              <label className="block">
                <span className="text-xs font-semibold text-slate-600">Vendor (optional)</span>
                <input
                  type="text" value={form.vendor ?? ''} placeholder="Uline"
                  onChange={(e) => setForm({ ...form, vendor: e.target.value })}
                  className="mt-1 w-full text-sm border border-surface-200 rounded-lg px-2.5 py-2 bg-surface-0"
                />
              </label>

              <label className="block">
                <span className="text-xs font-semibold text-slate-600">Notes (optional)</span>
                <textarea
                  rows={2} value={form.notes ?? ''}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="mt-1 w-full text-sm border border-surface-200 rounded-lg px-2.5 py-2 bg-surface-0"
                />
              </label>

              {formError && <p className="text-sm text-status-red">{formError}</p>}
            </div>

            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={() => setModalOpen(false)} disabled={saving}
                className="bg-surface-100 text-brand-900 px-4 py-2 rounded-lg font-medium text-sm border border-surface-200 hover:bg-surface-200 cursor-pointer disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                onClick={handleSave} disabled={saving}
                className="bg-brand-500 text-white px-4 py-2 rounded-lg font-medium text-sm hover:bg-brand-600 cursor-pointer disabled:opacity-40"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
