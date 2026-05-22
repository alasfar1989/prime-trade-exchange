import { useState, useEffect, useCallback } from 'react';
import { fetchApi } from '../lib/api';

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

export function useOrders(daysBack = 30) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cachedAt, setCachedAt] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchApi<Order[]>('/orders', { days: String(daysBack) });
      setOrders(res.data);
      setCachedAt(res.meta.cachedAt);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch orders');
    } finally {
      setLoading(false);
    }
  }, [daysBack]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  return { orders, loading, error, cachedAt, refresh: fetchOrders };
}
