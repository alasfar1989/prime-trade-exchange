import { useState, useEffect, useCallback } from 'react';
import { fetchApi, putApi } from '../lib/api';

// Per-SKU costs the user enters. Stored server-side (Postgres).
export function useCosts() {
  const [costs, setCosts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchApi<Record<string, number>>('/costs');
      setCosts(res.data || {});
    } catch {
      // costs are optional; don't block the page if the DB isn't reachable
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const saveCost = useCallback(async (sku: string, cost: number) => {
    await putApi(`/costs/${encodeURIComponent(sku)}`, { cost });
    setCosts((prev) => ({ ...prev, [sku]: cost }));
  }, []);

  return { costs, loading, saveCost, reload: load };
}
