import { Router } from 'express';
import { fetchSkuFinances, type SkuFinance } from '../services/finances.js';
import { getAllCosts } from '../services/costs.js';
import { fetchInventory } from '../services/inventory.js';
import { getCachedNames, saveNames } from '../services/names.js';
import { fetchListingName } from '../services/listings.js';
import { cacheGet, cacheSet } from '../cache/memoryCache.js';

const router = Router();
const FIN_TTL = 5 * 60 * 1000; // cache the (slow, rate-limited) SP-API pull for 5 min

const round = (n: number) => Math.round(n * 100) / 100;

// GET /api/profit?days=30
router.get('/profit', async (req, res, next) => {
  try {
    const days = parseInt(req.query.days as string) || 30;

    // Finances come from SP-API (cached); costs come from the DB (always fresh,
    // so a cost edit shows up immediately without re-hitting Amazon).
    const cacheKey = `finances:${days}`;
    let finances: SkuFinance[];
    let source: 'sp-api' | 'cache' = 'sp-api';
    const cached = cacheGet<SkuFinance[]>(cacheKey);
    if (cached) {
      finances = (await cached.data) as SkuFinance[];
      source = 'cache';
    } else {
      finances = await fetchSkuFinances(days);
      cacheSet(cacheKey, finances, FIN_TTL);
    }

    const [costs, inventory, cachedNames] = await Promise.all([
      getAllCosts(),
      fetchInventory().catch(() => [] as Array<{ sku: string; productName: string }>),
      getCachedNames().catch(() => new Map<string, string>()),
    ]);
    const nameBySku = new Map<string, string>(inventory.map((i) => [i.sku, i.productName]));
    // Fill names for sold SKUs not in current inventory: DB cache first, then
    // the Listings API for anything still unresolved (persist what we find).
    for (const [sku, name] of cachedNames) {
      if (!nameBySku.get(sku)) nameBySku.set(sku, name);
    }
    const unresolved = finances.filter((f) => !nameBySku.get(f.sku)).map((f) => f.sku);
    if (unresolved.length) {
      const fetched = new Map<string, string>();
      for (const sku of unresolved) {
        const name = await fetchListingName(sku);
        if (name) {
          nameBySku.set(sku, name);
          fetched.set(sku, name);
        }
      }
      saveNames(fetched).catch(() => {});
    }

    const totals = { unitsSold: 0, revenue: 0, fees: 0, cost: 0, profit: 0, missingCost: 0 };
    const rows = finances.map((f) => {
      const unitCost = costs.get(f.sku);
      const cost = unitCost != null ? unitCost * f.unitsSold : 0;
      const profit = f.revenue + f.fees - cost; // fees are negative
      totals.unitsSold += f.unitsSold;
      totals.revenue += f.revenue;
      totals.fees += f.fees;
      totals.cost += cost;
      totals.profit += profit;
      if (unitCost == null) totals.missingCost += 1;
      return {
        sku: f.sku,
        productName: nameBySku.get(f.sku) ?? null,
        unitsSold: f.unitsSold,
        revenue: round(f.revenue),
        fees: round(f.fees),
        unitCost: unitCost ?? null,
        cost: round(cost),
        profit: round(profit),
        margin: f.revenue ? round((profit / f.revenue) * 100) : null,
        hasCost: unitCost != null,
      };
    });

    rows.sort((a, b) => b.profit - a.profit);

    res.json({
      data: {
        rows,
        totals: {
          unitsSold: totals.unitsSold,
          revenue: round(totals.revenue),
          fees: round(totals.fees),
          cost: round(totals.cost),
          profit: round(totals.profit),
          margin: totals.revenue ? round((totals.profit / totals.revenue) * 100) : null,
          skuCount: rows.length,
          missingCost: totals.missingCost,
        },
        days,
      },
      meta: { source, cachedAt: new Date().toISOString() },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
