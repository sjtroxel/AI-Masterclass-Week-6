import { ExternalAPIService } from './ExternalAPIService.js';
import type { NeoWsBrowseResponse, NeoWsObject } from './types.js';

const BASE = 'https://api.nasa.gov/neo/rest/v1';

export class NeoWsService extends ExternalAPIService {
  private readonly apiKey: string;

  constructor(apiKey: string) {
    super();
    this.apiKey = apiKey;
  }

  // Paginated NEO catalog. Page is 0-indexed; max page size is 20 (NASA limit).
  async browse(page: number, size = 20): Promise<NeoWsBrowseResponse> {
    const url = `${BASE}/neo/browse?api_key=${this.apiKey}&page=${page}&size=${size}`;
    return this.get<NeoWsBrowseResponse>(url);
  }

  // Single NEO by NASA integer ID (e.g. "3542519").
  // Returns orbital_data and estimated_diameter alongside the core fields.
  async getById(nasaId: string): Promise<NeoWsObject> {
    const url = `${BASE}/neo/${nasaId}?api_key=${this.apiKey}`;
    return this.get<NeoWsObject>(url);
  }
}
