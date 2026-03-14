import { ExternalAPIService } from './ExternalAPIService.js';
import type { NHATSResponse, NHATSObject } from './types.js';

const BASE = 'https://ssd-api.jpl.nasa.gov/nhats.api';

// Parsed accessibility data for one NHATS target.
export interface NHATSAccessibility {
  designation: string;
  minDeltaVKms: number;
  minDurationDays: number;
}

export class NHATSService extends ExternalAPIService {
  // Full list of human-accessible NEO targets.
  // Typically ~1,000 objects meeting the delta-V and duration criteria.
  async listAll(): Promise<NHATSAccessibility[]> {
    const raw = await this.get<NHATSResponse>(BASE);
    return raw.data.map(this.parse);
  }

  // Accessibility data for a single asteroid by designation.
  // Returns null if the asteroid is not in the NHATS database.
  async getByDesignation(des: string): Promise<NHATSAccessibility | null> {
    const encoded = encodeURIComponent(des);
    const url = `${BASE}?des=${encoded}`;
    const raw = await this.get<NHATSResponse>(url);
    const first = raw.data[0];
    return first ? this.parse(first) : null;
  }

  private parse(obj: NHATSObject): NHATSAccessibility {
    return {
      designation: obj.des,
      minDeltaVKms: parseFloat(obj.min_dv),
      minDurationDays: parseFloat(obj.min_dur),
    };
  }
}
