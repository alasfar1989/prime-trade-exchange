import { spApiGet } from './spApiClient.js';
import { format } from 'date-fns';
import { loadRates, rateOn, type RateTable } from './fx.js';

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
  MarketplaceName?: string;
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
  MarketplaceName?: string;
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
  PostedDate?: string;
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

/** How foreign-currency money was turned into dollars, so the conversion is visible. */
export interface CurrencyConversion {
  currency: string;
  local: number;   // net signed total in the original currency
  usd: number;     // the same money in USD
  avgRate: number; // effective local units per USD
  count: number;   // amounts converted
}

/** Money in a currency no rate could be found for — left OUT of every total. */
export interface UnconvertedAmount {
  currency: string;
  amount: number;
  count: number;
}

export interface FinancesResult {
  skus: SkuFinance[];
  account: AccountFinance;
  conversions: CurrencyConversion[];
  unconverted: UnconvertedAmount[];
}

/** One marketplace's share of a SKU, already in USD. */
export interface MarketplaceSlice {
  unitsSold: number;
  unitsRefunded: number;
  revenue: number;
  refunds: number;
  fees: number;
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
  /** Same figures split by marketplace code (US, MX, CA, …). All USD. */
  byMarketplace: Record<string, MarketplaceSlice>;
}

// Short codes for the marketplaces on a North America unified account.
const MARKETPLACE_CODES: Record<string, string> = {
  'Amazon.com': 'US',
  'Amazon.com.mx': 'MX',
  'Amazon.ca': 'CA',
  'Amazon.com.br': 'BR',
};
export const marketplaceCode = (name?: string) => (name ? MARKETPLACE_CODES[name] ?? name : 'US');

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
  sku, unitsSold: 0, unitsRefunded: 0, revenue: 0, grossRevenue: 0, refunds: 0, fees: 0, byMarketplace: {},
});

const blankSlice = (): MarketplaceSlice => ({ unitsSold: 0, unitsRefunded: 0, revenue: 0, refunds: 0, fees: 0 });

// Every currency code that appears anywhere in a page of events.
function collectCurrencies(o: unknown, into: Set<string>): void {
  if (Array.isArray(o)) {
    for (const v of o) collectCurrencies(v, into);
  } else if (o && typeof o === 'object') {
    const code = (o as Money).CurrencyCode;
    if (typeof code === 'string') into.add(code);
    for (const v of Object.values(o)) collectCurrencies(v, into);
  }
}

/**
 * Pull shipment (sale) and refund financial events for the [from, to] range and
 * aggregate NET proceeds + fees per seller SKU, in USD.
 *
 * Refunds are netted off, not reported alongside: a SKU that sold 10 and had 2
 * returned moves 8 units. Because Amazon posts a refund whenever it settles —
 * which can be a later window than the sale — a SKU can finish a window with
 * negative net units. That is correct for the period and is left as-is so the
 * totals foot against Amazon's own settlement.
 *
 * Every amount carries its own CurrencyCode and is converted at the rate for
 * the day it posted. Events are collected first and aggregated after, because
 * the rates can only be fetched once we know which currencies and days appear.
 */
