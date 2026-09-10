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
// A refund reuses the shipment shape but under *Adjustment names. Verified
// against live data: QuantityShipped is POSITIVE (units returned), Principal is
// negative, and the fee adjustments carry mixed signs — Commission comes back
// positive (referral fee credited to you) while RefundCommission is negative
// (Amazon's refund admin charge). ItemTaxWithheldList is sales tax Amazon remits
// to the states: pure pass-through, deliberately ignored.
interface ShipmentItemAdjustment {
  SellerSKU?: string;
  QuantityShipped?: number;
  ItemChargeAdjustmentList?: ChargeComponent[];
  ItemFeeAdjustmentList?: FeeComponent[];
}
interface RefundEvent {
  AmazonOrderId?: string;
  PostedDate?: string;
  ShipmentItemAdjustmentList?: ShipmentItemAdjustment[];
}
interface FinancialEventsResponse {
  payload?: {
    NextToken?: string;
    FinancialEvents?: {
      ShipmentEventList?: ShipmentEvent[];
      RefundEventList?: RefundEvent[];
    };
  };
}

export interface SkuFinance {
  sku: string;
  unitsSold: number;      // NET units: shipped minus refunded
  unitsRefunded: number;  // units returned in the window (positive)
  revenue: number;        // NET revenue: Principal shipped minus Principal refunded
  grossRevenue: number;   // Principal on shipments only, before refunds
  refunds: number;        // Principal returned to buyers (negative)
  fees: number;           // shipment fees plus refund fee adjustments (net, signed)
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

const blank = (sku: string): SkuFinance => ({
  sku, unitsSold: 0, unitsRefunded: 0, revenue: 0, grossRevenue: 0, refunds: 0, fees: 0,
});

/**
 * Pull shipment (sale) and refund financial events for the [from, to] range and
 * aggregate NET proceeds + fees per seller SKU.
 *
 * Refunds are netted off, not reported alongside: a SKU that sold 10 and had 2
 * returned moves 8 units. Because Amazon posts a refund whenever it settles —
 * which can be a later window than the sale — a SKU can finish a window with
 * negative net units. That is correct for the period and is left as-is so the
 * totals foot against Amazon's own settlement.
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
        const rec = bySku.get(sku) || blank(sku);
        if (!rec.sampleOrderId && ev.AmazonOrderId) rec.sampleOrderId = ev.AmazonOrderId;
        rec.unitsSold += item.QuantityShipped || 0;
        for (const c of item.ItemChargeList || []) {
          if (c.ChargeType === 'Principal') {
            const amt = c.ChargeAmount?.CurrencyAmount || 0;
            rec.revenue += amt;
            rec.grossRevenue += amt;
          }
        }
        for (const f of item.ItemFeeList || []) {
          rec.fees += f.FeeAmount?.CurrencyAmount || 0; // already negative
        }
        bySku.set(sku, rec);
      }
    }

    for (const ev of res.payload?.FinancialEvents?.RefundEventList || []) {
      for (const item of ev.ShipmentItemAdjustmentList || []) {
        const sku = item.SellerSKU;
        if (!sku) continue;
        const rec = bySku.get(sku) || blank(sku);
        if (!rec.sampleOrderId && ev.AmazonOrderId) rec.sampleOrderId = ev.AmazonOrderId;
        // Refunded quantity arrives POSITIVE, so it must be subtracted — adding
        // it would inflate both units and COGS (the bug that broke the first
        // spreadsheet build of this same report).
        const returned = Math.abs(item.QuantityShipped || 0);
        rec.unitsRefunded += returned;
        rec.unitsSold -= returned;
        for (const c of item.ItemChargeAdjustmentList || []) {
          if (c.ChargeType === 'Principal') {
            const amt = c.ChargeAmount?.CurrencyAmount || 0; // negative
            rec.revenue += amt;
            rec.refunds += amt;
          }
        }
        // Signed on purpose: Commission credits back positive, RefundCommission
        // is a genuine negative cost. Forcing either sign would corrupt one.
        for (const f of item.ItemFeeAdjustmentList || []) {
          rec.fees += f.FeeAmount?.CurrencyAmount || 0;
        }
        bySku.set(sku, rec);
      }
    }

    nextToken = res.payload?.NextToken;
    if (nextToken) await sleep(600); // stay under the rate limit between pages
  } while (nextToken);

  return [...bySku.values()];
}
