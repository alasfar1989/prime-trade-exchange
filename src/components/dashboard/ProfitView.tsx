import { useProfit } from '../../hooks/useProfit';
import { RefreshCw, TrendingUp, AlertCircle, Info, Download } from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths, subDays, isSameDay } from 'date-fns';
import { openProfitReport } from '../../lib/profitReport';

const fmt = (d: Date) => format(d, 'yyyy-MM-dd');

function buildPresets() {
  const now = new Date();
  const lastMonth = subMonths(now, 1);
  return [
    { key: 'this-month', label: 'This month', from: fmt(startOfMonth(now)), to: fmt(now) },
    { key: 'last-month', label: 'Last month', from: fmt(startOfMonth(lastMonth)), to: fmt(endOfMonth(lastMonth)) },
    { key: 'last-30', label: 'Last 30 days', from: fmt(subDays(now, 30)), to: fmt(now) },
    { key: 'last-90', label: 'Last 90 days', from: fmt(subDays(now, 90)), to: fmt(now) },
  ];
}

// Human label for the selected window (e.g. "June 2026" or "Jun 1 – Jun 15, 2026").
function periodLabel(from: string, to: string): string {
  const f = new Date(from + 'T00:00:00');
  const t = new Date(to + 'T00:00:00');
  if (isNaN(f.getTime()) || isNaN(t.getTime())) return `${from} – ${to}`;
  const fullMonth = f.getDate() === 1 && isSameDay(t, endOfMonth(f)) && f.getMonth() === t.getMonth() && f.getFullYear() === t.getFullYear();
  if (fullMonth) return format(f, 'MMMM yyyy');
  const sameYear = f.getFullYear() === t.getFullYear();
  return `${format(f, 'MMM d')} – ${format(t, sameYear ? 'MMM d, yyyy' : 'MMM d, yyyy')}${sameYear ? '' : ''}`;
}

