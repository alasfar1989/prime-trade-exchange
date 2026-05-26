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

export async function fetchOrders(daysBack = 30): Promise<Order[]> {
  const createdAfter = format(subDays(new Date(), daysBack), "yyyy-MM-dd'T'HH:mm:ss'Z'");

  const allOrders: SpOrder[] = [];
  let nextToken: string | undefined;

  // Paginate through all orders
  do {
    const params: Record<string, string> = nextToken
      ? { NextToken: nextToken }
      : { MarketplaceIds: env.SP_API.MARKETPLACE_ID, CreatedAfter: createdAfter };

    const res = await spApiGet<{ payload: { Orders: SpOrder[]; NextToken?: string } }>(
      '/orders/v0/orders',
      params
    );

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
