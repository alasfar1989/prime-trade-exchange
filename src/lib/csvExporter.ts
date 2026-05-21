import { format } from 'date-fns';
import type { DailySummary } from '../types/shipment';

function escapeField(value: string | number): string {
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function row(fields: (string | number)[]): string {
  return fields.map(escapeField).join(',');
}

export function exportDailyReport(summary: DailySummary, date: Date): void {
  const dateStr = format(date, 'yyyy-MM-dd');
  const lines: string[] = [];

  lines.push(`Prime Trade Exchange - FBA Daily Report: ${format(date, 'MMMM d, yyyy')}`);
  lines.push('');

  // Summary
  lines.push('--- SUMMARY ---');
  lines.push(row(['Metric', 'Value']));
  lines.push(row(['Shipments Shipped', summary.totalShipmentsShipped]));
  lines.push(row(['Total Expected Units', summary.totalExpectedUnits]));
  lines.push(row(['Shipments Received', summary.totalShipmentsReceived]));
  lines.push(row(['Total Located Units', summary.totalLocatedUnits]));
  lines.push(row(['Discrepancies', summary.totalDiscrepancies]));
  lines.push(row(['Total Units Short', summary.totalUnitsShort]));
  lines.push('');

  // Shipped
  lines.push('--- SHIPPED ---');
  lines.push(row(['Shipment Name', 'Shipment ID', 'Ship To', 'SKUs', 'Expected Units', 'Status']));
  for (const s of summary.shippedToday) {
    lines.push(row([s.shipmentName, s.shipmentId, s.shipTo, s.skus, s.expectedUnits, s.status]));
  }
  lines.push('');

  // Received
  lines.push('--- RECEIVED ---');
  lines.push(row(['Shipment Name', 'Shipment ID', 'Ship To', 'Expected', 'Located', 'Status']));
  for (const s of summary.receivedToday) {
    lines.push(row([s.shipmentName, s.shipmentId, s.shipTo, s.expectedUnits, s.locatedUnits, s.status]));
  }
  lines.push('');

  // Discrepancies
  lines.push('--- DISCREPANCIES ---');
  lines.push(row(['Shipment Name', 'Shipment ID', 'Ship To', 'Expected', 'Located', 'Shortage', 'Status']));
  for (const d of summary.discrepancies) {
    const s = d.shipment;
    lines.push(row([s.shipmentName, s.shipmentId, s.shipTo, s.expectedUnits, s.locatedUnits, d.shortage, s.status]));
  }

  const csv = lines.join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `fba-report-${dateStr}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