export async function fetchFinances(from: Date, to: Date): Promise<FinancesResult> {
  const postedAfter = format(from, "yyyy-MM-dd'T'HH:mm:ss'Z'");
  const postedBefore = format(to, "yyyy-MM-dd'T'HH:mm:ss'Z'");
  const shipments: ShipmentEvent[] = [];
  const refunds: RefundEvent[] = [];
  const adjustmentEvents: AdjustmentEvent[] = [];
  const serviceFeeEvents: ServiceFeeEvent[] = [];
  const currencies = new Set<string>();
  let nextToken: string | undefined;

  do {
    const params: Record<string, string> = nextToken
      ? { NextToken: nextToken }
      : { PostedAfter: postedAfter, PostedBefore: postedBefore, MaxResultsPerPage: '100' };

    const res = await getPage(params);
    const fe = res.payload?.FinancialEvents;
    shipments.push(...(fe?.ShipmentEventList || []));
    refunds.push(...(fe?.RefundEventList || []));
    adjustmentEvents.push(...(fe?.AdjustmentEventList || []));
    serviceFeeEvents.push(...(fe?.ServiceFeeEventList || []));
    collectCurrencies(fe, currencies);

    nextToken = res.payload?.NextToken;
    if (nextToken) await sleep(600); // stay under the rate limit between pages
  } while (nextToken);

  const rates = await loadRates([...currencies], from, to);
  const conversions = new Map<string, CurrencyConversion>();
  const unconverted = new Map<string, UnconvertedAmount>();
  // Service fee events carry no PostedDate; price them at the window's last rate.
  const fallbackDay = format(to, 'yyyy-MM-dd');

  // Money -> USD at the posting day's rate. A currency with no rate is set
  // aside (and reported) rather than counted 1:1 as dollars.
  const usd = (m: Money | undefined, postedDate?: string): number => {
    const amt = m?.CurrencyAmount || 0;
    const cur = m?.CurrencyCode || 'USD';
    if (cur === 'USD' || amt === 0) return amt;
    const table: RateTable | undefined = rates.get(cur);
    if (!table) {
      const u = unconverted.get(cur) || { currency: cur, amount: 0, count: 0 };
      u.amount += amt;
      u.count += 1;
      unconverted.set(cur, u);
      return 0;
    }
    const value = amt * rateOn(table, (postedDate || fallbackDay).slice(0, 10));
    const c = conversions.get(cur) || { currency: cur, local: 0, usd: 0, avgRate: 0, count: 0 };
    c.local += amt;
    c.usd += value;
    c.count += 1;
    conversions.set(cur, c);
    return value;
  };

  const bySku = new Map<string, SkuFinance>();
  const adjustments = new Map<string, LineItem>();
  const serviceFees = new Map<string, LineItem>();

  const tally = (m: Map<string, LineItem>, type: string, amount: number) => {
    const rec = m.get(type) || { type, amount: 0, count: 0 };
    rec.amount += amount;
    rec.count += 1;
    m.set(type, rec);
  };
  const recFor = (sku: string, marketplace: string) => {
    const rec = bySku.get(sku) || blank(sku);
    bySku.set(sku, rec);
    const slice = (rec.byMarketplace[marketplace] ||= blankSlice());
    return { rec, slice };
  };

  for (const ev of shipments) {
    const mkt = marketplaceCode(ev.MarketplaceName);
    for (const item of ev.ShipmentItemList || []) {
      const sku = item.SellerSKU;
      if (!sku) continue;
      const { rec, slice } = recFor(sku, mkt);
      if (!rec.sampleOrderId && ev.AmazonOrderId) rec.sampleOrderId = ev.AmazonOrderId;
      const qty = item.QuantityShipped || 0;
      rec.unitsSold += qty;
      slice.unitsSold += qty;
      for (const c of item.ItemChargeList || []) {
        if (c.ChargeType === 'Principal') {
          const amt = usd(c.ChargeAmount, ev.PostedDate);
          rec.revenue += amt;
          rec.grossRevenue += amt;
          slice.revenue += amt;
        }
      }
      for (const f of item.ItemFeeList || []) {
        const amt = usd(f.FeeAmount, ev.PostedDate); // already negative
        rec.fees += amt;
        slice.fees += amt;
      }
    }
  }

  for (const ev of refunds) {
    const mkt = marketplaceCode(ev.MarketplaceName);
    for (const item of ev.ShipmentItemAdjustmentList || []) {
      const sku = item.SellerSKU;
      if (!sku) continue;
      const { rec, slice } = recFor(sku, mkt);
      if (!rec.sampleOrderId && ev.AmazonOrderId) rec.sampleOrderId = ev.AmazonOrderId;
      // Refunded quantity arrives POSITIVE, so it must be subtracted — adding
      // it would inflate both units and COGS (the bug that broke the first
      // spreadsheet build of this same report).
      const returned = Math.abs(item.QuantityShipped || 0);
      rec.unitsRefunded += returned;
      rec.unitsSold -= returned;
      slice.unitsRefunded += returned;
      slice.unitsSold -= returned;
      for (const c of item.ItemChargeAdjustmentList || []) {
        if (c.ChargeType === 'Principal') {
          const amt = usd(c.ChargeAmount, ev.PostedDate); // negative
          rec.revenue += amt;
          rec.refunds += amt;
          slice.revenue += amt;
          slice.refunds += amt;
        }
      }
      // Signed on purpose: Commission credits back positive, RefundCommission
      // is a genuine negative cost. Forcing either sign would corrupt one.
      for (const f of item.ItemFeeAdjustmentList || []) {
        const amt = usd(f.FeeAmount, ev.PostedDate);
        rec.fees += amt;
        slice.fees += amt;
      }
    }
  }

  for (const ev of adjustmentEvents) {
    tally(adjustments, ev.AdjustmentType || 'Other', usd(ev.AdjustmentAmount, ev.PostedDate));
  }
  for (const ev of serviceFeeEvents) {
    for (const f of ev.FeeList || []) {
      tally(serviceFees, f.FeeType || 'Other', usd(f.FeeAmount));
    }
  }

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
    conversions: [...conversions.values()].map((c) => ({ ...c, avgRate: c.usd ? c.local / c.usd : 0 })),
    unconverted: [...unconverted.values()],
  };
}
