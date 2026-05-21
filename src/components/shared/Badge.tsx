interface BadgeProps {
  severity: 'none' | 'low' | 'high';
  children: React.ReactNode;
}

const styles = {
  none: 'bg-green-50 text-status-green',
  low: 'bg-yellow-50 text-status-yellow',
  high: 'bg-red-50 text-status-red font-semibold',
};

export function Badge({ severity, children }: BadgeProps) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${styles[severity]}`}>
      {children}
    </span>
  );
}
