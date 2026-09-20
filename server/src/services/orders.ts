import { spApiGet } from './spApiClient.js';
import { env } from '../config/env.js';
import { subDays, format } from 'date-fns';

interface SpOrder {
  AmazonOrderId: string;
  PurchaseDate: string;
  LastUpdateDate: string;
  OrderStatus: string;
  OrderTotal?: { CurrencyCode: string; Amount: string };
  NumberOfItemsShipped: number;
  NumberOfItemsUnshipped: number;
  FulfillmentChannel: string;
  ShipServiceLevel?: string;
  ShippingAddress?: { City?: string; StateOrRegion?: string; PostalCode?: string };
  BuyerInfo?: { BuyerEmail?: string };
}

export interface Order {
  orderId: string;
  purchaseDate: string;
  lastUpdateDate: string;
  status: string;
  totalAmount: number;
  currency: string;
  itemsShipped: number;
  itemsUnshipped: number;
  fulfillmentChannel: string;
  shipCity: string;
  shipState: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// getOrders has a tiny quota: ~1 req/min refill, burst 20. When the bucket is
// drained, only patience works — wait out the refill (~65s) per page rather
// than failing the whole multi-page pull. Callers are cached/single-flighted,
// so at most one pull pays this cost and everyone else shares the result.
async function getOrdersPage(params: Record<string, string>) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await spApiGet<{ payload: { Orders: SpOrder[]; NextToken?: string } }>(
        '/orders/v0/orders',
        params
      );
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status !== 429 || attempt >= 3) throw err;
      await sleep(65_000);
    }
  }
}

export async function fetchOrders(daysBack = 30): Promise<Order[]> {
  const createdAfter = format(subDays(new Date(), daysBack), "yyyy-MM-dd'T'HH:mm:ss'Z'");

  const allOrders: SpOrder[] = [];
  let nextToken: string | undefined;

  // Paginate through all orders
  do {
    const params: Record<string, string> = nextToken
      ? { NextToken: nextToken }
      : { MarketplaceIds: env.SP_API.MARKETPLACE_ID, CreatedAfter: createdAfter };

    const res = await getOrdersPage(params);

    allOrders.push(...(res.payload?.Orders || []));
    nextToken = res.payload?.NextToken;
  } while (nextToken);

  // Sort newest first
  return allOrders
    .map((o) => ({
      orderId: o.AmazonOrderId,
      purchaseDate: o.PurchaseDate,
      lastUpdateDate: o.LastUpdateDate,
      status: o.OrderStatus,
      totalAmount: o.OrderTotal ? parseFloat(o.OrderTotal.Amount) : 0,
      currency: o.OrderTotal?.CurrencyCode || 'USD',
      itemsShipped: o.NumberOfItemsShipped || 0,
      itemsUnshipped: o.NumberOfItemsUnshipped || 0,
      fulfillmentChannel: o.FulfillmentChannel || '',
      shipCity: o.ShippingAddress?.City || '',
      shipState: o.ShippingAddress?.StateOrRegion || '',
    }))
    .sort((a, b) => new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime());
}

interface SpOrderItem {
  SellerSKU?: string;
  Title?: string;
}

// Product titles (names) for the line items of one order, keyed by seller SKU.
// Used to resolve names for SKUs not in current FBA inventory.
export async function fetchOrderItems(orderId: string): Promise<Map<string, string>> {
  const res = await spApiGet<{ payload: { OrderItems: SpOrderItem[] } }>(
    `/orders/v0/orders/${encodeURIComponent(orderId)}/orderItems`,
    {},
    false
  );
  const map = new Map<string, string>();
  for (const it of res.payload?.OrderItems || []) {
    if (it.SellerSKU && it.Title) map.set(it.SellerSKU, it.Title);
  }
  return map;
}
