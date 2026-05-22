import { spApiGet } from './spApiClient.js';
import { env } from '../config/env.js';

interface SpInventorySummary {
  asin: string;
  fnSku: string;
  sellerSku: string;
  condition: string;
  inventoryDetails?: {
    fulfillableQuantity?: number;
    inboundWorkingQuantity?: number;
    inboundShippedQuantity?: number;
    inboundReceivingQuantity?: number;
    reservedQuantity?: {
      totalReservedQuantity?: number;
      pendingCustomerOrderQuantity?: number;
      pendingTransshipmentQuantity?: number;
      fcProcessingQuantity?: number;
    };
    researchingQuantity?: {
      totalResearchingQuantity?: number;
    };
    unfulfillableQuantity?: {
      totalUnfulfillableQuantity?: number;
    };
  };
  lastUpdatedTime?: string;
  productName?: string;
  totalQuantity?: number;
}

export interface InventoryItem {
  asin: string;
  sku: string;
  fnSku: string;
  productName: string;
  condition: string;
  fulfillable: number;
  inboundWorking: number;
  inboundShipped: number;
  inboundReceiving: number;
  reserved: number;
  unfulfillable: number;
  totalQuantity: number;
  lastUpdated: string;
}

export async function fetchInventory(): Promise<InventoryItem[]> {
  const res = await spApiGet<{ payload: { inventorySummaries: SpInventorySummary[] } }>(
    '/fba/inventory/v1/summaries',
    {
      details: 'true',
      granularityType: 'Marketplace',
      granularityId: env.SP_API.MARKETPLACE_ID,
      marketplaceIds: env.SP_API.MARKETPLACE_ID,
    }
  );

  const summaries = res.payload?.inventorySummaries || [];

  return summaries.map((s) => {
    const d = s.inventoryDetails || {};
    return {
      asin: s.asin,
      sku: s.sellerSku,
      fnSku: s.fnSku,
      productName: s.productName || s.sellerSku,
      condition: s.condition,
      fulfillable: d.fulfillableQuantity || 0,
      inboundWorking: d.inboundWorkingQuantity || 0,
      inboundShipped: d.inboundShippedQuantity || 0,
      inboundReceiving: d.inboundReceivingQuantity || 0,
      reserved: d.reservedQuantity?.totalReservedQuantity || 0,
      unfulfillable: d.unfulfillableQuantity?.totalUnfulfillableQuantity || 0,
      totalQuantity: s.totalQuantity || 0,
      lastUpdated: s.lastUpdatedTime || new Date().toISOString(),
    };
  });
}
