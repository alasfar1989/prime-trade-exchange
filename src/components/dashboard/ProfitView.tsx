import { useProfit } from '../../hooks/useProfit';
import { RefreshCw, TrendingUp, AlertCircle, Info } from 'lucide-react';
import { Button } from '../shared/Button';

const RANGES = [7, 30, 60, 90];

function money(n: number): string {
  return (n < 0 ? '-' : '') + '$' + Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function ProfitView() {
  const { data, days, setDays, loading, error, cachedAt, refresh } = useProfit(30);

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
        <Button onClick={refresh} variant="secondary" className="mt-4">Retry</Button>
      </div>
    );
  }

  const rows = data?.rows ?? [];
  const t = data?.totals;

  return (
    <div className="space-y-6">
      {/* Range selector */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-1 bg-surface-100 rounded-lg p-1">
          {RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setDays(r)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors cursor-pointer ${
                days === r ? 'bg-surface-0 text-brand-700 shadow-sm' : 'text-slate-500 hover:text-brand-900'
              }`}
            >
              {r}d
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          {cachedAt && <span className="text-xs text-slate-400">Updated {new Date(cachedAt).toLocaleTimeString()}</span>}
          <button onClick={refresh} className="p-1.5 rounded-lg hover:bg-surface-100 cursor-pointer" disabled={loading}>
            <RefreshCw size={14} className={`text-slate-400 ${loading ? 'animate-spin' : ''}`} />
          </button>
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
          <h3 className="text-sm font-semibold text-brand-900">Profit by SKU · last {days} days</h3>
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
