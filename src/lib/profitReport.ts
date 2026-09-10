import type { ProfitData } from '../hooks/useProfit';
import { buildRankings, formatMetric, type Ranking } from './profitRankings';
import { accountTypeLabel } from './accountLabels';

// Brand palette (from brand.md) — inlined so the report window is self-contained.
const C = {
  brand900: '#0a2540',
  brand700: '#004fa6',
  brand500: '#0a7aef',
  slate500: '#64748b',
  slate400: '#94a3b8',
  green: '#16a34a',
  yellow: '#ca8a04',
  red: '#dc2626',
  surface50: '#f8fafc',
  surface100: '#f1f5f9',
  surface200: '#e2e8f0',
};

function money(n: number): string {
  return (n < 0 ? '-' : '') + '$' + Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}

function kpi(label: string, value: string, color: string, sub?: string): string {
  return `
    <div class="kpi">
      <div class="kpi-label">${esc(label)}</div>
      <div class="kpi-value" style="color:${color}">${esc(value)}</div>
      ${sub ? `<div class="kpi-sub">${esc(sub)}</div>` : ''}
    </div>`;
}

function rankCard(r: Ranking): string {
  const accent = r.tone === 'good' ? C.green : C.red;
  const body = r.entries.length
    ? `<table class="rank-t">${r.entries.map((e, i) => `
        <tr>
          <td class="rank-n">${i + 1}</td>
          <td class="rank-p" title="${esc(e.row.sku)}">${esc(e.row.productName || e.row.sku)}</td>
          <td class="rank-v" style="color:${r.kind === 'money' && e.value < 0 ? C.red : C.brand900}">${esc(formatMetric(e.value, r.kind))}</td>
          <td class="rank-s">${e.share != null ? esc(e.share.toFixed(1)) + '%' : ''}</td>
        </tr>`).join('')}</table>`
    : `<div class="rank-empty">${esc(r.emptyNote)}</div>`;
  return `
    <div class="rank-card" style="border-top-color:${accent}">
      <div class="rank-title">${esc(r.title)}</div>
      <div class="rank-note">${esc(r.note)}</div>
      ${body}
    </div>`;
}

function acctTable(title: string, items: Array<{ type: string; amount: number; count: number }>, total: number, note: string): string {
  if (!items.length) return '';
  return `
    <div class="acct-col">
      <div class="acct-h"><span>${esc(title)}</span><span style="color:${total >= 0 ? C.green : C.red}">${esc(money(total))}</span></div>
      <div class="acct-note">${esc(note)}</div>
      <table class="acct-t">${items.map((i) => `
        <tr>
          <td>${esc(accountTypeLabel(i.type))}</td>
          <td class="acct-n">&times;${i.count}</td>
          <td class="acct-v" style="color:${i.amount >= 0 ? C.green : C.red}">${esc(money(i.amount))}</td>
        </tr>`).join('')}</table>
    </div>`;
}

function step(label: string, value: string, color: string, op?: string): string {
  return `${op ? `<div class="op">${op}</div>` : ''}<div class="step"><div class="step-l">${esc(label)}</div><div class="step-v" style="color:${color}">${esc(value)}</div></div>`;
}

