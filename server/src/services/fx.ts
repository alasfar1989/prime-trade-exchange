import axios from 'axios';
import { cacheGet, cacheSet } from '../cache/memoryCache.js';

// The Finances API returns events for every marketplace on the North America
// account in that marketplace's own currency — an Amazon.com.mx sale arrives
// in MXN. Summing those as if they were dollars overstated Mexican revenue
// ~18x, so every amount is converted to USD before it is aggregated.
//
// Rates are the ECB daily reference rates via frankfurter.dev (free, no key).
// Amazon converts at its own rate when it pays out, so a converted figure can
// differ from the deposit by a percent or two — close enough for profit, and
// far better than the 1,700% error of not converting at all.

const FX_URL = 'https://api.frankfurter.dev/v1';
const FX_TTL = 12 * 60 * 60 * 1000;

/** USD per 1 unit of currency, keyed by YYYY-MM-DD. */
export interface RateTable {
  currency: string;
  days: string[]; // sorted ascending
  usdPer: Map<string, number>;
}

/**
 * Rates for each currency over [from, to]. The window is padded back a week
 * so a weekend or holiday posting still finds the last published rate.
 * Throws if a rate can't be fetched: a missing rate must fail the pull rather
 * than fall back to 1:1, which is exactly the bug this exists to prevent.
 */
export async function loadRates(currencies: string[], from: Date, to: Date): Promise<Map<string, RateTable>> {
  const out = new Map<string, RateTable>();
  const wanted = [...new Set(currencies)].filter((c) => c !== 'USD').sort();
  if (wanted.length === 0) return out;

  // UTC days, to match the UTC PostedDate each amount is priced by.
  const start = new Date(from.getTime() - 7 * 86400_000).toISOString().slice(0, 10);
  const end = to.toISOString().slice(0, 10);
  const key = `fx:${wanted.join(',')}:${start}:${end}`;
  let rates = cacheGet<Record<string, Record<string, number>>>(key)?.data;
  if (!rates) {
    const res = await axios.get(`${FX_URL}/${start}..${end}`, {
      params: { base: 'USD', symbols: wanted.join(',') },
      timeout: 15_000,
    });
    rates = (res.data?.rates || {}) as Record<string, Record<string, number>>;
    cacheSet(key, rates, FX_TTL);
  }

  for (const cur of wanted) {
    const usdPer = new Map<string, number>();
    for (const [day, r] of Object.entries(rates)) {
      // The API quotes units of `cur` per USD; invert to USD per unit.
      if (r[cur]) usdPer.set(day, 1 / r[cur]);
    }
    if (usdPer.size) out.set(cur, { currency: cur, days: [...usdPer.keys()].sort(), usdPer });
  }
  return out;
}

/** USD per unit of the table's currency on `day`, using the last rate on or before it. */
export function rateOn(table: RateTable, day: string): number {
  let lo = 0;
  let hi = table.days.length - 1;
  let pick = table.days[0]; // a day before the padded window: use the earliest rate
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (table.days[mid] <= day) {
      pick = table.days[mid];
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return table.usdPer.get(pick)!;
}
