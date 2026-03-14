import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NeoWsService } from '../../src/services/nasaApi/NeoWsService.js';
import { SBDBService } from '../../src/services/nasaApi/SBDBService.js';
import { NHATSService } from '../../src/services/nasaApi/NHATSService.js';
import { CADService } from '../../src/services/nasaApi/CADService.js';
import browsePage from '../fixtures/nasa/neows-browse-page.json' assert { type: 'json' };

// ── helpers ───────────────────────────────────────────────────────────────────

function mockFetchOk(body: unknown): void {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(body),
      headers: { get: () => null },
    }),
  );
}

function mockFetchStatus(status: number, retries = 0): void {
  let calls = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation(() => {
      calls++;
      if (calls <= retries) {
        return Promise.resolve({
          ok: false,
          status,
          statusText: 'Error',
          headers: { get: () => null },
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ count: '0', data: [], fields: [] }),
        headers: { get: () => null },
      });
    }),
  );
}

// ── NeoWsService ──────────────────────────────────────────────────────────────

describe('NeoWsService', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('browse() returns a parsed page', async () => {
    mockFetchOk(browsePage);
    const svc = new NeoWsService('TEST_KEY');
    const result = await svc.browse(0);
    expect(result.page.total_elements).toBe(4);
    expect(result.near_earth_objects).toHaveLength(2);
    expect(result.near_earth_objects[0]?.name_limited).toBe('Eros');
  });

  it('getById() returns a single NEO with orbital data', async () => {
    const neo = browsePage.near_earth_objects[0];
    mockFetchOk(neo);
    const svc = new NeoWsService('TEST_KEY');
    const result = await svc.getById('2000433');
    expect(result.id).toBe('2000433');
    expect(result.orbital_data?.semi_major_axis).toBe('1.45799');
  });

  it('retries on 429 and eventually succeeds', async () => {
    mockFetchStatus(429, 1); // fail once, then succeed
    const svc = new NeoWsService('TEST_KEY');

    const promise = svc.browse(0);
    // Advance timers to skip retry delay
    await vi.runAllTimersAsync();
    const result = await promise;
    expect(result).toBeDefined();
  });

  it('throws ExternalAPIError on non-retryable 4xx', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        headers: { get: () => null },
      }),
    );
    const svc = new NeoWsService('BAD_KEY');
    await expect(svc.browse(0)).rejects.toThrow('HTTP 403');
  });
});

// ── SBDBService ───────────────────────────────────────────────────────────────

describe('SBDBService', () => {
  beforeEach(() => vi.resetAllMocks());
  afterEach(() => vi.unstubAllGlobals());

  const sbdbResponse = {
    object: { spkid: '2000433', fullname: '433 Eros (1898 DQ)', des: '433', neo: true, pha: false },
    phys_par: [
      { name: 'diameter', value: '16.84', sigma: '1.24', units: 'km' },
      { name: 'spec_T', value: 'S' },
      { name: 'spec_B', value: 'S' },
    ],
    orbit: { moid: '0.148' },
  };

  it('parses spectral types, diameter, sigma, and MOID', async () => {
    mockFetchOk(sbdbResponse);
    const svc = new SBDBService();
    const result = await svc.getByDesignation('433');
    expect(result.spectralTypeSmass).toBe('S');
    expect(result.spectralTypeTholen).toBe('S');
    expect(result.diameterKm).toBeCloseTo(16.84);
    expect(result.diameterSigmaKm).toBeCloseTo(1.24);
    expect(result.moidAu).toBeCloseTo(0.148);
  });

  it('returns null fields when phys_par entries are absent', async () => {
    mockFetchOk({ ...sbdbResponse, phys_par: [], orbit: undefined });
    const svc = new SBDBService();
    const result = await svc.getByDesignation('433');
    expect(result.spectralTypeSmass).toBeNull();
    expect(result.diameterKm).toBeNull();
    expect(result.moidAu).toBeNull();
  });
});

// ── NHATSService ──────────────────────────────────────────────────────────────

describe('NHATSService', () => {
  beforeEach(() => vi.resetAllMocks());
  afterEach(() => vi.unstubAllGlobals());

  const nhatsResponse = {
    count: '2',
    data: [
      { des: '433', min_dv: '5.31', min_dur: '370' },
      { des: '101955', min_dv: '4.98', min_dur: '460' },
    ],
  };

  it('listAll() returns parsed accessibility data', async () => {
    mockFetchOk(nhatsResponse);
    const svc = new NHATSService();
    const results = await svc.listAll();
    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({ designation: '433', minDeltaVKms: 5.31, minDurationDays: 370 });
  });

  it('getByDesignation() returns null when asteroid not in NHATS', async () => {
    mockFetchOk({ count: '0', data: [] });
    const svc = new NHATSService();
    const result = await svc.getByDesignation('99999');
    expect(result).toBeNull();
  });
});

// ── CADService ────────────────────────────────────────────────────────────────

describe('CADService', () => {
  beforeEach(() => vi.resetAllMocks());
  afterEach(() => vi.unstubAllGlobals());

  const cadResponse = {
    count: '2',
    fields: ['des', 'cd', 'dist', 'dist_min', 'dist_max', 'v_rel', 'h'],
    data: [
      ['433', '2040-Mar-15 12:00', '0.350', '0.349', '0.351', '5.5', '10.3'],
      ['433', '2056-Jan-14 08:22', '0.175', '0.174', '0.176', '6.4', '10.3'],
    ],
  };

  it('identifies next approach and closest approach correctly', async () => {
    mockFetchOk(cadResponse);
    const svc = new CADService();
    const result = await svc.getSummaryByDesignation('433');
    // First entry is next (ordered by date); second is closest (smaller AU)
    expect(result.nextApproach?.date).toBe('2040-03-15');
    expect(result.closestApproach?.distanceAu).toBeCloseTo(0.175);
  });

  it('returns nulls when no close approach data', async () => {
    mockFetchOk({ count: '0', fields: ['des', 'cd', 'dist'], data: [] });
    const svc = new CADService();
    const result = await svc.getSummaryByDesignation('99999');
    expect(result.nextApproach).toBeNull();
    expect(result.closestApproach).toBeNull();
  });

  it('normalizes CAD date format to ISO date', async () => {
    mockFetchOk({
      count: '1',
      fields: ['des', 'cd', 'dist'],
      data: [['433', '2029-Apr-13 21:46', '0.0003']],
    });
    const svc = new CADService();
    const result = await svc.getSummaryByDesignation('433');
    expect(result.nextApproach?.date).toBe('2029-04-13');
  });
});
