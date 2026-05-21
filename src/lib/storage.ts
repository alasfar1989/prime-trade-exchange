import type { Shipment, StoredData, SerializedShipment } from '../types/shipment';

const STORAGE_KEY = 'pte-fba-tracker-data';
const STORAGE_VERSION = 1;

function serialize(s: Shipment): SerializedShipment {
  return {
    ...s,
    createdDate: s.createdDate.toISOString(),
    lastUpdatedDate: s.lastUpdatedDate.toISOString(),
  };
}

function deserialize(s: SerializedShipment): Shipment {
  return {
    ...s,
    createdDate: new Date(s.createdDate),
    lastUpdatedDate: new Date(s.lastUpdatedDate),
  };
}

export function saveShipments(shipments: Shipment[], filename: string): void {
  const data: StoredData = {
    version: STORAGE_VERSION,
    shipments: shipments.map(serialize),
    lastUploadedAt: new Date().toISOString(),
    lastUploadedFilename: filename,
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    throw new Error('Failed to save data. Your browser storage may be full.');
  }
}

export function loadShipments(): {
  shipments: Shipment[];
  meta: { uploadedAt: Date; filename: string };
} | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const data: StoredData = JSON.parse(raw);
    if (data.version !== STORAGE_VERSION) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return {
      shipments: data.shipments.map(deserialize),
      meta: {
        uploadedAt: new Date(data.lastUploadedAt),
        filename: data.lastUploadedFilename,
      },
    };
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function clearShipments(): void {
  localStorage.removeItem(STORAGE_KEY);
}
