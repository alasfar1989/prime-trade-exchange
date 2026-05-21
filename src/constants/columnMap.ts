export const COLUMN_ALIASES: Record<string, string[]> = {
  shipmentName: [
    'shipment name',
    'shipmentname',
    'name',
    'fba shipment name',
  ],
  shipmentId: [
    'shipment id',
    'shipmentid',
    'fba shipment id',
    'amazon shipment id',
  ],
  referenceId: [
    'reference id',
    'referenceid',
    'ref id',
    'reference',
  ],
  createdDate: [
    'created date',
    'created',
    'date created',
    'creation date',
  ],
  lastUpdatedDate: [
    'last updated date',
    'last updated',
    'updated date',
    'last update',
    'updated',
  ],
  shipTo: [
    'ship to',
    'shipto',
    'destination',
    'fulfillment center',
    'fc',
    'ship-to',
  ],
  skus: [
    'skus',
    'sku count',
    'number of skus',
    'total skus',
    'skus in shipment',
  ],
  expectedUnits: [
    'expected units',
    'expectedunits',
    'units expected',
    'shipped',
    'qty shipped',
    'units shipped',
  ],
  locatedUnits: [
    'located units',
    'locatedunits',
    'units located',
    'received',
    'qty received',
    'units received',
  ],
  primeEligibleUnits: [
    'prime eligible units',
    'prime eligible',
    'prime units',
  ],
  status: [
    'status',
    'shipment status',
    'current status',
  ],
};

export const REQUIRED_COLUMNS = ['shipmentId', 'status'];
