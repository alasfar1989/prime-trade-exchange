import { PackageCheck, PackageOpen, AlertTriangle, TrendingDown } from 'lucide-react';
import { SummaryCard } from './SummaryCard';
import type { DailySummary } from '../../types/shipment';

interface SummaryCardsProps {
  summary: DailySummary;
}

export function SummaryCards({ summary }: SummaryCardsProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <SummaryCard
        title="Shipped"
        value={summary.totalShipmentsShipped}
        subtitle={`${summary.totalExpectedUnits.toLocaleString()} expected units`}
        icon={PackageCheck}
        iconColor="text-brand-500"
        iconBg="bg-brand-50"
      />
      <SummaryCard
        title="Received"
        value={summary.totalShipmentsReceived}
        subtitle={`${summary.totalLocatedUnits.toLocaleString()} located units`}
        icon={PackageOpen}
        iconColor="text-teal-600"
        iconBg="bg-teal-50"
      />
      <SummaryCard
        title="Discrepancies"
        value={summary.totalDiscrepancies}
        subtitle={summary.totalDiscrepancies > 0 ? 'shipments with shortages' : 'all clear'}
        icon={AlertTriangle}
        iconColor={summary.totalDiscrepancies > 0 ? 'text-status-yellow' : 'text-status-green'}
        iconBg={summary.totalDiscrepancies > 0 ? 'bg-yellow-50' : 'bg-green-50'}
      />
      <SummaryCard
        title="Units Short"
        value={summary.totalUnitsShort}
        subtitle={summary.totalUnitsShort > 0 ? 'total units missing' : 'no shortages'}
        icon={TrendingDown}
        iconColor={summary.totalUnitsShort > 0 ? 'text-status-red' : 'text-status-green'}
        iconBg={summary.totalUnitsShort > 0 ? 'bg-red-50' : 'bg-green-50'}
      />
    </div>
  );
}
