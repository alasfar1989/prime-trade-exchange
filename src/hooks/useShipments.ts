import { useState, useEffect, useCallback } from 'react';
import type { Shipment } from '../types/shipment';
import { parseCsvFile } from '../lib/csvParser';
import { saveShipments, loadShipments, clearShipments } from '../lib/storage';
import { fetchApi } from '../lib/api';

type DataSource = 'api' | 'csv' | 'none';

export function useShipments() {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [uploadedAt, setUploadedAt] = useState<Date | null>(null);
  const [filename, setFilename] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [dataSource, setDataSource] = useState<DataSource>('none');
  const [loading, setLoading] = useState(false);

  // On mount: try API first, then localStorage
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const res = await fetchApi<Shipment[]>('/shipments');
        if (res.data && res.data.length > 0) {
          // Convert date strings to Date objects
          const parsed = res.data.map((s) => ({
            ...s,
            createdDate: new Date(s.createdDate),
            lastUpdatedDate: new Date(s.lastUpdatedDate),
          }));
          setShipments(parsed);
          setUploadedAt(new Date(res.meta.cachedAt));
          setFilename(`Live from Amazon (${res.meta.source})`);
          setDataSource('api');
          setLoading(false);
          return;
        }
      } catch {
        // API not available, fall back
      }

      // Fallback: localStorage
      const stored = loadShipments();
      if (stored) {
        setShipments(stored.shipments);
        setUploadedAt(stored.meta.uploadedAt);
        setFilename(stored.meta.filename);
        setDataSource('csv');
      }
      setLoading(false);
    }
    loadData();
  }, []);

  const refreshFromApi = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchApi<Shipment[]>('/shipments');
      const parsed = res.data.map((s) => ({
        ...s,
        createdDate: new Date(s.createdDate),
        lastUpdatedDate: new Date(s.lastUpdatedDate),
      }));
      setShipments(parsed);
      setUploadedAt(new Date(res.meta.cachedAt));
      setFilename(`Live from Amazon (${res.meta.source})`);
      setDataSource('api');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch from API');
    } finally {
      setLoading(false);
    }
  }, []);

  const uploadCsv = useCallback(async (file: File) => {
    setError(null);
    setWarnings([]);
    try {
      const result = await parseCsvFile(file);
      setShipments(result.shipments);
      setWarnings(result.warnings);
      setFilename(file.name);
      setUploadedAt(new Date());
      setDataSource('csv');
      saveShipments(result.shipments, file.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse CSV.');
    }
  }, []);

  const clearData = useCallback(() => {
    setShipments([]);
    setUploadedAt(null);
    setFilename('');
    setError(null);
    setWarnings([]);
    setDataSource('none');
    clearShipments();
  }, []);

  return {
    shipments,
    uploadedAt,
    filename,
    error,
    warnings,
    uploadCsv,
    clearData,
    refreshFromApi,
    hasData: shipments.length > 0,
    dataSource,
    loading,
  };
}
