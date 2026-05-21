import { useState, useCallback, useMemo } from 'react';
import { addDays, subDays, startOfDay } from 'date-fns';
import type { QuickFilter } from '../types/shipment';

export function useDateNavigation() {
  const [selectedDate, setSelectedDate] = useState<Date>(startOfDay(new Date()));
  const [activeFilter, setActiveFilter] = useState<QuickFilter>('today');

  const dateRange = useMemo(() => {
    if (activeFilter === 'last7days') {
      return {
        start: subDays(startOfDay(new Date()), 6),
        end: startOfDay(new Date()),
      };
    }
    return undefined;
  }, [activeFilter]);

  const setDate = useCallback((date: Date) => {
    setSelectedDate(startOfDay(date));
    setActiveFilter('today'); // clear quick filter when manually picking
  }, []);

  const goNext = useCallback(() => {
    setSelectedDate((prev) => addDays(prev, 1));
    setActiveFilter('today');
  }, []);

  const goPrev = useCallback(() => {
    setSelectedDate((prev) => subDays(prev, 1));
    setActiveFilter('today');
  }, []);

  const setQuickFilter = useCallback((filter: QuickFilter) => {
    setActiveFilter(filter);
    const today = startOfDay(new Date());
    switch (filter) {
      case 'today':
        setSelectedDate(today);
        break;
      case 'yesterday':
        setSelectedDate(subDays(today, 1));
        break;
      case 'last7days':
        setSelectedDate(today);
        break;
    }
  }, []);

  return {
    selectedDate,
    dateRange,
    activeFilter,
    setDate,
    goNext,
    goPrev,
    setQuickFilter,
  };
}