function money(n: number): string {
  return (n < 0 ? '-' : '') + '$' + Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const initial = (() => {
  const now = new Date();
  return { from: fmt(subDays(now, 30)), to: fmt(now) };
})();

export function ProfitView() {
  const { data, from, to, setRange, loading, error, cachedAt, refresh } = useProfit(initial.from, initial.to);
  const presets = buildPresets();
  const activeKey = presets.find((p) => p.from === from && p.to === to)?.key;
  const label = periodLabel(from, to);
  const monthValue = from.slice(0, 7); // YYYY-MM for the month input

  if (loading && !data) {
    return (
      <div className="bg-surface-0 rounded-[var(--radius-card)] shadow-[var(--shadow-card)] p-12 text-center">
        <RefreshCw size={24} className="mx-auto text-brand-500 animate-spin mb-3" />
        <p className="text-sm text-slate-400">Calculating profit from Amazon settlement data…</p>
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

  const rows = data?.rows ?? [];
  const t = data?.totals;

  return (
    <div className="space-y-6">
      {/* Range controls */}
      <div className="bg-surface-0 rounded-[var(--radius-card)] shadow-[var(--shadow-card)] p-4 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          {/* Presets */}
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

          {/* Actions */}
          <div className="flex items-center gap-3">
            {cachedAt && <span className="text-xs text-slate-400">Updated {new Date(cachedAt).toLocaleTimeString()}</span>}
            <button onClick={refresh} className="p-1.5 rounded-lg hover:bg-surface-100 cursor-pointer" disabled={loading} title="Refresh">
              <RefreshCw size={14} className={`text-slate-400 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => data && openProfitReport(data, label)}
              disabled={!data || loading}
              className="flex items-center gap-1.5 bg-brand-500 text-white px-3.5 py-1.5 rounded-lg font-medium text-sm hover:bg-brand-600 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <Download size={14} /> Download PDF
            </button>
          </div>
        </div>

        {/* Month picker + custom range */}
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
              type="date"
              value={from}
              max={to}
              onChange={(e) => e.target.value && setRange(e.target.value, to)}
              className="text-xs text-brand-900 border border-surface-200 rounded-lg px-2 py-1.5 bg-surface-0 cursor-pointer hover:border-brand-300 transition-colors"
            />
            <span className="text-slate-400">to</span>
            <input
              type="date"
              value={to}
              min={from}
              onChange={(e) => e.target.value && setRange(from, e.target.value)}
              className="text-xs text-brand-900 border border-surface-200 rounded-lg px-2 py-1.5 bg-surface-0 cursor-pointer hover:border-brand-300 transition-colors"
            />
          </div>
          <span className="text-xs font-semibold text-brand-700 ml-auto">{label}</span>
        </div>
      </div>

      {/* Surface a refresh error but keep the last-loaded data visible */}
      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          <AlertCircle size={16} className="text-status-red shrink-0" />
          <p className="text-sm text-status-red">Couldn't load this range: {error}. Showing the last data — tap the refresh icon to retry.</p>
        </div>
      )}

      {/* Data area — dims while a new timeframe is loading */}
      <div className={`space-y-6 transition-opacity ${loading ? 'opacity-40 pointer-events-none' : ''}`}>

      {/* Summary cards */}
      {t && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-surface-0 rounded-[var(--radius-card)] shadow-[var(--shadow-card)] p-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Revenue</p>
            <p className="text-3xl font-bold text-status-green mt-2">{money(t.revenue)}</p>
            <p className="text-xs text-slate-400 mt-1">{t.unitsSold.toLocaleString()} units · {t.skuCount} SKUs</p>
          </div>
          <div className="bg-surface-0 rounded-[var(--radius-card)] shadow-[var(--shadow-card)] p-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Amazon Fees</p>
            <p className="text-3xl font-bold text-status-red mt-2">{money(t.fees)}</p>
            <p className="text-xs text-slate-400 mt-1">referral + FBA</p>
          </div>
          <div className="bg-surface-0 rounded-[var(--radius-card)] shadow-[var(--shadow-card)] p-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Cost of Goods</p>
            <p className="text-3xl font-bold text-status-yellow mt-2">{money(-t.cost)}</p>
            <p className="text-xs text-slate-400 mt-1">your unit costs</p>
          </div>
          <div className="bg-surface-0 rounded-[var(--radius-card)] shadow-[var(--shadow-card)] p-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Net Profit</p>
            <p className={`text-3xl font-bold mt-2 ${t.profit >= 0 ? 'text-brand-900' : 'text-status-red'}`}>{money(t.profit)}</p>
            <p className="text-xs text-slate-400 mt-1">{t.margin != null ? `${t.margin.toFixed(1)}% margin` : '—'}</p>
          </div>
        </div>
      )}

      {/* Missing-cost warning */}
      {t && t.missingCost > 0 && (
        <div className="flex items-start gap-2 bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3">
          <Info size={16} className="text-status-yellow mt-0.5 shrink-0" />
          <p className="text-sm text-yellow-800">
            <strong>{t.missingCost}</strong> of {t.skuCount} sold SKUs have no cost set — their profit is calculated as if the cost were $0, so it's overstated.
            Set unit costs on the <strong>Inventory</strong> tab for an accurate number.
          </p>
        </div>
      )}

      {/* Table */}
      <div className="bg-surface-0 rounded-[var(--radius-card)] shadow-[var(--shadow-card)] overflow-hidden">
        <div className="px-5 py-4 border-b border-surface-200 flex items-center gap-2">
          <TrendingUp size={16} className="text-brand-500" />
          <h3 className="text-sm font-semibold text-brand-900">Profit by SKU · {label}</h3>
          <span className="text-xs text-slate-400 bg-surface-100 px-2 py-0.5 rounded-full">{rows.length}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-surface-50">
                <th className="text-xs font-semibold uppercase tracking-wider text-slate-500 px-4 py-3">Product</th>
                <th className="text-xs font-semibold uppercase tracking-wider text-slate-500 px-4 py-3">SKU</th>
                <th className="text-xs font-semibold uppercase tracking-wider text-slate-500 px-4 py-3 text-right">Units</th>
                <th className="text-xs font-semibold uppercase tracking-wider text-slate-500 px-4 py-3 text-right">Revenue</th>
                <th className="text-xs font-semibold uppercase tracking-wider text-slate-500 px-4 py-3 text-right">Amazon Fees</th>
                <th className="text-xs font-semibold uppercase tracking-wider text-slate-500 px-4 py-3 text-right">Cost</th>
                <th className="text-xs font-semibold uppercase tracking-wider text-slate-500 px-4 py-3 text-right">Profit</th>
                <th className="text-xs font-semibold uppercase tracking-wider text-slate-500 px-4 py-3 text-right">Margin</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.sku} className="border-b border-surface-200 hover:bg-brand-50/30 transition-colors">
                  <td className="px-4 py-3 text-sm text-brand-900 max-w-[240px] truncate">{r.productName || <span className="text-slate-400 italic" title="Sold-out or merchant-fulfilled — no listing name found">{r.sku}</span>}</td>
                  <td className="px-4 py-3 text-sm font-mono text-slate-500">{r.sku}</td>
                  <td className="px-4 py-3 text-sm text-brand-900 text-right">{r.unitsSold}</td>
                  <td className="px-4 py-3 text-sm text-status-green text-right">{money(r.revenue)}</td>
                  <td className="px-4 py-3 text-sm text-status-red text-right">{money(r.fees)}</td>
                  <td className="px-4 py-3 text-sm text-right">
                    {r.hasCost ? (
                      <span className="text-status-yellow">{money(-r.cost)}</span>
                    ) : (
                      <span className="text-slate-300" title="No cost set for this SKU">—</span>
                    )}
                  </td>
                  <td className={`px-4 py-3 text-sm font-semibold text-right ${r.profit >= 0 ? 'text-brand-900' : 'text-status-red'}`}>{money(r.profit)}</td>
                  <td className="px-4 py-3 text-sm text-slate-500 text-right">{r.margin != null ? `${r.margin.toFixed(1)}%` : '—'}</td>
                </tr>
              ))}
              {rows.length === 0 && !loading && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-sm text-slate-400">
                    No sales with settlement data in this range yet. Amazon's finances data can lag a day or two behind the sale.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      </div>
    </div>
  );
}
