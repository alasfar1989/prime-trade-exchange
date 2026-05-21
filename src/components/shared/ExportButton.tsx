import { Download } from 'lucide-react';
import { Button } from './Button';
import { exportDailyReport } from '../../lib/csvExporter';
import type { DailySummary } from '../../types/shipment';

interface ExportButtonProps {
  summary: DailySummary;
  date: Date;
  disabled?: boolean;
}

export function ExportButton({ summary, date, disabled }: ExportButtonProps) {
  return (
    <Button
      variant="secondary"
      onClick={() => exportDailyReport(summary, date)}
      disabled={disabled}
    >
      <Download size={16} />
      Export Report
    </Button>
  );
}
