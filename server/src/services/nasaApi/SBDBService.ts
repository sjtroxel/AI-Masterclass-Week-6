import { ExternalAPIService } from './ExternalAPIService.js';
import type { SBDBResponse, SBDBPhysParam } from './types.js';

const BASE = 'https://ssd-api.jpl.nasa.gov/sbdb.api';

// Parsed physical parameters extracted from the SBDB phys_par array.
export interface SBDBPhysicalData {
  spkid: string;
  fullName: string;
  spectralTypeSmass: string | null;  // spec_T field (SMASS taxonomy)
  spectralTypeTholen: string | null; // spec_B field (Tholen taxonomy)
  diameterKm: number | null;
  diameterSigmaKm: number | null;
  moidAu: number | null;
}

export class SBDBService extends ExternalAPIService {
  // Fetch physical + orbital summary for one asteroid.
  // `des` is the IAU designation or SPK-ID (e.g. "433", "2000433", "1998 QE2").
  async getByDesignation(des: string): Promise<SBDBPhysicalData> {
    const encoded = encodeURIComponent(des);
    const url = `${BASE}?sstr=${encoded}&phys-par=true`;
    const raw = await this.get<SBDBResponse>(url);
    return this.parse(raw);
  }

  private parse(raw: SBDBResponse): SBDBPhysicalData {
    const find = (name: string): SBDBPhysParam | undefined =>
      raw.phys_par?.find((p) => p.name === name);

    const diameterEntry = find('diameter');
    const diameterKm = diameterEntry ? parseFloat(diameterEntry.value) : null;
    const diameterSigmaKm =
      diameterEntry?.sigma ? parseFloat(diameterEntry.sigma) : null;

    return {
      spkid: raw.object.spkid,
      fullName: raw.object.fullname,
      // SBDB uses spec_T for SMASS, spec_B for Tholen (counterintuitive naming)
      spectralTypeSmass: find('spec_T')?.value ?? null,
      spectralTypeTholen: find('spec_B')?.value ?? null,
      diameterKm: isNaN(diameterKm ?? NaN) ? null : diameterKm,
      diameterSigmaKm: isNaN(diameterSigmaKm ?? NaN) ? null : diameterSigmaKm,
      moidAu: raw.orbit?.moid ? parseFloat(raw.orbit.moid) : null,
    };
  }
}
