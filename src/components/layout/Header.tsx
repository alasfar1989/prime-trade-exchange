import { Package } from 'lucide-react';

export function Header() {
  return (
    <header className="bg-brand-700 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
        <div className="bg-white/15 p-2 rounded-lg">
          <Package size={24} />
        </div>
        <div>
          <h1 className="text-lg font-bold tracking-tight">Prime Trade Exchange</h1>
          <p className="text-sm text-brand-200">FBA Shipment Tracker</p>
        </div>
      </div>
    </header>
  );
}
