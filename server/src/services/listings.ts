import { spApiGet } from './spApiClient.js';
import { env } from '../config/env.js';

interface ListingsItem {
  summaries?: Array<{ itemName?: string; marketplaceId?: string }>;
}

// Resolve a product name for a single SKU via the Listings Items API. Works for
// any SKU the seller has (active/inactive, FBA/FBM), unlike FBA inventory which
// only lists currently-stocked SKUs. Returns null on any failure (deleted
// listing, missing Listings role, throttling) so the caller can fall back.
export async function fetchListingName(sku: string): Promise<string | null> {
  try {
    const path = `/listings/2021-08-01/items/${encodeURIComponent(env.SP_API.SELLER_ID)}/${encodeURIComponent(sku)}`;
    const res = await spApiGet<ListingsItem>(
      path,
      { marketplaceIds: env.SP_API.MARKETPLACE_ID, includedData: 'summaries' },
      false // Listings API uses marketplaceIds (plural); don't inject singular MarketplaceId
    );
    return res.summaries?.find((s) => s.itemName)?.itemName || null;
  } catch {
    return null;
  }
}
