import { useState, useEffect, useCallback } from 'react';
import type { Shipment } from '../types/shipment';
import { parseCsvFile } from '../lib/csvParser';
import { saveShipments, loadShipments, clearShipments } from '../lib/storage';

export function useShipments() {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [uploadedAt, setUploadedAt] = useState<Date | null>(null);
  const [filename, setFilename] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  useEffect(() => {
    const stored = loadShipments();
    if (stored) {
      setShipments(stored.shipments);
      setUploadedAt(stored.meta.uploadedAt);
      setFilename(stored.meta.filename);
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
    hasData: shipments.length > 0,
  };
}
