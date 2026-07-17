import { useState, useEffect, useCallback } from 'react';
import { fetchApi } from '../lib/api';

export interface ProfitRow {
  sku: string;
  productName: string | null;
  unitsSold: number;
  revenue: number;
  fees: number; // negative
  unitCost: number | null;
  cost: number;
  profit: number;
  margin: number | null; // percent
  hasCost: boolean;
}

export interface ProfitTotals {
  unitsSold: number;
  revenue: number;
  fees: number;
  cost: number;
  profit: number;
  margin: number | null;
  skuCount: number;
  missingCost: number;
}

interface ProfitData {
  rows: ProfitRow[];
  totals: ProfitTotals;
  days: number;
}

export function useProfit(initialDays = 30) {
  const [days, setDays] = useState(initialDays);
  const [data, setData] = useState<ProfitData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cachedAt, setCachedAt] = useState<string | null>(null);

  const load = useCallback(async (d: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchApi<ProfitData>('/profit', { days: String(d) });
      setData(res.data);
      setCachedAt(res.meta.cachedAt);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load profit');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(days);
  }, [days, load]);

  return { data, days, setDays, loading, error, cachedAt, refresh: () => load(days) };
}
