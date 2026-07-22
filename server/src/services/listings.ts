import axios from 'axios';
import zlib from 'node:zlib';
import { spApiGet, spApiPost } from './spApiClient.js';
import { env } from '../config/env.js';

// Pull the authoritative FBA listing catalog (the "65 SKUs") from the Merchant
// Listings report. getInventorySummaries (the ledger) returns stale/merged
// records too, so we intersect against this set to show only real FBA SKUs.
//
// GET_MERCHANT_LISTINGS_ALL_DATA = all listings (active + inactive). We keep
// rows whose fulfillment-channel starts with AMAZON (FBA); DEFAULT = FBM.

const REPORT_TYPE = 'GET_MERCHANT_LISTINGS_ALL_DATA';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface CreateReportResponse { reportId: string }
interface GetReportResponse {
  processingStatus: 'IN_QUEUE' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED' | 'FATAL';
  reportDocumentId?: string;
}
interface GetDocumentResponse { url: string; compressionAlgorithm?: 'GZIP' }

async function createReport(): Promise<string> {
  const res = await spApiPost<CreateReportResponse>('/reports/2021-06-30/reports', {
    reportType: REPORT_TYPE,
    marketplaceIds: [env.SP_API.MARKETPLACE_ID],
  });
  return res.reportId;
}

async function waitForDocument(reportId: string): Promise<string> {
  // Report generation is typically ~10-20s. Poll getReport (2 req/s limit).
  for (let i = 0; i < 40; i++) {
    await sleep(4000);
    const res = await spApiGet<GetReportResponse>(
      `/reports/2021-06-30/reports/${reportId}`,
      undefined,
      false
    );
    if (res.processingStatus === 'DONE' && res.reportDocumentId) return res.reportDocumentId;
    if (res.processingStatus === 'CANCELLED' || res.processingStatus === 'FATAL') {
      throw new Error(`Listings report ${res.processingStatus}`);
    }
  }
  throw new Error('Listings report timed out');
}

async function downloadDocument(documentId: string): Promise<string> {
  const doc = await spApiGet<GetDocumentResponse>(
    `/reports/2021-06-30/documents/${documentId}`,
    undefined,
    false
  );
  const res = await axios.get<ArrayBuffer>(doc.url, { responseType: 'arraybuffer' });
  const buf = Buffer.from(res.data);
  return doc.compressionAlgorithm === 'GZIP' ? zlib.gunzipSync(buf).toString('utf-8') : buf.toString('utf-8');
}

/**
 * Returns the set of seller SKUs that are FBA listings (active + inactive).
 * Returns null on any failure so callers can degrade gracefully rather than
 * blank out the inventory view.
 */
export async function fetchFbaSkuSet(): Promise<Set<string> | null> {
  try {
    const reportId = await createReport();
    const documentId = await waitForDocument(reportId);
    const tsv = await downloadDocument(documentId);

    const lines = tsv.split('\n').filter((l) => l.trim());
    if (!lines.length) return null;
    const header = lines[0].split('\t');
    const iSku = header.indexOf('seller-sku');
    const iFc = header.indexOf('fulfillment-channel');
    if (iSku === -1 || iFc === -1) return null;

    const fba = new Set<string>();
    for (const line of lines.slice(1)) {
      const cols = line.split('\t');
      const fc = (cols[iFc] || '').trim().toUpperCase();
      if (fc.startsWith('AMAZON')) {
        const sku = (cols[iSku] || '').trim();
        if (sku) fba.add(sku);
      }
    }
    return fba.size ? fba : null;
  } catch (err: any) {
    console.error('fetchFbaSkuSet failed:', err?.response?.status || '', err?.message || err);
    return null;
  }
}
