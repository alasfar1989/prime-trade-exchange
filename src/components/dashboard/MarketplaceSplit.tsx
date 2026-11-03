import { Globe, AlertCircle } from 'lucide-react';
import type { CurrencyInfo, MarketplaceTotal } from '../../hooks/useProfit';

function money(n: number): string {
  return (n < 0 ? '-' : '') + '$' + Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const MARKETPLACE_LABELS: Record<string, string> = {
  US: 'United States · Amazon.com',
  MX: 'Mexico · Amazon.com.mx',
  CA: 'Canada · Amazon.ca',
  BR: 'Brazil · Amazon.com.br',
};

// Only rendered when there's something to explain: sales outside the US, or
// foreign money that was converted (or couldn't be).
export function MarketplaceSplit({ byMarketplace, currency }: { byMarketplace: MarketplaceTotal[]; currency: CurrencyInfo }) {
  const foreign = byMarketplace.some((m) => m.marketplace !== 'US') || currency.conversions.length > 0;
  return (
    <>
      {currency.unconverted.length > 0 && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          <AlertCircle size={16} className="text-status-red mt-0.5 shrink-0" />
          <p className="text-sm text-status-red">
            Some amounts are in a currency with no exchange rate available and are <strong>left out of every total</strong>:{' '}
            {currency.unconverted.map((u) => `${u.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${u.currency} (${u.count})`).join(', ')}.
          </p>
        </div>
      )}
      {foreign && (
        <div className="bg-surface-0 rounded-[var(--radius-card)] shadow-[var(--shadow-card)] overflow-hidden">
          <div className="px-5 py-4 border-b border-surface-200 flex items-center gap-2">
            <Globe size={16} className="text-brand-500" />
            <h3 className="text-sm font-semibold text-brand-900">By marketplace</h3>
            <span className="text-xs text-slate-400">— all figures in USD</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-surface-200">
            {byMarketplace.map((m) => (
              <div key={m.marketplace} className="px-5 py-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{MARKETPLACE_LABELS[m.marketplace] ?? m.marketplace}</p>
                <p className={`text-2xl font-bold mt-1 ${m.profit >= 0 ? 'text-brand-900' : 'text-status-red'}`}>{money(m.profit)}</p>
                <p className="text-xs text-slate-400 mt-1">
                  product profit{m.margin != null ? ` · ${m.margin.toFixed(1)}% margin` : ''} ·{' '}
                  {money(m.revenue)} revenue · {m.unitsSold.toLocaleString()} units · {m.skus} SKUs
                </p>
              </div>
            ))}
          </div>
          {currency.conversions.length > 0 && (
            <p className="px-5 py-3 border-t border-surface-200 text-xs text-slate-500 bg-surface-50">
              {currency.conversions
                .map((c) => `${c.local.toLocaleString(undefined, { maximumFractionDigits: 0 })} ${c.currency} converted to ${money(c.usd)} (avg ${c.avgRate.toFixed(2)} ${c.currency}/USD)`)
                .join(' · ')}
              {' '}at each day's ECB reference rate. Amazon's payout rate can differ by a percent or two.
            </p>
          )}
        </div>
      )}
    </>
  );
}
