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
// Account-level events: money that moves for the whole account, not for a sale.
// Verified against live data — an adjustment is NOT automatically income: the
// list carries reimbursements (WAREHOUSE_LOST, MISSING_FROM_INBOUND, …) AND
// COMPENSATED_CLAWBACK, which is Amazon taking an earlier reimbursement back.
// They are summed signed into one net figure, with a per-type breakdown so the
// composition stays visible rather than hidden behind a single number.
interface AdjustmentEvent {
  AdjustmentType?: string;
  AdjustmentAmount?: Money;
}
// Storage, inbound transport, removals, the monthly Subscription fee. Always
// negative, never tied to a SKU, so they are operating costs and must stay out
// of the per-SKU rollup or they would distort product margin.
interface ServiceFeeEvent {
  FeeList?: FeeComponent[];
}
interface FinancialEventsResponse {
  payload?: {
    NextToken?: string;
    FinancialEvents?: {
      ShipmentEventList?: ShipmentEvent[];
      RefundEventList?: RefundEvent[];
      AdjustmentEventList?: AdjustmentEvent[];
      ServiceFeeEventList?: ServiceFeeEvent[];
    };
  };
}

export interface LineItem {
  type: string;
  amount: number;
  count: number;
}

export interface AccountFinance {
  /** Net of reimbursements and clawbacks — other income, never product margin. */
  reimbursements: number;
  reimbursementsByType: LineItem[];
  /** Account-level operating costs (negative). */
  serviceFees: number;
  serviceFeesByType: LineItem[];
}

export interface FinancesResult {
  skus: SkuFinance[];
  account: AccountFinance;
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
export async function fetchFinances(from: Date, to: Date): Promise<FinancesResult> {
  const postedAfter = format(from, "yyyy-MM-dd'T'HH:mm:ss'Z'");
  const postedBefore = format(to, "yyyy-MM-dd'T'HH:mm:ss'Z'");
  const bySku = new Map<string, SkuFinance>();
  const adjustments = new Map<string, LineItem>();
  const serviceFees = new Map<string, LineItem>();
  let nextToken: string | undefined;

  const tally = (m: Map<string, LineItem>, type: string, amount: number) => {
    const rec = m.get(type) || { type, amount: 0, count: 0 };
    rec.amount += amount;
    rec.count += 1;
    m.set(type, rec);
  };

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

    for (const ev of res.payload?.FinancialEvents?.AdjustmentEventList || []) {
      tally(adjustments, ev.AdjustmentType || 'Other', ev.AdjustmentAmount?.CurrencyAmount || 0);
    }
    for (const ev of res.payload?.FinancialEvents?.ServiceFeeEventList || []) {
      for (const f of ev.FeeList || []) {
        tally(serviceFees, f.FeeType || 'Other', f.FeeAmount?.CurrencyAmount || 0);
      }
    }

    nextToken = res.payload?.NextToken;
    if (nextToken) await sleep(600); // stay under the rate limit between pages
  } while (nextToken);

  // Biggest absolute mover first, so the line that explains the total leads.
  // Zero-value types are dropped: Amazon reports several of them every period
  // (surcharges that did not apply), and they add rows without adding meaning.
  const byImpact = (m: Map<string, LineItem>) =>
    [...m.values()]
      .filter((i) => i.amount !== 0)
      .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
  const sum = (items: LineItem[]) => items.reduce((s, i) => s + i.amount, 0);
  const reimbursementsByType = byImpact(adjustments);
  const serviceFeesByType = byImpact(serviceFees);

  return {
    skus: [...bySku.values()],
    account: {
      reimbursements: sum(reimbursementsByType),
      reimbursementsByType,
      serviceFees: sum(serviceFeesByType),
      serviceFeesByType,
    },
  };
}
