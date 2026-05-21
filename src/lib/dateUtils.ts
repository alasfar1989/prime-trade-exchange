import { isSameDay, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import type { Shipment, Discrepancy, DailySummary } from '../types/shipment';

const SHIPPED_STATUSES = ['SHIPPED', 'IN_TRANSIT'];
const RECEIVED_STATUSES = ['RECEIVING', 'CLOSED', 'DELIVERED', 'CHECKED_IN'];
const DISCREPANCY_STATUSES = ['CLOSED', 'RECEIVING', 'CHECKED_IN'];

function getSeverity(shortage: number): 'none' | 'low' | 'high' {
  if (shortage <= 0) return 'none';
  if (shortage <= 5) return 'low';
  return 'high';
}

export function getShippedOnDate(shipments: Shipment[], date: Date): Shipment[] {
  return shipments.filter(
    (s) => isSameDay(s.createdDate, date) && SHIPPED_STATUSES.includes(s.status)
  );
}

export function getReceivedOnDate(shipments: Shipment[], date: Date): Shipment[] {
  return shipments.filter(
    (s) => isSameDay(s.lastUpdatedDate, date) && RECEIVED_STATUSES.includes(s.status)
  );
}

export function getDiscrepancies(shipments: Shipment[]): Discrepancy[] {
  return shipments
    .filter(
      (s) => DISCREPANCY_STATUSES.includes(s.status) && s.locatedUnits < s.expectedUnits
    )
    .map((s) => {
      const shortage = s.expectedUnits - s.locatedUnits;
      return { shipment: s, shortage, severity: getSeverity(shortage) };
    })
    .sort((a, b) => b.shortage - a.shortage);
}

export function getShippedInRange(shipments: Shipment[], start: Date, end: Date): Shipment[] {
  return shipments.filter(
    (s) =>
      isWithinInterval(s.createdDate, { start: startOfDay(start), end: endOfDay(end) }) &&
      SHIPPED_STATUSES.includes(s.status)
  );
}

export function getReceivedInRange(shipments: Shipment[], start: Date, end: Date): Shipment[] {
  return shipments.filter(
    (s) =>
      isWithinInterval(s.lastUpdatedDate, { start: startOfDay(start), end: endOfDay(end) }) &&
      RECEIVED_STATUSES.includes(s.status)
  );
}

export function getDiscrepanciesForDate(shipments: Shipment[], date: Date): Discrepancy[] {
  const received = getReceivedOnDate(shipments, date);
  return received
    .filter((s) => s.locatedUnits < s.expectedUnits)
    .map((s) => {
      const shortage = s.expectedUnits - s.locatedUnits;
      return { shipment: s, shortage, severity: getSeverity(shortage) };
    })
    .sort((a, b) => b.shortage - a.shortage);
}

export function buildDailySummary(
  shipments: Shipment[],
  date: Date,
  range?: { start: Date; end: Date }
): DailySummary {
  const shipped = range
    ? getShippedInRange(shipments, range.start, range.end)
    : getShippedOnDate(shipments, date);

  const received = range
    ? getReceivedInRange(shipments, range.start, range.end)
    : getReceivedOnDate(shipments, date);

  const discrepancies = range
    ? getDiscrepancies(
        shipments.filter((s) =>
          isWithinInterval(s.lastUpdatedDate, {
            start: startOfDay(range.start),
            end: endOfDay(range.end),
          })
        )
      )
    : getDiscrepanciesForDate(shipments, date);

  return {
    shippedToday: shipped,
    receivedToday: received,
    discrepancies,
    totalShipmentsShipped: shipped.length,
    totalExpectedUnits: shipped.reduce((sum, s) => sum + s.expectedUnits, 0),
    totalShipmentsReceived: received.length,
    totalLocatedUnits: received.reduce((sum, s) => sum + s.locatedUnits, 0),
    totalDiscrepancies: discrepancies.length,
    totalUnitsShort: discrepancies.reduce((sum, d) => sum + d.shortage, 0),
  };
}
