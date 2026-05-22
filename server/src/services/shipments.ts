import { spApiGet } from './spApiClient.js';
import { env } from '../config/env.js';

interface SpShipment {
  ShipmentId: string;
  ShipmentName: string;
  DestinationFulfillmentCenterId: string;
  ShipmentStatus: string;
  LabelPrepType?: string;
  AreCasesRequired?: boolean;
}

interface SpShipmentItem {
  SellerSKU: string;
  QuantityShipped: number;
  QuantityReceived: number;
  QuantityInCase?: number;
  FulfillmentNetworkSKU?: string;
}

interface Shipment {
  shipmentName: string;
  shipmentId: string;
  referenceId: string;
  createdDate: string;
  lastUpdatedDate: string;
  shipTo: string;
  skus: number;
  expectedUnits: number;
  locatedUnits: number;
  primeEligibleUnits: number;
  status: string;
}

const STATUS_LIST = [
  'WORKING', 'SHIPPED', 'IN_TRANSIT', 'DELIVERED',
  'CHECKED_IN', 'RECEIVING', 'CLOSED',
];

export async function fetchShipments(statuses?: string[]): Promise<Shipment[]> {
  const statusList = statuses || STATUS_LIST;

  const res = await spApiGet<{ payload: { ShipmentData: SpShipment[] } }>(
    '/fba/inbound/v0/shipments',
    {
      ShipmentStatusList: statusList.join(','),
      MarketplaceId: env.SP_API.MARKETPLACE_ID,
      QueryType: 'SHIPMENT',
    }
  );

  const spShipments = res.payload?.ShipmentData || [];
  const shipments: Shipment[] = [];

  for (const sp of spShipments) {
    let expectedUnits = 0;
    let locatedUnits = 0;
    let skuCount = 0;

    try {
      const items = await spApiGet<{ payload: { ItemData: SpShipmentItem[] } }>(
        `/fba/inbound/v0/shipments/${sp.ShipmentId}/shipmentItems`
      );
      const itemData = items.payload?.ItemData || [];
      skuCount = itemData.length;
      expectedUnits = itemData.reduce((sum, i) => sum + (i.QuantityShipped || 0), 0);
      locatedUnits = itemData.reduce((sum, i) => sum + (i.QuantityReceived || 0), 0);
    } catch (err) {
      console.error(`Failed to fetch items for ${sp.ShipmentId}:`, (err as Error).message);
    }

    shipments.push({
      shipmentName: sp.ShipmentName || sp.ShipmentId,
      shipmentId: sp.ShipmentId,
      referenceId: sp.ShipmentId,
      createdDate: new Date().toISOString(),
      lastUpdatedDate: new Date().toISOString(),
      shipTo: sp.DestinationFulfillmentCenterId || '',
      skus: skuCount,
      expectedUnits,
      locatedUnits,
      primeEligibleUnits: 0,
      status: sp.ShipmentStatus || 'UNKNOWN',
    });
  }

  return shipments;
}
