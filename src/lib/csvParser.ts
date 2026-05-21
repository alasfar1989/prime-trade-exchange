import Papa from 'papaparse';
import { parse as parseDate, isValid } from 'date-fns';
import type { Shipment, ParseResult } from '../types/shipment';
import { COLUMN_ALIASES, REQUIRED_COLUMNS } from '../constants/columnMap';

const DATE_FORMATS = [
  'MM/dd/yyyy',
  'M/d/yyyy',
  'yyyy-MM-dd',
  'dd/MM/yyyy',
  'M/d/yyyy h:mm:ss a',
  'MM/dd/yyyy h:mm:ss a',
  'MM/dd/yyyy HH:mm:ss',
  'yyyy-MM-dd HH:mm:ss',
];

function normalize(header: string): string {
  return header.toLowerCase().trim().replace(/\s+/g, ' ');
}

function buildColumnMapping(rawHeaders: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  const normalizedHeaders = rawHeaders.map(normalize);

  for (const [canonical, aliases] of Object.entries(COLUMN_ALIASES)) {
    for (const alias of aliases) {
      const idx = normalizedHeaders.indexOf(alias);
      if (idx !== -1) {
        mapping[canonical] = rawHeaders[idx];
        break;
      }
    }
  }

  return mapping;
}

function tryParseDate(value: string): Date {
  if (!value) return new Date();
  for (const fmt of DATE_FORMATS) {
    const d = parseDate(value.trim(), fmt, new Date());
    if (isValid(d)) return d;
  }
  const fallback = new Date(value);
  return isValid(fallback) ? fallback : new Date();
}

function tryParseNumber(value: string): number {
  if (!value) return 0;
  const cleaned = value.replace(/[,$\s]/g, '');
  const num = Number(cleaned);
  return isNaN(num) ? 0 : num;
}

function normalizeStatus(raw: string): string {
  return raw.trim().toUpperCase().replace(/[\s_-]+/g, '_');
}

export function parseCsvFile(file: File): Promise<ParseResult> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false,
      complete(results) {
        const headers = results.meta.fields;
        if (!headers || headers.length === 0) {
          reject(new Error('CSV file appears to be empty or has no headers.'));
          return;
        }

        const mapping = buildColumnMapping(headers);

        const missing = REQUIRED_COLUMNS.filter((col) => !mapping[col]);
        if (missing.length > 0) {
          reject(
            new Error(
              `Missing required columns: ${missing.join(', ')}. Found columns: ${headers.join(', ')}`
            )
          );
          return;
        }

        const warnings: string[] = [];
        const shipments: Shipment[] = [];

        for (let i = 0; i < results.data.length; i++) {
          const row = results.data[i] as Record<string, string>;
          try {
            const get = (field: string) => row[mapping[field]] ?? '';
            const shipment: Shipment = {
              shipmentName: get('shipmentName'),
              shipmentId: get('shipmentId'),
              referenceId: get('referenceId'),
              createdDate: tryParseDate(get('createdDate')),
              lastUpdatedDate: tryParseDate(get('lastUpdatedDate')),
              shipTo: get('shipTo'),
              skus: tryParseNumber(get('skus')),
              expectedUnits: tryParseNumber(get('expectedUnits')),
              locatedUnits: tryParseNumber(get('locatedUnits')),
              primeEligibleUnits: tryParseNumber(get('primeEligibleUnits')),
              status: normalizeStatus(get('status')),
            };

            if (!shipment.shipmentId) {
              warnings.push(`Row ${i + 2}: Missing shipment ID, skipped.`);
              continue;
            }

            shipments.push(shipment);
          } catch {
            warnings.push(`Row ${i + 2}: Failed to parse, skipped.`);
          }
        }

        resolve({ shipments, warnings });
      },
      error(err) {
        reject(new Error(`CSV parsing failed: ${err.message}`));
      },
    });
  });
}
