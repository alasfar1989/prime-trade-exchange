import { useMemo, useState } from 'react';
import { Header } from './components/layout/Header';
import { Footer } from './components/layout/Footer';
import { CsvUploader } from './components/upload/CsvUploader';
import { DateNavigator } from './components/navigation/DateNavigator';
import { DashboardView } from './components/dashboard/DashboardView';
import { InventoryView } from './components/dashboard/InventoryView';
import { OrdersView } from './components/dashboard/OrdersView';
import { ProfitView } from './components/dashboard/ProfitView';
import { ExpensesView } from './components/dashboard/ExpensesView';
import { ExportButton } from './components/shared/ExportButton';
import { useShipments } from './hooks/useShipments';
import { useDateNavigation } from './hooks/useDateNavigation';
import { buildDailySummary } from './lib/dateUtils';
import { Truck, Package, ShoppingCart, TrendingUp, Receipt, RefreshCw } from 'lucide-react';

type Tab = 'shipments' | 'inventory' | 'orders' | 'profit' | 'expenses';

const TABS: { id: Tab; label: string; icon: typeof Truck }[] = [
  { id: 'shipments', label: 'Shipments', icon: Truck },
  { id: 'inventory', label: 'Inventory', icon: Package },
  { id: 'orders', label: 'Orders', icon: ShoppingCart },
  { id: 'profit', label: 'Profit', icon: TrendingUp },
  { id: 'expenses', label: 'Expenses', icon: Receipt },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('shipments');
  const {
    shipments, uploadCsv, clearData, refreshFromApi,
    hasData, filename, uploadedAt, error, warnings, dataSource, loading,
  } = useShipments();
  const { selectedDate, dateRange, activeFilter, setDate, goNext, goPrev, setQuickFilter } =
    useDateNavigation();

  const summary = useMemo(
    () => buildDailySummary(shipments, selectedDate, dateRange),
    [shipments, selectedDate, dateRange]
  );

  return (
    <>
      <Header />

      {/* Tab navigation */}
      <div className="border-b border-surface-200 bg-surface-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center gap-1">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
                  activeTab === tab.id
                    ? 'border-brand-500 text-brand-700'
                    : 'border-transparent text-slate-500 hover:text-brand-900 hover:border-surface-200'
                }`}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 space-y-6">
        {activeTab === 'shipments' && (
          <>
            {/* Data source bar */}
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <CsvUploader
                  onUpload={uploadCsv}
                  onClear={clearData}
                  hasData={hasData}
                  filename={filename}
                  uploadedAt={uploadedAt}
                  error={error}
                  warnings={warnings}
                />
              </div>
              {dataSource !== 'none' && (
                <button
                  onClick={refreshFromApi}
                  disabled={loading}
                  className="flex items-center gap-2 px-3 py-2 bg-brand-50 text-brand-700 rounded-lg text-xs font-medium hover:bg-brand-100 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                  {loading ? 'Syncing...' : 'Sync from Amazon'}
                </button>
              )}
            </div>

            {hasData && (
              <>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <DateNavigator
                    selectedDate={selectedDate}
                    dateRange={dateRange}
                    activeFilter={activeFilter}
                    onDateChange={setDate}
                    onNext={goNext}
                    onPrev={goPrev}
                    onQuickFilter={setQuickFilter}
                  />
                  <ExportButton summary={summary} date={selectedDate} />
                </div>
                <DashboardView summary={summary} />
              </>
            )}
          </>
        )}

        {activeTab === 'inventory' && <InventoryView />}
        {activeTab === 'orders' && <OrdersView />}
        {activeTab === 'profit' && <ProfitView />}
        {activeTab === 'expenses' && <ExpensesView />}
      </main>
      <Footer />
    </>
  );
}
