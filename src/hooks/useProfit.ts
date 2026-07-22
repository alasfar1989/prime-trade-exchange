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

export interface ProfitData {
  rows: ProfitRow[];
  totals: ProfitTotals;
  range: { from: string; to: string }; // ISO datetimes resolved by the server
}

// from/to are YYYY-MM-DD strings.
export function useProfit(initialFrom: string, initialTo: string) {
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [data, setData] = useState<ProfitData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cachedAt, setCachedAt] = useState<string | null>(null);

  const load = useCallback(async (f: string, t: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchApi<ProfitData>('/profit', { from: f, to: t });
      setData(res.data);
      setCachedAt(res.meta.cachedAt);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load profit');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(from, to);
  }, [from, to, load]);

  const setRange = useCallback((f: string, t: string) => {
    setFrom(f);
    setTo(t);
  }, []);

  return { data, from, to, setRange, loading, error, cachedAt, refresh: () => load(from, to) };
}
