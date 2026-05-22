import { useState, useEffect, useCallback } from 'react';
import { fetchApi } from '../lib/api';

export interface InventoryItem {
  asin: string;
  sku: string;
  fnSku: string;
  productName: string;
  condition: string;
  fulfillable: number;
  inboundWorking: number;
  inboundShipped: number;
  inboundReceiving: number;
  reserved: number;
  unfulfillable: number;
  totalQuantity: number;
  lastUpdated: string;
}

export function useInventory() {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cachedAt, setCachedAt] = useState<string | null>(null);

  const fetchInventory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchApi<InventoryItem[]>('/inventory');
      setInventory(res.data);
      setCachedAt(res.meta.cachedAt);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch inventory');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  return { inventory, loading, error, cachedAt, refresh: fetchInventory };
}