export function buildProfitReportHtml(data: ProfitData, periodLabel: string, generatedAt: Date): string {
  const t = data.totals;
  const rows = data.rows;
  const genStr = generatedAt.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  const { rankings, concentration, returns } = buildRankings(rows, t);
  const acct = data.account;

  const bodyRows = rows.map((r) => `
    <tr>
      <td class="prod">${r.productName ? esc(r.productName) : `<span class="muted">${esc(r.sku)}</span>`}</td>
      <td class="mono">${esc(r.sku)}</td>
      <td class="num">${r.unitsSold.toLocaleString()}${r.unitsRefunded > 0 ? `<span class="muted"> (&minus;${r.unitsRefunded})</span>` : ''}</td>
      <td class="num pos">${money(r.revenue)}</td>
      <td class="num neg">${r.refunds !== 0 ? money(r.refunds) : '<span class="muted">—</span>'}</td>
      <td class="num neg">${money(r.fees)}</td>
      <td class="num">${r.hasCost ? money(-r.cost) : '<span class="muted">—</span>'}</td>
      <td class="num strong" style="color:${r.profit >= 0 ? C.brand900 : C.red}">${money(r.profit)}</td>
      <td class="num">${r.margin != null ? r.margin.toFixed(1) + '%' : '—'}</td>
    </tr>`).join('');

  const missingNote = t.missingCost > 0
    ? `<div class="note"><strong>${t.missingCost}</strong> of ${t.skuCount} SKUs have no unit cost set — their profit is calculated as if cost were $0, so the total is overstated.</div>`
    : '';

  return `<!doctype html><html><head><meta charset="utf-8"><title>Profit Report — ${esc(periodLabel)}</title>
<style>
  @page { size: letter; margin: 14mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Inter', system-ui, -apple-system, sans-serif; color: ${C.brand900}; margin: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid ${C.brand700}; padding-bottom: 14px; margin-bottom: 20px; }
  .brand { font-size: 20px; font-weight: 700; color: ${C.brand700}; letter-spacing: -0.02em; }
  .subtitle { font-size: 13px; color: ${C.slate500}; margin-top: 2px; }
  .period { text-align: right; }
  .period .label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: ${C.slate400}; }
  .period .val { font-size: 16px; font-weight: 700; color: ${C.brand900}; }
  .period .gen { font-size: 10px; color: ${C.slate400}; margin-top: 4px; }
  .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 16px; }
  .kpi { border: 1px solid ${C.surface200}; border-radius: 8px; padding: 12px 14px; }
  .kpi-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: ${C.slate500}; font-weight: 600; }
  .kpi-value { font-size: 22px; font-weight: 700; margin-top: 4px; }
  .kpi-sub { font-size: 10px; color: ${C.slate400}; margin-top: 2px; }
  .note { background: #fefce8; border: 1px solid #fde68a; color: #854d0e; font-size: 11px; border-radius: 6px; padding: 8px 12px; margin-bottom: 14px; }
  .section-h { font-size: 13px; font-weight: 700; color: ${C.brand900}; margin: 4px 0 10px; }
  .conc { font-size: 10px; color: ${C.slate500}; background: ${C.surface50}; border: 1px solid ${C.surface200}; border-radius: 6px; padding: 7px 10px; margin-bottom: 12px; }
  .conc strong { color: ${C.brand900}; }
  .conc-bad { background: #fef2f2; border-color: #fecaca; color: #991b1b; }
  .conc-bad strong { color: ${C.red}; }
  .acct { border: 1px solid ${C.surface200}; border-radius: 8px; margin-bottom: 18px; break-inside: avoid; }
  .acct-flow { display: flex; align-items: center; gap: 14px; padding: 11px 14px; border-bottom: 1px solid ${C.surface200}; flex-wrap: wrap; }
  .op { font-size: 16px; color: ${C.slate400}; }
  .step-l { font-size: 9px; text-transform: uppercase; letter-spacing: 0.07em; color: ${C.slate500}; font-weight: 600; }
  .step-v { font-size: 15px; font-weight: 700; margin-top: 2px; }
  .acct-total { margin-left: auto; background: ${C.surface50}; border-radius: 6px; padding: 6px 12px; }
  .acct-total .step-l { color: ${C.brand700}; }
  .acct-total .step-v { font-size: 19px; }
  .acct-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; padding: 11px 14px; }
  .acct-h { display: flex; justify-content: space-between; font-size: 11px; font-weight: 700; color: ${C.brand900}; }
  .acct-note { font-size: 9px; color: ${C.slate400}; margin: 2px 0 5px; }
  .acct-t { width: 100%; border-collapse: collapse; font-size: 10px; }
  .acct-t td { padding: 2.5px 0; border-bottom: 1px solid ${C.surface100}; }
  .acct-t tr:last-child td { border-bottom: none; }
  .acct-n { text-align: right; color: ${C.slate400}; font-size: 9px; width: 26px; }
  .acct-v { text-align: right; font-weight: 700; white-space: nowrap; width: 78px; }
  .ranks { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 20px; }
  .rank-card { border: 1px solid ${C.surface200}; border-top-width: 3px; border-radius: 8px; padding: 9px 11px 10px; break-inside: avoid; }
  .rank-title { font-size: 11px; font-weight: 700; color: ${C.brand900}; }
  .rank-note { font-size: 9px; color: ${C.slate400}; margin-bottom: 6px; }
  .rank-t { width: 100%; border-collapse: collapse; font-size: 10px; }
  .rank-t td { padding: 3px 0; border-bottom: 1px solid ${C.surface100}; vertical-align: top; }
  .rank-t tr:last-child td { border-bottom: none; }
  .rank-n { width: 12px; color: ${C.slate400}; font-size: 9px; }
  .rank-p { max-width: 105px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .rank-v { text-align: right; font-weight: 700; white-space: nowrap; padding-left: 6px !important; }
  .rank-s { text-align: right; width: 30px; color: ${C.slate400}; font-size: 9px; white-space: nowrap; }
  .rank-empty { font-size: 9px; color: ${C.slate400}; font-style: italic; padding: 6px 0; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  thead th { text-align: left; text-transform: uppercase; letter-spacing: 0.05em; font-size: 9px; color: ${C.slate500}; background: ${C.surface50}; padding: 7px 8px; border-bottom: 1px solid ${C.surface200}; }
  th.num, td.num { text-align: right; }
  tbody td { padding: 6px 8px; border-bottom: 1px solid ${C.surface100}; }
  tbody tr:nth-child(even) td { background: #fcfdfe; }
  td.prod { max-width: 230px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  td.mono { font-family: 'JetBrains Mono', monospace; color: ${C.slate500}; font-size: 10px; }
  td.pos { color: ${C.green}; }
  td.neg { color: ${C.red}; }
  td.strong { font-weight: 700; }
  .muted { color: ${C.slate400}; }
  tfoot td { padding: 9px 8px; border-top: 2px solid ${C.surface200}; font-weight: 700; font-size: 11px; }
  tfoot td.pos { color: ${C.green}; }
  tfoot td.neg { color: ${C.red}; }
  .foot { margin-top: 18px; font-size: 9px; color: ${C.slate400}; border-top: 1px solid ${C.surface200}; padding-top: 8px; }
  .toolbar { position: fixed; top: 0; left: 0; right: 0; background: ${C.brand700}; color: #fff; padding: 10px 16px; font-size: 13px; display: flex; justify-content: space-between; align-items: center; }
  .toolbar button { background: #fff; color: ${C.brand700}; border: none; border-radius: 6px; padding: 6px 14px; font-weight: 600; font-size: 13px; cursor: pointer; }
  .content { padding: 0; }
  @media print { .toolbar { display: none; } .content { padding: 0; } body { padding: 0; } }
  @media screen { .content { max-width: 1000px; margin: 60px auto 40px; padding: 0 24px; } }
</style></head>
<body>
  <div class="toolbar">
    <span>Profit report ready — use your browser's <strong>Save as PDF</strong> to download &amp; share.</span>
    <button onclick="window.print()">Print / Save as PDF</button>
  </div>
  <div class="content">
    <div class="head">
      <div>
        <div class="brand">Prime Trade Exchange</div>
        <div class="subtitle">Amazon FBA — Net Profit Report</div>
      </div>
      <div class="period">
        <div class="label">Period</div>
        <div class="val">${esc(periodLabel)}</div>
        <div class="gen">Generated ${esc(genStr)}</div>
      </div>
    </div>

    <div class="kpis">
      ${kpi('Net Revenue', money(t.revenue), C.green, `${t.unitsSold.toLocaleString()} units · ${t.skuCount} SKUs${t.refunds !== 0 ? ` · after ${money(t.refunds)} refunds` : ''}`)}
      ${kpi('Amazon Fees', money(t.fees), C.red, 'referral + FBA')}
      ${kpi('Cost of Goods', money(-t.cost), C.yellow, 'your unit costs')}
      ${kpi('Product Profit', money(t.profit), t.profit >= 0 ? C.brand900 : C.red, t.margin != null ? `${t.margin.toFixed(1)}% margin` : '')}
    </div>

    ${missingNote}

    ${acct.reimbursementsByType.length || acct.serviceFeesByType.length ? `
    <div class="section-h">Account-level income &amp; costs <span style="font-weight:400;color:${C.slate400};font-size:11px">— not tied to any single sale</span></div>
    <div class="acct">
      <div class="acct-flow">
        ${step('Product profit', money(t.profit), t.profit >= 0 ? C.brand900 : C.red)}
        ${step('Reimbursements', money(t.reimbursements), C.green, '+')}
        ${step('Account fees', money(t.serviceFees), C.red, '&minus;')}
        <div class="acct-total">${step('Operating profit', money(t.operatingProfit), t.operatingProfit >= 0 ? C.brand900 : C.red)}</div>
      </div>
      <div class="acct-cols">
        ${acctTable('Reimbursements', acct.reimbursementsByType, acct.reimbursements, 'Amazon paying you back for lost or damaged stock. Net of clawbacks, which reverse an earlier payout.')}
        ${acctTable('Account fees', acct.serviceFeesByType, acct.serviceFees, 'Storage, inbound transport, removals and the monthly subscription.')}
      </div>
    </div>` : ''}

    ${rows.length ? `
    <div class="section-h">Top &amp; bottom performers</div>
    ${concentration.share != null ? `<div class="conc">Top ${concentration.skus} SKUs drive <strong>${concentration.share.toFixed(1)}%</strong> of revenue${concentration.label ? ` — ${esc(concentration.label)}` : ''}.</div>` : ''}
    ${returns.rate != null && returns.units > 0 ? `<div class="conc conc-bad">Returns took <strong>${returns.rate.toFixed(1)}%</strong> of gross revenue (${esc(money(returns.amount))} over ${returns.units.toLocaleString()} units).${returns.worst.length ? ` Worst rates: ${esc(returns.worst.map((w) => `${w.row.productName || w.row.sku} (${w.rate.toFixed(0)}%)`).join(', '))}.` : ''}</div>` : ''}
    <div class="ranks">${rankings.map(rankCard).join('')}</div>
    <div class="section-h">Full breakdown by SKU</div>` : ''}

    <table>
      <thead>
        <tr>
          <th>Product</th><th>SKU</th><th class="num">Units</th><th class="num">Revenue</th>
          <th class="num">Refunds</th><th class="num">Amazon Fees</th><th class="num">Cost</th><th class="num">Profit</th><th class="num">Margin</th>
        </tr>
      </thead>
      <tbody>${bodyRows || `<tr><td colspan="9" style="text-align:center;padding:24px;color:${C.slate400}">No sales with settlement data in this period.</td></tr>`}</tbody>
      <tfoot>
        <tr>
          <td colspan="2">Total · ${t.skuCount} SKUs</td>
          <td class="num">${t.unitsSold.toLocaleString()}</td>
          <td class="num pos">${money(t.revenue)}</td>
          <td class="num neg">${money(t.refunds)}</td>
          <td class="num neg">${money(t.fees)}</td>
          <td class="num" style="color:${C.yellow}">${money(-t.cost)}</td>
          <td class="num" style="color:${t.profit >= 0 ? C.brand900 : C.red}">${money(t.profit)}</td>
          <td class="num">${t.margin != null ? t.margin.toFixed(1) + '%' : '—'}</td>
        </tr>
      </tfoot>
    </table>

    <div class="foot">
      Figures from Amazon SP-API settlement (Finances) data for the selected period. Revenue and units are net of refunds settled in the
      window, and Cost of Goods is charged only on units the buyer kept. Because Amazon posts a refund when it settles, a SKU refunded from an
      earlier period can show negative units. Sales tax Amazon collects and remits is excluded as a pass-through. Cost of Goods uses your saved
      per-SKU unit costs. Reimbursements and account-level fees are reported separately from product profit because neither belongs to a
      particular sale; operating profit combines them. Amazon's finances data can lag a day or two behind the sale.
    </div>
  </div>
  <script>window.addEventListener('load', function () { setTimeout(function () { try { window.print(); } catch (e) {} }, 250); });</script>
</body></html>`;
}

export function openProfitReport(data: ProfitData, periodLabel: string): void {
  const html = buildProfitReportHtml(data, periodLabel, new Date());
  const win = window.open('', '_blank');
  if (!win) {
    alert('Please allow pop-ups for this site to download the PDF report.');
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
}
