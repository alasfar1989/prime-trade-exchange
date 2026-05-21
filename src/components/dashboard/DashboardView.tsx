import type { DailySummary } from '../../types/shipment';
import { SummaryCards } from './SummaryCards';
import { ShippedTable } from './ShippedTable';
import { ReceivedTable } from './ReceivedTable';
import { DiscrepancyTable } from './DiscrepancyTable';

interface DashboardViewProps {
  summary: DailySummary;
}

export function DashboardView({ summary }: DashboardViewProps) {
  return (
    <div className="space-y-6">
      <SummaryCards summary={summary} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ShippedTable shipments={summary.shippedToday} />
        <ReceivedTable shipments={summary.receivedToday} />
      </div>

      <DiscrepancyTable discrepancies={summary.discrepancies} />
    </div>
  );
}
