import { Package } from 'lucide-react';

interface EmptyStateProps {
  message: string;
}

export function EmptyState({ message }: EmptyStateProps) {
  return (
    <div className="bg-surface-0 rounded-[var(--radius-card)] shadow-[var(--shadow-card)] p-8 text-center">
      <Package size={32} className="mx-auto text-slate-300 mb-3" />
      <p className="text-sm text-slate-400">{message}</p>
    </div>
  );
}
