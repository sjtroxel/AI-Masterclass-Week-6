import { ExternalAPIService } from './ExternalAPIService.js';
import type { CADResponse } from './types.js';

const BASE = 'https://ssd-api.jpl.nasa.gov/cad.api';

export interface CloseApproachRecord {
  date: string;       // ISO date string "YYYY-MM-DD"
  distanceAu: number;
  distanceKm: number;
}

// Summarized close approach data for one asteroid.
export interface CADSummary {
  designation: string;
  nextApproach: CloseApproachRecord | null;    // first future approach
  closestApproach: CloseApproachRecord | null; // smallest distance on record
}

export class CADService extends ExternalAPIService {
  // Returns next and closest close approach for a single asteroid.
  // date-min defaults to today; date-max covers 100 years forward.
  async getSummaryByDesignation(des: string): Promise<CADSummary> {
    const today = new Date().toISOString().slice(0, 10);
    const encoded = encodeURIComponent(des);
    const url =
      `${BASE}?des=${encoded}&date-min=${today}&date-max=%2B100&dist-max=0.5&fullname=true`;

    const raw = await this.get<CADResponse>(url);
    return this.parse(des, raw);
  }

  private parse(des: string, raw: CADResponse): CADSummary {
    if (raw.data.length === 0) {
      return { designation: des, nextApproach: null, closestApproach: null };
    }

    const distIdx = raw.fields.indexOf('dist');
    const dateIdx = raw.fields.indexOf('cd');

    const records: CloseApproachRecord[] = raw.data
      .map((row) => {
        const distAu = parseFloat(row[distIdx] ?? '0');
        const rawDate = row[dateIdx] ?? '';
        // CAD dates arrive as "YYYY-Mon-DD HH:MM" — normalize to ISO date
        const isoDate = this.normalizeDate(rawDate);
        return {
          date: isoDate,
          distanceAu: distAu,
          distanceKm: distAu * 1.496e8, // 1 AU in km
        };
      })
      .filter((r) => !isNaN(r.distanceAu));

    // Already ordered by date from the API; first record is the next approach
    const nextApproach = records[0] ?? null;

    // Closest by distance
    const closestApproach =
      records.reduce<CloseApproachRecord | null>((min, r) => {
        if (!min || r.distanceAu < min.distanceAu) return r;
        return min;
      }, null);

    return { designation: des, nextApproach, closestApproach };
  }

  // CAD returns "2029-Apr-13 21:46" — convert to "2029-04-13"
  private normalizeDate(raw: string): string {
    const monthMap: Record<string, string> = {
      Jan: '01', Feb: '02', Mar: '03', Apr: '04',
      May: '05', Jun: '06', Jul: '07', Aug: '08',
      Sep: '09', Oct: '10', Nov: '11', Dec: '12',
    };
    const match = raw.match(/^(\d{4})-([A-Za-z]{3})-(\d{2})/);
    if (!match) return raw.slice(0, 10); // fallback: take first 10 chars as-is
    const year = match[1];
    const mon  = match[2];
    const day  = match[3];
    if (!year || !mon || !day) return raw.slice(0, 10);
    const monthNum = monthMap[mon] ?? '01';
    return `${year}-${monthNum}-${day}`;
  }
}
