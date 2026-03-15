import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Hoist mock refs ───────────────────────────────────────────────────────────
const { mockCreate, mockQueryScience } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  mockQueryScience: vi.fn(),
}));

// ── Mock external dependencies ────────────────────────────────────────────────

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: mockCreate },
  })),
}));

vi.mock('../../src/services/orchestrator/tools.js', () => ({
  QUERY_SCIENCE_INDEX_TOOL: { name: 'query_science_index', description: 'mock', input_schema: { type: 'object', properties: {} } },
  queryScienceIndex: mockQueryScience,
}));

import { runGeologist } from '../../src/services/orchestrator/geologist.js';
import type { GeologistOutput } from '../../../../shared/types.js';
import type { AsteroidRow } from '../../src/services/asteroidService.js';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const mockAsteroid: AsteroidRow = {
  id: 'test-asteroid-uuid',
  nasa_id: '101955',
  spkid: '2101955',
  full_name: '(101955) Bennu',
  name: 'Bennu',
  designation: null,
  is_pha: true,
  is_sentry_object: false,
  absolute_magnitude_h: 20.9,
  diameter_min_km: 0.46,
  diameter_max_km: 0.51,
  diameter_sigma_km: null,
  spectral_type_smass: 'B',
  spectral_type_tholen: null,
  orbit_epoch_jd: null,
  semi_major_axis_au: 1.126,
  eccentricity: 0.204,
  inclination_deg: 6.04,
  longitude_asc_node_deg: null,
  argument_perihelion_deg: null,
  mean_anomaly_deg: null,
  perihelion_distance_au: null,
  aphelion_distance_au: null,
  orbital_period_yr: 1.196,
  min_orbit_intersection_au: 0.00321,
  nhats_accessible: true,
  nhats_min_delta_v_kms: 4.97,
  nhats_min_duration_days: 460,
  next_approach_date: '2060-09-23',
  next_approach_au: 0.005,
  next_approach_miss_km: 747000,
  closest_approach_date: '2135-09-22',
  closest_approach_au: 0.00001,
  composition_summary: null,
  resource_profile: null,
  economic_tier: null,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

const scienceChunk = {
  id: 'sc-001',
  source_id: 'osiris-rex-bennu',
  source_title: 'OSIRIS-REx Bennu Sample Mineralogy',
  source_url: 'https://example.com',
  source_year: 2024,
  source_type: 'science' as const,
  chunk_index: 0,
  content: 'Bennu samples contain serpentine, carbonate, and magnetite.',
  metadata: {},
  similarity: 0.92,
};

const geoFixture: GeologistOutput = {
  spectralClass: 'B',
  compositionEstimate: {
    water_ice_pct: { min: 5, max: 25 },
    carbonaceous_pct: { min: 30, max: 60 },
    silicate_pct: { min: 20, max: 40 },
    iron_nickel_pct: { min: 5, max: 15 },
    platinum_group_pct: { min: 0, max: 0.5 },
    other_pct: { min: 0, max: 10 },
  },
  keyResources: [
    { resource: 'Water ice', significance: 'Propellant feedstock for in-space use' },
    { resource: 'Carbonaceous material', significance: 'Organic compounds, research value' },
  ],
  compositionConfidence: 'well_characterized',
  analogAsteroids: ['Ryugu'],
  dataCompleteness: 0.9,
  assumptionsRequired: [],
  reasoning: 'Bennu is a well-characterized B-type asteroid with known composition from OSIRIS-REx sample return.',
  sources: ['osiris-rex-bennu'],
};

beforeEach(() => {
  vi.clearAllMocks();
  mockCreate.mockReset();
  mockQueryScience.mockReset();

  process.env['ANTHROPIC_API_KEY'] = 'test-key';

  mockQueryScience.mockResolvedValue({ result: [scienceChunk], rawChunks: [scienceChunk] });
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('runGeologist', () => {
  it('returns GeologistOutput when model submits directly', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'tool_use', id: 'call_1', name: 'submit_geologist_analysis', input: geoFixture }],
      stop_reason: 'tool_use',
    });

    const { output } = await runGeologist(mockAsteroid, {} as never, {});

    expect(output.spectralClass).toBe('B');
    expect(output.dataCompleteness).toBe(0.9);
    expect(output.assumptionsRequired).toBeInstanceOf(Array);
    expect(output.sources).toBeInstanceOf(Array);
  });

  it('compositionEstimate has all 6 sub-fields each with min and max', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'tool_use', id: 'call_1', name: 'submit_geologist_analysis', input: geoFixture }],
      stop_reason: 'tool_use',
    });

    const { output } = await runGeologist(mockAsteroid, {} as never, {});
    const comp = output.compositionEstimate;

    for (const key of [
      'water_ice_pct', 'carbonaceous_pct', 'silicate_pct',
      'iron_nickel_pct', 'platinum_group_pct', 'other_pct',
    ] as const) {
      expect(comp[key]).toHaveProperty('min');
      expect(comp[key]).toHaveProperty('max');
      expect(typeof comp[key].min).toBe('number');
      expect(typeof comp[key].max).toBe('number');
    }
  });

  it('compositionConfidence is a valid enum value', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'tool_use', id: 'call_1', name: 'submit_geologist_analysis', input: geoFixture }],
      stop_reason: 'tool_use',
    });

    const { output } = await runGeologist(mockAsteroid, {} as never, {});

    expect(['well_characterized', 'estimated', 'uncertain', 'unknown']).toContain(
      output.compositionConfidence,
    );
  });

  it('handles 2-turn loop: RAG lookup then submit', async () => {
    // Turn 1: model calls query_science_index
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'tool_use', id: 'call_1', name: 'query_science_index', input: { query: 'B-type asteroid composition' } }],
      stop_reason: 'tool_use',
    });
    // Turn 2: model submits
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'tool_use', id: 'call_2', name: 'submit_geologist_analysis', input: geoFixture }],
      stop_reason: 'tool_use',
    });

    const { output, trace } = await runGeologist(mockAsteroid, {} as never, {});

    expect(mockCreate).toHaveBeenCalledTimes(2);
    expect(mockQueryScience).toHaveBeenCalledWith({ query: 'B-type asteroid composition' });
    expect(output.spectralClass).toBe('B');

    const eventTypes = trace.events.map((e) => e.type);
    expect(eventTypes).toContain('rag_lookup');
    expect(eventTypes).toContain('output');
  });

  it('trace contains rag_lookup event when science index is queried', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'tool_use', id: 'call_1', name: 'query_science_index', input: { query: 'Bennu composition' } }],
      stop_reason: 'tool_use',
    });
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'tool_use', id: 'call_2', name: 'submit_geologist_analysis', input: geoFixture }],
      stop_reason: 'tool_use',
    });

    const { trace } = await runGeologist(mockAsteroid, {} as never, {});

    const ragEvent = trace.events.find((e) => e.type === 'rag_lookup');
    expect(ragEvent).toBeDefined();
  });

  it('throws AIServiceError if model never submits', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'Still thinking...' }],
      stop_reason: 'end_turn',
    });

    await expect(runGeologist(mockAsteroid, {} as never, {})).rejects.toThrow(
      'Geologist agent did not call submit_geologist_analysis within turn limit',
    );
  });
});
