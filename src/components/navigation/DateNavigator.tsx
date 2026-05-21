import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import type { QuickFilter } from '../../types/shipment';

interface DateNavigatorProps {
  selectedDate: Date;
  activeFilter: QuickFilter;
  dateRange?: { start: Date; end: Date };
  onDateChange: (date: Date) => void;
  onNext: () => void;
  onPrev: () => void;
  onQuickFilter: (filter: QuickFilter) => void;
}

const QUICK_FILTERS: { label: string; value: QuickFilter }[] = [
  { label: 'Today', value: 'today' },
  { label: 'Yesterday', value: 'yesterday' },
  { label: 'Last 7 Days', value: 'last7days' },
];

export function DateNavigator({
  selectedDate,
  activeFilter,
  dateRange,
  onDateChange,
  onNext,
  onPrev,
  onQuickFilter,
}: DateNavigatorProps) {
  const displayDate = dateRange
    ? `${format(dateRange.start, 'MMM d')} - ${format(dateRange.end, 'MMM d, yyyy')}`
    : format(selectedDate, 'EEEE, MMMM d, yyyy');

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
      <div className="flex items-center gap-2">
        <button
          onClick={onPrev}
          className="p-2 rounded-lg hover:bg-surface-100 transition-colors cursor-pointer"
        >
          <ChevronLeft size={18} className="text-slate-500" />
        </button>

        <div className="flex items-center gap-2 min-w-[240px]">
          <Calendar size={16} className="text-slate-400" />
          <span className="text-sm font-semibold text-brand-900">{displayDate}</span>
        </div>

        <button
          onClick={onNext}
          className="p-2 rounded-lg hover:bg-surface-100 transition-colors cursor-pointer"
        >
          <ChevronRight size={18} className="text-slate-500" />
        </button>

        <input
          type="date"
          value={format(selectedDate, 'yyyy-MM-dd')}
          onChange={(e) => {
            const d = new Date(e.target.value + 'T00:00:00');
            if (!isNaN(d.getTime())) onDateChange(d);
          }}
          className="text-xs text-slate-400 border border-surface-200 rounded-lg px-2 py-1.5 bg-surface-0 cursor-pointer hover:border-brand-300 transition-colors"
        />
      </div>

      <div className="flex items-center gap-1.5">
        {QUICK_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => onQuickFilter(f.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer ${
              activeFilter === f.value
                ? 'bg-brand-700 text-white'
                : 'bg-surface-100 text-slate-600 hover:bg-surface-200'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>
    </div>
  );
}
