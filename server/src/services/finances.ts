import { spApiGet } from './spApiClient.js';
import { format } from 'date-fns';

// --- SP-API Finances shapes (only the fields we use) ---
interface Money { CurrencyAmount?: number; CurrencyCode?: string }
interface ChargeComponent { ChargeType?: string; ChargeAmount?: Money }
interface FeeComponent { FeeType?: string; FeeAmount?: Money }
interface ShipmentItem {
  SellerSKU?: string;
  QuantityShipped?: number;
  ItemChargeList?: ChargeComponent[];
  ItemFeeList?: FeeComponent[];
}
interface ShipmentEvent {
  AmazonOrderId?: string;
  PostedDate?: string;
  ShipmentItemList?: ShipmentItem[];
}
interface FinancialEventsResponse {
  payload?: {
    NextToken?: string;
    FinancialEvents?: { ShipmentEventList?: ShipmentEvent[] };
  };
}

export interface SkuFinance {
  sku: string;
  unitsSold: number;
  revenue: number; // sum of Principal charges (positive)
  fees: number;    // sum of Amazon fees (negative, as Amazon returns them)
  sampleOrderId?: string; // one order containing this SKU (to resolve its name)
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Finances API is rate-limited (~0.5 req/s). Retry a couple times on 429.
async function getPage(params: Record<string, string>): Promise<FinancialEventsResponse> {
  let attempt = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      return await spApiGet<FinancialEventsResponse>('/finances/v0/financialEvents', params, false);
    } catch (err: any) {
      if (err?.response?.status === 429 && attempt < 4) {
        attempt++;
        await sleep(1500 * attempt);
        continue;
      }
      throw err;
    }
  }
}

/**
 * Pull shipment (sale) financial events for the [from, to] date range and
 * aggregate proceeds + fees per seller SKU. Refunds are not included in v1.
 */
export async function fetchSkuFinances(from: Date, to: Date): Promise<SkuFinance[]> {
  const postedAfter = format(from, "yyyy-MM-dd'T'HH:mm:ss'Z'");
  const postedBefore = format(to, "yyyy-MM-dd'T'HH:mm:ss'Z'");
  const bySku = new Map<string, SkuFinance>();
  let nextToken: string | undefined;

  do {
    const params: Record<string, string> = nextToken
      ? { NextToken: nextToken }
      : { PostedAfter: postedAfter, PostedBefore: postedBefore, MaxResultsPerPage: '100' };

    const res = await getPage(params);
    const events = res.payload?.FinancialEvents?.ShipmentEventList || [];

    for (const ev of events) {
      for (const item of ev.ShipmentItemList || []) {
        const sku = item.SellerSKU;
        if (!sku) continue;
        const rec = bySku.get(sku) || { sku, unitsSold: 0, revenue: 0, fees: 0 };
        if (!rec.sampleOrderId && ev.AmazonOrderId) rec.sampleOrderId = ev.AmazonOrderId;
        rec.unitsSold += item.QuantityShipped || 0;
        for (const c of item.ItemChargeList || []) {
          if (c.ChargeType === 'Principal') rec.revenue += c.ChargeAmount?.CurrencyAmount || 0;
        }
        for (const f of item.ItemFeeList || []) {
          rec.fees += f.FeeAmount?.CurrencyAmount || 0; // already negative
        }
        bySku.set(sku, rec);
      }
    }

    nextToken = res.payload?.NextToken;
    if (nextToken) await sleep(600); // stay under the rate limit between pages
  } while (nextToken);

  return [...bySku.values()];
}
