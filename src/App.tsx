import { useMemo } from 'react';
import { Header } from './components/layout/Header';
import { Footer } from './components/layout/Footer';
import { CsvUploader } from './components/upload/CsvUploader';
import { DateNavigator } from './components/navigation/DateNavigator';
import { DashboardView } from './components/dashboard/DashboardView';
import { ExportButton } from './components/shared/ExportButton';
import { useShipments } from './hooks/useShipments';
import { useDateNavigation } from './hooks/useDateNavigation';
import { buildDailySummary } from './lib/dateUtils';

export default function App() {
  const { shipments, uploadCsv, clearData, hasData, filename, uploadedAt, error, warnings } =
    useShipments();
  const { selectedDate, dateRange, activeFilter, setDate, goNext, goPrev, setQuickFilter } =
    useDateNavigation();

  const summary = useMemo(
    () => buildDailySummary(shipments, selectedDate, dateRange),
    [shipments, selectedDate, dateRange]
  );

  return (
    <>
      <Header />
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 space-y-6">
        {/* Upload bar */}
        <CsvUploader
          onUpload={uploadCsv}
          onClear={clearData}
          hasData={hasData}
          filename={filename}
          uploadedAt={uploadedAt}
          error={error}
          warnings={warnings}
        />

        {hasData && (
          <>
            {/* Date navigation + export */}
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

            {/* Dashboard */}
            <DashboardView summary={summary} />
          </>
        )}
      </main>
      <Footer />
    </>
  );
}
