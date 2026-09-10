import { Landmark } from 'lucide-react';
import type { AccountBreakdown, ProfitTotals, LineItem } from '../../hooks/useProfit';
import { accountTypeLabel } from '../../lib/accountLabels';

function money(n: number): string {
  return (n < 0 ? '-' : '') + '$' + Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function Step({ label: l, value, tone, op }: { label: string; value: string; tone: string; op?: string }) {
  return (
    <div className="flex items-center gap-3">
      {op && <span className="text-xl font-light text-slate-300 select-none">{op}</span>}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{l}</p>
        <p className={`text-2xl font-bold mt-1 ${tone}`}>{value}</p>
      </div>
    </div>
  );
}

function Breakdown({ title, items, total, note }: { title: string; items: LineItem[]; total: number; note: string }) {
  if (items.length === 0) return null;
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <h4 className="text-sm font-semibold text-brand-900">{title}</h4>
        <span className={`text-sm font-semibold ${total >= 0 ? 'text-status-green' : 'text-status-red'}`}>{money(total)}</span>
      </div>
      <p className="text-xs text-slate-400 mb-2">{note}</p>
      <ul className="divide-y divide-surface-100 border-t border-surface-100">
        {items.map((i) => (
          <li key={i.type} className="flex items-center gap-2 py-1.5">
            <span className="text-sm text-brand-900 flex-1 truncate" title={i.type}>{accountTypeLabel(i.type)}</span>
            <span className="text-xs text-slate-400 tabular-nums">×{i.count}</span>
            <span className={`text-sm font-medium tabular-nums w-28 text-right ${i.amount >= 0 ? 'text-status-green' : 'text-status-red'}`}>
              {money(i.amount)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AccountSummary({ totals, account }: { totals: ProfitTotals; account: AccountBreakdown }) {
  const hasAny = account.reimbursementsByType.length > 0 || account.serviceFeesByType.length > 0;
  if (!hasAny) return null;

  return (
    <div className="bg-surface-0 rounded-[var(--radius-card)] shadow-[var(--shadow-card)] overflow-hidden">
      <div className="px-5 py-4 border-b border-surface-200 flex items-center gap-2">
        <Landmark size={16} className="text-brand-500" />
        <h3 className="text-sm font-semibold text-brand-900">Account-level income &amp; costs</h3>
        <span className="text-xs text-slate-400">— not tied to any single sale</span>
      </div>

      <div className="px-5 py-5 flex items-center gap-6 flex-wrap border-b border-surface-200">
        <Step label="Product profit" value={money(totals.profit)} tone={totals.profit >= 0 ? 'text-brand-900' : 'text-status-red'} />
        <Step label="Reimbursements" value={money(totals.reimbursements)} tone="text-status-green" op="+" />
        <Step label="Account fees" value={money(totals.serviceFees)} tone="text-status-red" op="−" />
        <div className="flex items-center gap-3 ml-auto">
          <span className="text-xl font-light text-slate-300 select-none">=</span>
          <div className="bg-brand-50 rounded-lg px-4 py-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-brand-700">Operating profit</p>
            <p className={`text-3xl font-bold mt-1 ${totals.operatingProfit >= 0 ? 'text-brand-900' : 'text-status-red'}`}>
              {money(totals.operatingProfit)}
            </p>
          </div>
        </div>
      </div>

      <div className="px-5 py-5 grid md:grid-cols-2 gap-8">
        <Breakdown
          title="Reimbursements"
          items={account.reimbursementsByType}
          total={account.reimbursements}
          note="Amazon paying you back for lost or damaged stock. Net of clawbacks, which reverse an earlier payout."
        />
        <Breakdown
          title="Account fees"
          items={account.serviceFeesByType}
          total={account.serviceFees}
          note="Storage, inbound transport, removals and the monthly subscription — charged to the account, not to a sale."
        />
      </div>
    </div>
  );
}
