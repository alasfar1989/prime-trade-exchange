import type { ProfitRow, ProfitTotals } from '../hooks/useProfit';

// "Best seller" is ambiguous on purpose — a SKU can top the units list and still
// lose money. So we rank on every axis that drives a different decision (move
// volume / chase revenue / chase margin) and let the reader compare them.

export type MetricKind = 'money' | 'units' | 'percent';
export type Tone = 'good' | 'bad';

export interface RankedEntry {
  row: ProfitRow;
  value: number;
  /** Share of the period total for this metric, as a percent. Null when it can't be computed. */
  share: number | null;
}

export interface Ranking {
  key: string;
  title: string;
  /** What the list is ranked on, for the card subtitle. */
  note: string;
  kind: MetricKind;
  tone: Tone;
  entries: RankedEntry[];
  /** Shown instead of the table when `entries` is empty. */
  emptyNote: string;
}

export interface ProfitRankings {
  rankings: Ranking[];
  /** Top-3 SKUs' combined share of revenue — concentration risk. */
  concentration: { share: number | null; skus: number; label: string };
  costedCount: number;
  uncostedCount: number;
}

const LIMIT = 5;

const pct = (part: number, whole: number): number | null =>
  whole !== 0 ? (part / whole) * 100 : null;

/**
 * Sort descending/ascending on `pick`, breaking ties on SKU so the order is
 * stable across renders (Array.prototype.sort is stable, but the incoming row
 * order is server-decided and could change between polls).
 */
function ranked(
  rows: ProfitRow[],
  pick: (r: ProfitRow) => number,
  dir: 'desc' | 'asc',
): ProfitRow[] {
  return [...rows].sort((a, b) => {
    const d = dir === 'desc' ? pick(b) - pick(a) : pick(a) - pick(b);
    return d !== 0 ? d : a.sku.localeCompare(b.sku);
  });
}

function entries(
  rows: ProfitRow[],
  pick: (r: ProfitRow) => number,
  total: number,
): RankedEntry[] {
  return rows.slice(0, LIMIT).map((row) => ({
    row,
    value: pick(row),
    share: pct(pick(row), total),
  }));
}

export function buildRankings(rows: ProfitRow[], totals: ProfitTotals): ProfitRankings {
  // Profit and margin are only trustworthy where a unit cost exists — an
  // uncosted SKU books its whole net proceeds as profit, which would otherwise
  // sweep the "most profitable" list and crowd out the real winners.
  const costed = rows.filter((r) => r.hasCost);
  const uncosted = rows.length - costed.length;
  const costedNote = uncosted > 0 ? ` Costed SKUs only (${uncosted} excluded).` : '';

  const units = (r: ProfitRow) => r.unitsSold;
  const revenue = (r: ProfitRow) => r.revenue;
  const profit = (r: ProfitRow) => r.profit;
  const margin = (r: ProfitRow) => r.margin ?? 0;

  const byUnitsDesc = ranked(rows, units, 'desc');
  const byUnitsAsc = ranked(rows, units, 'asc');
  const byRevenueDesc = ranked(rows, revenue, 'desc');
  // Only actual earners belong on a "most profitable" list — without this a
  // period with fewer than five winners pads the list out with loss-makers.
  const winners = ranked(costed.filter((r) => r.profit > 0), profit, 'desc');
  const losers = ranked(costed.filter((r) => r.profit < 0), profit, 'asc');
  // "Thin" means profitable but barely — outright losses get their own card, so
  // excluding them here keeps the two lists from showing the same SKUs.
  const thin = ranked(
    costed.filter((r) => r.profit >= 0 && r.revenue > 0 && r.margin != null),
    margin,
    'asc',
  );

  const rankings: Ranking[] = [
    {
      key: 'best-sellers',
      title: 'Best sellers',
      note: 'Most units sold',
      kind: 'units',
      tone: 'good',
      entries: entries(byUnitsDesc, units, totals.unitsSold),
      emptyNote: 'No units sold in this period.',
    },
    {
      key: 'top-earners',
      title: 'Top earners',
      note: 'Highest revenue',
      kind: 'money',
      tone: 'good',
      entries: entries(byRevenueDesc, revenue, totals.revenue),
      emptyNote: 'No revenue in this period.',
    },
    {
      key: 'most-profitable',
      title: 'Most profitable',
      note: `Highest net profit.${costedNote}`.trim(),
      kind: 'money',
      tone: 'good',
      // No share: profit shares are taken against a net total that losses drag
      // down, so they overshoot 100% and read as nonsense next to a small total.
      entries: entries(winners, profit, 0),
      emptyNote: costed.length
        ? 'No costed SKU turned a profit this period.'
        : 'No SKUs have a unit cost set, so profit can’t be ranked.',
    },
    {
      key: 'slowest-movers',
      title: 'Slowest movers',
      note: 'Fewest units sold',
      kind: 'units',
      tone: 'bad',
      entries: entries(byUnitsAsc, units, totals.unitsSold),
      emptyNote: 'No units sold in this period.',
    },
    {
      key: 'thinnest-margins',
      title: 'Thinnest margins',
      note: `Profitable, but barely.${costedNote}`.trim(),
      kind: 'percent',
      tone: 'bad',
      entries: entries(thin, margin, 0), // share is meaningless for a margin
      emptyNote: 'No costed SKUs finished in the black this period.',
    },
    {
      key: 'losing-money',
      title: 'Losing money',
      note: `Negative net profit.${costedNote}`.trim(),
      kind: 'money',
      tone: 'bad',
      entries: entries(losers, profit, 0),
      emptyNote: 'No costed SKU lost money this period.',
    },
  ];

  const top3 = byRevenueDesc.slice(0, 3);
  const top3Revenue = top3.reduce((s, r) => s + r.revenue, 0);

  return {
    rankings,
    concentration: {
      share: pct(top3Revenue, totals.revenue),
      skus: top3.length,
      label: top3.map((r) => r.productName || r.sku).join(', '),
    },
    costedCount: costed.length,
    uncostedCount: uncosted,
  };
}

/** Format a ranked value for display, per the ranking's metric kind. */
export function formatMetric(value: number, kind: MetricKind): string {
  if (kind === 'units') return value.toLocaleString();
  if (kind === 'percent') return `${value.toFixed(1)}%`;
  return (value < 0 ? '-' : '') + '$' + Math.abs(value).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
