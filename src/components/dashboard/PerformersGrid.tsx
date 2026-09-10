import { Trophy, TrendingDown } from 'lucide-react';
import { buildRankings, formatMetric, type Ranking } from '../../lib/profitRankings';
import type { ProfitRow, ProfitTotals } from '../../hooks/useProfit';

function RankCard({ ranking }: { ranking: Ranking }) {
  const good = ranking.tone === 'good';
  return (
    <div className="bg-surface-0 rounded-[var(--radius-card)] shadow-[var(--shadow-card)] overflow-hidden">
      <div className={`px-4 py-3 border-b border-surface-200 border-t-[3px] ${good ? 'border-t-status-green' : 'border-t-status-red'}`}>
        <h4 className="text-sm font-semibold text-brand-900">{ranking.title}</h4>
        <p className="text-xs text-slate-400 mt-0.5">{ranking.note}</p>
      </div>
      {ranking.entries.length === 0 ? (
        <p className="px-4 py-5 text-xs text-slate-400 italic">{ranking.emptyNote}</p>
      ) : (
        <ul className="divide-y divide-surface-100">
          {ranking.entries.map((e, i) => (
            <li key={e.row.sku} className="flex items-center gap-2.5 px-4 py-2.5">
              <span className="text-xs text-slate-400 w-3 shrink-0 tabular-nums">{i + 1}</span>
              <span className="text-sm text-brand-900 truncate flex-1" title={e.row.sku}>
                {e.row.productName || <span className="text-slate-400 italic">{e.row.sku}</span>}
              </span>
              <span
                className={`text-sm font-semibold tabular-nums shrink-0 ${
                  ranking.kind === 'money' && e.value < 0 ? 'text-status-red' : 'text-brand-900'
                }`}
              >
                {formatMetric(e.value, ranking.kind)}
              </span>
              <span className="text-xs text-slate-400 w-10 text-right shrink-0 tabular-nums">
                {e.share != null ? `${e.share.toFixed(1)}%` : ''}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function PerformersGrid({ rows, totals }: { rows: ProfitRow[]; totals: ProfitTotals }) {
  if (rows.length === 0) return null;
  const { rankings, concentration } = buildRankings(rows, totals);
  const winners = rankings.filter((r) => r.tone === 'good');
  const losers = rankings.filter((r) => r.tone === 'bad');

  return (
    <div className="space-y-4">
      {concentration.share != null && (
        <div className="bg-surface-0 rounded-[var(--radius-card)] shadow-[var(--shadow-card)] px-5 py-3.5 text-sm text-slate-600">
          Top <strong className="text-brand-900">{concentration.skus}</strong> SKUs drive{' '}
          <strong className="text-brand-900">{concentration.share.toFixed(1)}%</strong> of revenue
          {concentration.label && <span className="text-slate-400"> — {concentration.label}</span>}
        </div>
      )}

      <div className="flex items-center gap-2">
        <Trophy size={16} className="text-status-green" />
        <h3 className="text-sm font-semibold text-brand-900">Best performers</h3>
      </div>
      <div className="grid md:grid-cols-3 gap-4">
        {winners.map((r) => <RankCard key={r.key} ranking={r} />)}
      </div>

      <div className="flex items-center gap-2 pt-2">
        <TrendingDown size={16} className="text-status-red" />
        <h3 className="text-sm font-semibold text-brand-900">Needs attention</h3>
      </div>
      <div className="grid md:grid-cols-3 gap-4">
        {losers.map((r) => <RankCard key={r.key} ranking={r} />)}
      </div>
    </div>
  );
}
