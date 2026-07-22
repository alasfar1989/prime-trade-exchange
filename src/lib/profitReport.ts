import type { ProfitData } from '../hooks/useProfit';

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

export function buildProfitReportHtml(data: ProfitData, periodLabel: string, generatedAt: Date): string {
  const t = data.totals;
  const rows = data.rows;
  const genStr = generatedAt.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

  const bodyRows = rows.map((r) => `
    <tr>
      <td class="prod">${r.productName ? esc(r.productName) : `<span class="muted">${esc(r.sku)}</span>`}</td>
      <td class="mono">${esc(r.sku)}</td>
      <td class="num">${r.unitsSold.toLocaleString()}</td>
      <td class="num pos">${money(r.revenue)}</td>
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
      ${kpi('Revenue', money(t.revenue), C.green, `${t.unitsSold.toLocaleString()} units · ${t.skuCount} SKUs`)}
      ${kpi('Amazon Fees', money(t.fees), C.red, 'referral + FBA')}
      ${kpi('Cost of Goods', money(-t.cost), C.yellow, 'your unit costs')}
      ${kpi('Net Profit', money(t.profit), t.profit >= 0 ? C.brand900 : C.red, t.margin != null ? `${t.margin.toFixed(1)}% margin` : '')}
    </div>

    ${missingNote}

    <table>
      <thead>
        <tr>
          <th>Product</th><th>SKU</th><th class="num">Units</th><th class="num">Revenue</th>
          <th class="num">Amazon Fees</th><th class="num">Cost</th><th class="num">Profit</th><th class="num">Margin</th>
        </tr>
      </thead>
      <tbody>${bodyRows || `<tr><td colspan="8" style="text-align:center;padding:24px;color:${C.slate400}">No sales with settlement data in this period.</td></tr>`}</tbody>
      <tfoot>
        <tr>
          <td colspan="2">Total · ${t.skuCount} SKUs</td>
          <td class="num">${t.unitsSold.toLocaleString()}</td>
          <td class="num pos">${money(t.revenue)}</td>
          <td class="num neg">${money(t.fees)}</td>
          <td class="num" style="color:${C.yellow}">${money(-t.cost)}</td>
          <td class="num" style="color:${t.profit >= 0 ? C.brand900 : C.red}">${money(t.profit)}</td>
          <td class="num">${t.margin != null ? t.margin.toFixed(1) + '%' : '—'}</td>
        </tr>
      </tfoot>
    </table>

    <div class="foot">
      Figures from Amazon SP-API settlement (Finances) data for shipped orders in the selected period. Refunds are not deducted.
      Cost of Goods uses your saved per-SKU unit costs. Amazon's finances data can lag a day or two behind the sale.
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
