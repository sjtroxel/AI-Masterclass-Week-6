import { ExternalAPIService } from './ExternalAPIService.js';
import type { NHATSResponse, NHATSSingleResponse } from './types.js';

const BASE = 'https://ssd-api.jpl.nasa.gov/nhats.api';

// Parsed accessibility data for one NHATS target.
export interface NHATSAccessibility {
  designation: string;
  minDeltaVKms: number;
  minDurationDays: number;
}

export class NHATSService extends ExternalAPIService {
  // Full list of human-accessible NEO targets.
  async listAll(): Promise<NHATSAccessibility[]> {
    const raw = await this.get<NHATSResponse>(BASE);
    return raw.data.map((obj) => ({
      designation: obj.des,
      minDeltaVKms: parseFloat(obj.min_dv.dv),
      minDurationDays: obj.min_dv.dur,
    }));
  }

  // Accessibility data for a single asteroid by designation.
  // Returns null if the asteroid is not in the NHATS database.
  // NOTE: The per-asteroid endpoint returns the object directly (no { count, data } wrapper).
  async getByDesignation(des: string): Promise<NHATSAccessibility | null> {
    const encoded = encodeURIComponent(des);
    const url = `${BASE}?des=${encoded}`;
    const raw = await this.get<NHATSSingleResponse>(url);

    // Response has no `des` when the asteroid is not found — instead JPL returns
    // an error-like structure. Treat missing `des` or `min_dv` as not found.
    if (!raw.des || !raw.min_dv) return null;

    return {
      designation: raw.des,
      minDeltaVKms: parseFloat(raw.min_dv.dv),
      minDurationDays: raw.min_dv.dur,
    };
  }
}
