import { useOrders } from '../../hooks/useOrders';
import { RefreshCw, ShoppingCart, AlertCircle } from 'lucide-react';
import { Button } from '../shared/Button';
import { format } from 'date-fns';

export function OrdersView() {
  const { orders, loading, error, cachedAt, refresh } = useOrders(30);

  if (loading && orders.length === 0) {
    return (
      <div className="bg-surface-0 rounded-[var(--radius-card)] shadow-[var(--shadow-card)] p-12 text-center">
        <RefreshCw size={24} className="mx-auto text-brand-500 animate-spin mb-3" />
        <p className="text-sm text-slate-400">Loading orders from Amazon...</p>
      </div>
    );
  }

  if (error && orders.length === 0) {
    return (
      <div className="bg-surface-0 rounded-[var(--radius-card)] shadow-[var(--shadow-card)] p-12 text-center">
        <AlertCircle size={24} className="mx-auto text-status-red mb-3" />
        <p className="text-sm text-status-red">{error}</p>
        <Button onClick={refresh} variant="secondary" className="mt-4">Retry</Button>
      </div>
    );
  }

  const totalRevenue = orders.reduce((sum, o) => sum + o.totalAmount, 0);
  const totalItems = orders.reduce((sum, o) => sum + o.itemsShipped + o.itemsUnshipped, 0);
  const fbaOrders = orders.filter((o) => o.fulfillmentChannel === 'AFN').length;

  const statusColors: Record<string, string> = {
    Shipped: 'bg-green-50 text-status-green',
    Pending: 'bg-yellow-50 text-status-yellow',
    Canceled: 'bg-red-50 text-status-red',
    Unshipped: 'bg-brand-50 text-brand-600',
  };

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-surface-0 rounded-[var(--radius-card)] shadow-[var(--shadow-card)] p-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Orders (30d)</p>
          <p className="text-4xl font-bold text-brand-900 mt-2">{orders.length.toLocaleString()}</p>
        </div>
        <div className="bg-surface-0 rounded-[var(--radius-card)] shadow-[var(--shadow-card)] p-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Revenue</p>
          <p className="text-4xl font-bold text-status-green mt-2">${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
        </div>
        <div className="bg-surface-0 rounded-[var(--radius-card)] shadow-[var(--shadow-card)] p-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Items</p>
          <p className="text-4xl font-bold text-brand-500 mt-2">{totalItems.toLocaleString()}</p>
        </div>
        <div className="bg-surface-0 rounded-[var(--radius-card)] shadow-[var(--shadow-card)] p-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">FBA Orders</p>
          <p className="text-4xl font-bold text-teal-600 mt-2">{fbaOrders.toLocaleString()}</p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-surface-0 rounded-[var(--radius-card)] shadow-[var(--shadow-card)] overflow-hidden">
        <div className="px-5 py-4 border-b border-surface-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingCart size={16} className="text-brand-500" />
            <h3 className="text-sm font-semibold text-brand-900">Recent Orders</h3>
            <span className="text-xs text-slate-400 bg-surface-100 px-2 py-0.5 rounded-full">{orders.length}</span>
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
                <th className="text-xs font-semibold uppercase tracking-wider text-slate-500 px-4 py-3">Order ID</th>
                <th className="text-xs font-semibold uppercase tracking-wider text-slate-500 px-4 py-3">Date</th>
                <th className="text-xs font-semibold uppercase tracking-wider text-slate-500 px-4 py-3">Status</th>
                <th className="text-xs font-semibold uppercase tracking-wider text-slate-500 px-4 py-3 text-right">Amount</th>
                <th className="text-xs font-semibold uppercase tracking-wider text-slate-500 px-4 py-3 text-right">Items</th>
                <th className="text-xs font-semibold uppercase tracking-wider text-slate-500 px-4 py-3">Channel</th>
                <th className="text-xs font-semibold uppercase tracking-wider text-slate-500 px-4 py-3">Ship To</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.orderId} className="border-b border-surface-200 hover:bg-brand-50/30 transition-colors">
                  <td className="px-4 py-3 text-sm font-mono text-brand-500">{o.orderId}</td>
                  <td className="px-4 py-3 text-sm text-slate-500">{format(new Date(o.purchaseDate), 'MM/dd HH:mm')}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[o.status] || 'bg-slate-100 text-slate-600'}`}>
                      {o.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold text-brand-900 text-right">
                    ${o.totalAmount.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-sm text-brand-900 text-right">{o.itemsShipped + o.itemsUnshipped}</td>
                  <td className="px-4 py-3 text-sm text-slate-500">{o.fulfillmentChannel === 'AFN' ? 'FBA' : 'FBM'}</td>
                  <td className="px-4 py-3 text-sm text-slate-500">{o.shipCity}{o.shipState ? `, ${o.shipState}` : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
