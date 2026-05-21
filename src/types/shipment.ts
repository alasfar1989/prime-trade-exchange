export interface Shipment {
  shipmentName: string;
  shipmentId: string;
  referenceId: string;
  createdDate: Date;
  lastUpdatedDate: Date;
  shipTo: string;
  skus: number;
  expectedUnits: number;
  locatedUnits: number;
  primeEligibleUnits: number;
  status: string;
}

export interface Discrepancy {
  shipment: Shipment;
  shortage: number;
  severity: 'none' | 'low' | 'high';
}

export interface DailySummary {
  shippedToday: Shipment[];
  receivedToday: Shipment[];
  discrepancies: Discrepancy[];
  totalShipmentsShipped: number;
  totalExpectedUnits: number;
  totalShipmentsReceived: number;
  totalLocatedUnits: number;
  totalDiscrepancies: number;
  totalUnitsShort: number;
}

export type QuickFilter = 'today' | 'yesterday' | 'last7days';

export interface StoredData {
  version: 1;
  shipments: SerializedShipment[];
  lastUploadedAt: string;
  lastUploadedFilename: string;
}

export type SerializedShipment = Omit<Shipment, 'createdDate' | 'lastUpdatedDate'> & {
  createdDate: string;
  lastUpdatedDate: string;
};

export interface ParseResult {
  shipments: Shipment[];
  warnings: string[];
}
