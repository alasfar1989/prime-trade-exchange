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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function fetchInventory(): Promise<InventoryItem[]> {
  const mkt = env.SP_API.MARKETPLACE_ID;
  const summaries: SpInventorySummary[] = [];
  let nextToken: string | undefined;

  // Paginate through ALL FBA inventory (one call returns ~50 + a nextToken).
  do {
    const params: Record<string, string> = {
      details: 'true',
      granularityType: 'Marketplace',
      granularityId: mkt,
      marketplaceIds: mkt,
      ...(nextToken ? { nextToken } : {}),
    };

    let res;
    let attempt = 0;
    // getInventorySummaries has a low rate limit (~2 req/s) — retry on 429.
    // eslint-disable-next-line no-constant-condition
    while (true) {
      try {
        res = await spApiGet<{
          pagination?: { nextToken?: string };
          payload: { inventorySummaries: SpInventorySummary[] };
        }>('/fba/inventory/v1/summaries', params);
        break;
      } catch (err: any) {
        if (err?.response?.status === 429 && attempt < 5) {
          attempt++;
          await sleep(1000 * attempt);
          continue;
        }
        throw err;
      }
    }

    summaries.push(...(res.payload?.inventorySummaries || []));
    nextToken = res.pagination?.nextToken;
    if (nextToken) await sleep(600);
  } while (nextToken);

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
