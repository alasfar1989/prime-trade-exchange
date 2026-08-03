import { useState, useEffect, useCallback } from 'react';
import { fetchApi, postApi, putApi, deleteApi } from '../lib/api';

export interface Expense {
  id: number;
  expenseDate: string;   // YYYY-MM-DD
  category: string;
  description: string;
  amount: number;        // negative = refund/credit
  vendor: string | null;
  notes: string | null;
}

export interface ExpenseInput {
  expenseDate: string;
  category: string;
  description: string;
  amount: number;
  vendor?: string | null;
  notes?: string | null;
}

export interface CategoryTotal {
  category: string;
  amount: number;
  count: number;
  pct: number | null;
}

export interface ExpensesData {
  rows: Expense[];
  totals: { amount: number; count: number };
  byCategory: CategoryTotal[];
  categories: string[];  // every category ever used, for autocomplete
  range: { from: string; to: string };
}

// from/to are YYYY-MM-DD strings. Mutations re-fetch the range so the
// category rollup and totals stay in step with the rows.
export function useExpenses(initialFrom: string, initialTo: string) {
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [data, setData] = useState<ExpensesData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cachedAt, setCachedAt] = useState<string | null>(null);

  const load = useCallback(async (f: string, t: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchApi<ExpensesData>('/expenses', { from: f, to: t });
      setData(res.data);
      setCachedAt(res.meta.cachedAt);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load expenses');
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

  // Saving throws on failure so the modal can surface the message and stay
  // open with the user's input intact.
  const create = useCallback(async (input: ExpenseInput) => {
    await postApi<Expense>('/expenses', input);
    await load(from, to);
  }, [from, to, load]);

  const update = useCallback(async (id: number, input: ExpenseInput) => {
    await putApi<Expense>(`/expenses/${id}`, input);
    await load(from, to);
  }, [from, to, load]);

  const remove = useCallback(async (id: number) => {
    await deleteApi<{ id: number }>(`/expenses/${id}`);
    await load(from, to);
  }, [from, to, load]);

  return {
    data, from, to, setRange, loading, error, cachedAt,
    refresh: () => load(from, to),
    create, update, remove,
  };
}
