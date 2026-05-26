import type { Shipment } from '../../types/shipment';
import { Badge } from '../shared/Badge';
import { EmptyState } from './EmptyState';

interface ReceivedTableProps {
  shipments: Shipment[];
}

function getDiffSeverity(diff: number): 'none' | 'low' | 'high' {
  if (diff <= 0) return 'none';
  if (diff <= 5) return 'low';
  return 'high';
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    RECEIVING: 'bg-teal-50 text-teal-700',
    CLOSED: 'bg-slate-100 text-slate-600',
    DELIVERED: 'bg-green-50 text-status-green',
    CHECKED_IN: 'bg-green-50 text-status-green',
  };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${colors[status] || 'bg-slate-100 text-slate-600'}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

export function ReceivedTable({ shipments }: ReceivedTableProps) {
  return (
    <div className="bg-surface-0 rounded-[var(--radius-card)] shadow-[var(--shadow-card)] overflow-hidden">
      <div className="px-5 py-4 border-b border-surface-200 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-brand-900">Received</h3>
        <span className="text-xs font-medium text-slate-400 bg-surface-100 px-2 py-0.5 rounded-full">
          {shipments.length}
        </span>
      </div>
      {shipments.length === 0 ? (
        <div className="p-4">
          <EmptyState message="No shipments received on this date" />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-surface-50">
                <th className="text-xs font-semibold uppercase tracking-wider text-slate-500 px-4 py-3">Shipment</th>
                <th className="text-xs font-semibold uppercase tracking-wider text-slate-500 px-4 py-3">Dest</th>
                <th className="text-xs font-semibold uppercase tracking-wider text-slate-500 px-4 py-3 text-right">Expected</th>
                <th className="text-xs font-semibold uppercase tracking-wider text-slate-500 px-4 py-3 text-right">Located</th>
                <th className="text-xs font-semibold uppercase tracking-wider text-slate-500 px-4 py-3 text-right">Diff</th>
                <th className="text-xs font-semibold uppercase tracking-wider text-slate-500 px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {shipments.map((s) => {
                const diff = s.expectedUnits - s.locatedUnits;
                const severity = getDiffSeverity(diff);
                return (
                  <tr key={s.shipmentId} className="border-b border-surface-200 hover:bg-brand-50/30 transition-colors">
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
                    <td className="px-4 py-3 text-sm text-brand-900 text-right">{s.expectedUnits.toLocaleString()}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-brand-900 text-right">{s.locatedUnits.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right">
                      <Badge severity={severity}>
                        {diff === 0 ? '0' : `-${diff}`}
                      </Badge>
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={s.status} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
