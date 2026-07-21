import { useState } from 'react';
import { useInventory } from '../../hooks/useInventory';
import { useCosts } from '../../hooks/useCosts';
import { RefreshCw, Package, AlertCircle, Check } from 'lucide-react';
import { Button } from '../shared/Button';

// Editable per-SKU cost cell. Saves on blur / Enter when the value changes.
function CostCell({ sku, value, onSave }: { sku: string; value?: number; onSave: (sku: string, cost: number) => Promise<void> }) {
  const [text, setText] = useState(value != null ? String(value) : '');
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  async function commit() {
    const trimmed = text.trim();
    const num = parseFloat(trimmed);
    if (trimmed === '' || Number.isNaN(num) || num < 0) return;
    if (value != null && num === value) return;
    setBusy(true);
    try {
      await onSave(sku, num);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center justify-end gap-1.5">
      <span className="text-slate-400 text-sm">$</span>
      <input
        type="number"
        min="0"
        step="0.01"
        inputMode="decimal"
        value={text}
        placeholder="—"
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
        disabled={busy}
        className="w-20 text-right text-sm rounded-md border border-surface-200 bg-surface-0 px-2 py-1 text-brand-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-50"
      />
      {saved && <Check size={14} className="text-status-green" />}
    </div>
  );
}

export function InventoryView() {
  const { inventory, loading, error, cachedAt, refresh } = useInventory();
  const { costs, saveCost } = useCosts();

  if (loading && inventory.length === 0) {
    return (
      <div className="bg-surface-0 rounded-[var(--radius-card)] shadow-[var(--shadow-card)] p-12 text-center">
        <RefreshCw size={24} className="mx-auto text-brand-500 animate-spin mb-3" />
        <p className="text-sm text-slate-400">Loading inventory from Amazon...</p>
      </div>
    );
  }

  if (error && inventory.length === 0) {
    return (
      <div className="bg-surface-0 rounded-[var(--radius-card)] shadow-[var(--shadow-card)] p-12 text-center">
        <AlertCircle size={24} className="mx-auto text-status-red mb-3" />
        <p className="text-sm text-status-red">{error}</p>
        <Button onClick={refresh} variant="secondary" className="mt-4">Retry</Button>
      </div>
    );
  }

  const sorted = [...inventory].sort((a, b) => b.totalQuantity - a.totalQuantity);

  const totalFulfillable = inventory.reduce((sum, i) => sum + i.fulfillable, 0);
  const totalInbound = inventory.reduce((sum, i) => sum + i.inboundShipped + i.inboundReceiving + i.inboundWorking, 0);
  const totalReserved = inventory.reduce((sum, i) => sum + i.reserved, 0);

  // Value of inventory on hand + inbound + reserved, at your unit cost.
  // Only SKUs that have a cost set are counted.
  const ownedUnits = (i: typeof inventory[number]) =>
    i.fulfillable + i.inboundWorking + i.inboundShipped + i.inboundReceiving + i.reserved;
  const inventoryValue = inventory.reduce((sum, i) => {
    const c = costs[i.sku];
    return c != null ? sum + ownedUnits(i) * c : sum;
  }, 0);
  const pricedCount = inventory.filter((i) => costs[i.sku] != null).length;

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-surface-0 rounded-[var(--radius-card)] shadow-[var(--shadow-card)] p-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Inventory Value</p>
          <p className="text-3xl font-bold text-brand-700 mt-2">${Math.round(inventoryValue).toLocaleString()}</p>
          <p className="text-xs text-slate-400 mt-1">{pricedCount} of {inventory.length} SKUs priced</p>
        </div>
        <div className="bg-surface-0 rounded-[var(--radius-card)] shadow-[var(--shadow-card)] p-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total SKUs</p>
          <p className="text-4xl font-bold text-brand-900 mt-2">{inventory.length.toLocaleString()}</p>
        </div>
        <div className="bg-surface-0 rounded-[var(--radius-card)] shadow-[var(--shadow-card)] p-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Fulfillable</p>
          <p className="text-4xl font-bold text-status-green mt-2">{totalFulfillable.toLocaleString()}</p>
        </div>
        <div className="bg-surface-0 rounded-[var(--radius-card)] shadow-[var(--shadow-card)] p-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Inbound</p>
          <p className="text-4xl font-bold text-brand-500 mt-2">{totalInbound.toLocaleString()}</p>
        </div>
        <div className="bg-surface-0 rounded-[var(--radius-card)] shadow-[var(--shadow-card)] p-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Reserved</p>
          <p className="text-4xl font-bold text-status-yellow mt-2">{totalReserved.toLocaleString()}</p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-surface-0 rounded-[var(--radius-card)] shadow-[var(--shadow-card)] overflow-hidden">
        <div className="px-5 py-4 border-b border-surface-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package size={16} className="text-brand-500" />
            <h3 className="text-sm font-semibold text-brand-900">FBA Inventory</h3>
            <span className="text-xs text-slate-400 bg-surface-100 px-2 py-0.5 rounded-full">{inventory.length}</span>
          </div>
          <div className="flex items-center gap-3">
            {cachedAt && <span className="text-xs text-slate-400">Updated {new Date(cachedAt).toLocaleTimeString()}</span>}
            <button onClick={refresh} className="p-1.5 rounded-lg hover:bg-surface-100 cursor-pointer" disabled={loading}>
              <RefreshCw size={14} className={`text-slate-400 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-surface-50">
                <th className="text-xs font-semibold uppercase tracking-wider text-slate-500 px-4 py-3">Product</th>
                <th className="text-xs font-semibold uppercase tracking-wider text-slate-500 px-4 py-3">ASIN</th>
                <th className="text-xs font-semibold uppercase tracking-wider text-slate-500 px-4 py-3">SKU</th>
                <th className="text-xs font-semibold uppercase tracking-wider text-slate-500 px-4 py-3 text-right">Fulfillable</th>
                <th className="text-xs font-semibold uppercase tracking-wider text-slate-500 px-4 py-3 text-right">Inbound</th>
                <th className="text-xs font-semibold uppercase tracking-wider text-slate-500 px-4 py-3 text-right">Reserved</th>
                <th className="text-xs font-semibold uppercase tracking-wider text-slate-500 px-4 py-3 text-right">Total</th>
                <th className="text-xs font-semibold uppercase tracking-wider text-slate-500 px-4 py-3 text-right">Unit Cost</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((item) => (
                <tr key={item.fnSku} className="border-b border-surface-200 hover:bg-brand-50/30 transition-colors">
                  <td className="px-4 py-3 text-sm text-brand-900 max-w-[250px] truncate">{item.productName}</td>
                  <td className="px-4 py-3 text-sm font-mono text-slate-500">{item.asin}</td>
                  <td className="px-4 py-3 text-sm font-mono text-slate-500">{item.sku}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-status-green text-right">{item.fulfillable}</td>
                  <td className="px-4 py-3 text-sm text-brand-500 text-right">{item.inboundShipped + item.inboundReceiving + item.inboundWorking}</td>
                  <td className="px-4 py-3 text-sm text-status-yellow text-right">{item.reserved}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-brand-900 text-right">{item.totalQuantity}</td>
                  <td className="px-4 py-3 text-right">
                    <CostCell sku={item.sku} value={costs[item.sku]} onSave={saveCost} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
