import { format } from 'date-fns';
import type { Discrepancy } from '../../types/shipment';
import { Badge } from '../shared/Badge';
import { AlertTriangle } from 'lucide-react';

interface DiscrepancyTableProps {
  discrepancies: Discrepancy[];
}

export function DiscrepancyTable({ discrepancies }: DiscrepancyTableProps) {
  if (discrepancies.length === 0) return null;

  return (
    <div className="bg-surface-0 rounded-[var(--radius-card)] shadow-[var(--shadow-card)] overflow-hidden border-l-4 border-status-red">
      <div className="px-5 py-4 border-b border-surface-200 flex items-center gap-2">
        <AlertTriangle size={16} className="text-status-red" />
        <h3 className="text-sm font-semibold text-brand-900">Discrepancies</h3>
        <span className="text-xs font-medium text-white bg-status-red px-2 py-0.5 rounded-full ml-1">
          {discrepancies.length}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-surface-50">
              <th className="text-xs font-semibold uppercase tracking-wider text-slate-500 px-4 py-3">Shipment</th>
              <th className="text-xs font-semibold uppercase tracking-wider text-slate-500 px-4 py-3">Dest</th>
              <th className="text-xs font-semibold uppercase tracking-wider text-slate-500 px-4 py-3">Created</th>
              <th className="text-xs font-semibold uppercase tracking-wider text-slate-500 px-4 py-3">Last Updated</th>
              <th className="text-xs font-semibold uppercase tracking-wider text-slate-500 px-4 py-3 text-right">Expected</th>
              <th className="text-xs font-semibold uppercase tracking-wider text-slate-500 px-4 py-3 text-right">Located</th>
              <th className="text-xs font-semibold uppercase tracking-wider text-slate-500 px-4 py-3 text-right">Short</th>
              <th className="text-xs font-semibold uppercase tracking-wider text-slate-500 px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {discrepancies.map((d) => {
              const s = d.shipment;
              return (
                <tr key={s.shipmentId} className="border-b border-surface-200 hover:bg-red-50/30 transition-colors">
                  <td className="px-4 py-3">
                    <a
                      href={`https://sellercentral.amazon.com/fba/inbound-queue/summary?shipmentId=${s.shipmentId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-brand-500 hover:text-brand-700 hover:underline"
                    >
                      {s.shipmentName || s.shipmentId}
                    </a>
                    <p className="text-xs text-slate-400 mt-0.5">{s.shipmentId}</p>
                  </td>
                  <td className="px-4 py-3 text-sm font-mono text-brand-900">{s.shipTo}</td>
                  <td className="px-4 py-3 text-sm text-slate-500">{format(s.createdDate, 'MM/dd')}</td>
                  <td className="px-4 py-3 text-sm text-slate-500">{format(s.lastUpdatedDate, 'MM/dd')}</td>
                  <td className="px-4 py-3 text-sm text-brand-900 text-right">{s.expectedUnits.toLocaleString()}</td>
                  <td className="px-4 py-3 text-sm text-brand-900 text-right">{s.locatedUnits.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right">
                    <Badge severity={d.severity}>-{d.shortage}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                      s.status === 'CLOSED' ? 'bg-red-50 text-status-red font-semibold' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {s.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
