import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Hoist mock refs ───────────────────────────────────────────────────────────
const { mockCreate, mockFetchCAD, mockQueryScience } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  mockFetchCAD: vi.fn(),
  mockQueryScience: vi.fn(),
}));

// ── Mock external dependencies ────────────────────────────────────────────────

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: mockCreate },
  })),
}));

vi.mock('../../src/services/orchestrator/tools.js', () => ({
  FETCH_CLOSE_APPROACHES_TOOL: { name: 'fetch_close_approaches', description: 'mock', input_schema: { type: 'object', properties: {} } },
  QUERY_SCIENCE_INDEX_TOOL: { name: 'query_science_index', description: 'mock', input_schema: { type: 'object', properties: {} } },
  fetchCloseApproaches: mockFetchCAD,
  queryScienceIndex: mockQueryScience,
}));

import { runRiskAssessor } from '../../src/services/orchestrator/riskAssessor.js';
import type { RiskOutput } from '../../../../shared/types.js';
import type { AsteroidRow } from '../../src/services/asteroidService.js';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const mockAsteroid: AsteroidRow = {
  id: 'test-asteroid-uuid',
  nasa_id: '99942',
  spkid: '2099942',
  full_name: '(99942) Apophis',
  name: 'Apophis',
  designation: '99942 Apophis',
  is_pha: true,
  is_sentry_object: false,
  absolute_magnitude_h: 19.7,
  diameter_min_km: 0.31,
  diameter_max_km: 0.37,
  diameter_sigma_km: null,
  spectral_type_smass: 'Sq',
  spectral_type_tholen: null,
  orbit_epoch_jd: null,
  semi_major_axis_au: 0.9224,
  eccentricity: 0.191,
  inclination_deg: 3.33,
  longitude_asc_node_deg: null,
  argument_perihelion_deg: null,
  mean_anomaly_deg: null,
  perihelion_distance_au: null,
  aphelion_distance_au: null,
  orbital_period_yr: 0.886,
  min_orbit_intersection_au: 0.00021,
  nhats_accessible: true,
  nhats_min_delta_v_kms: 5.76,
  nhats_min_duration_days: 340,
  next_approach_date: '2029-04-13',
  next_approach_au: 0.0002539,
  next_approach_miss_km: 37980,
  closest_approach_date: '2029-04-13',
  closest_approach_au: 0.0002539,
  composition_summary: null,
  resource_profile: null,
  economic_tier: null,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

const riskFixture: RiskOutput = {
  planetaryDefense: {
    isPHA: true,
    hazardRating: 'low',
    monitoringStatus: 'Closely monitored by CNEOS; 2029 approach is well-characterized.',
    notableApproaches: [
      {
        id: 'ca-001',
        asteroid_id: 'test-asteroid-uuid',
        close_approach_date: '2029-04-13',
        miss_distance_km: 37980,
        relative_velocity_km_s: 7.43,
        orbiting_body: 'Earth',
      },
    ],
    mitigationContext: 'DART mission demonstrated kinetic impactor effectiveness.',
  },
  missionRisk: {
    overallRating: 'moderate',
    communicationDelayMinutes: { min: 1, max: 12 },
    surfaceConditions: 'Rubble pile; loose regolith, potential for ejecta during proximity ops.',
    primaryRisks: [
      { risk: 'Navigation accuracy near close approach', severity: 'high', mitigation: 'Autonomous nav required' },
    ],
  },
  dataCompleteness: 0.85,
  assumptionsRequired: [],
  reasoning: 'Apophis is a well-known PHA with a historically significant close approach in 2029.',
  sources: ['cneos-apophis'],
};

const scienceChunk = {
  id: 'sc-defense',
  source_id: 'cneos-apophis',
  source_title: 'Apophis Risk Assessment',
  source_url: null,
  source_year: 2021,
  source_type: 'science' as const,
  chunk_index: 0,
  content: 'Apophis 2029 approach passes within 37,980 km of Earth.',
  metadata: {},
  similarity: 0.88,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockCreate.mockReset();
  mockFetchCAD.mockReset();
  mockQueryScience.mockReset();

  process.env['ANTHROPIC_API_KEY'] = 'test-key';

  mockFetchCAD.mockResolvedValue({
    nextApproach: { date: '2029-04-13', missDistance_au: 0.0002539 },
    approaches: [],
  });
  mockQueryScience.mockResolvedValue({ result: [scienceChunk], rawChunks: [scienceChunk] });
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('runRiskAssessor', () => {
  it('returns RiskOutput when model submits directly', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'tool_use', id: 'call_1', name: 'submit_risk_analysis', input: riskFixture }],
      stop_reason: 'tool_use',
    });

    const { output } = await runRiskAssessor(mockAsteroid, {} as never, {});

    expect(output.dataCompleteness).toBe(0.85);
    expect(output.assumptionsRequired).toBeInstanceOf(Array);
    expect(output.sources).toBeInstanceOf(Array);
  });

  it('planetaryDefense.hazardRating is a valid enum value', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'tool_use', id: 'call_1', name: 'submit_risk_analysis', input: riskFixture }],
      stop_reason: 'tool_use',
    });

    const { output } = await runRiskAssessor(mockAsteroid, {} as never, {});

    expect(['none', 'negligible', 'low', 'moderate', 'elevated', 'high']).toContain(
      output.planetaryDefense.hazardRating,
    );
  });

  it('missionRisk.overallRating is a valid enum value', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'tool_use', id: 'call_1', name: 'submit_risk_analysis', input: riskFixture }],
      stop_reason: 'tool_use',
    });

    const { output } = await runRiskAssessor(mockAsteroid, {} as never, {});

    expect(['low', 'moderate', 'high', 'extreme']).toContain(output.missionRisk.overallRating);
  });

  it('notableApproaches are normalized to CloseApproach shape', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'tool_use', id: 'call_1', name: 'submit_risk_analysis', input: riskFixture }],
      stop_reason: 'tool_use',
    });

    const { output } = await runRiskAssessor(mockAsteroid, {} as never, {});

    for (const approach of output.planetaryDefense.notableApproaches) {
      expect(approach).toHaveProperty('id');
      expect(approach).toHaveProperty('asteroid_id');
      expect(approach).toHaveProperty('close_approach_date');
      expect(approach).toHaveProperty('miss_distance_km');
      expect(approach).toHaveProperty('relative_velocity_km_s');
      expect(approach).toHaveProperty('orbiting_body');
    }
  });

  it('handles 2-turn loop: data fetch then submit', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'tool_use', id: 'call_1', name: 'fetch_close_approaches', input: { designation: '99942 Apophis' } }],
      stop_reason: 'tool_use',
    });
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'tool_use', id: 'call_2', name: 'submit_risk_analysis', input: riskFixture }],
      stop_reason: 'tool_use',
    });

    const { output, trace } = await runRiskAssessor(mockAsteroid, {} as never, {});

    expect(mockCreate).toHaveBeenCalledTimes(2);
    expect(mockFetchCAD).toHaveBeenCalled();
    expect(output.planetaryDefense.hazardRating).toBe('low');
    const eventTypes = trace.events.map((e) => e.type);
    expect(eventTypes).toContain('tool_call');
    expect(eventTypes).toContain('output');
  });

  it('throws AIServiceError if model never submits', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'Evaluating risk...' }],
      stop_reason: 'end_turn',
    });

    await expect(runRiskAssessor(mockAsteroid, {} as never, {})).rejects.toThrow(
      'Risk Assessor agent did not call submit_risk_analysis within turn limit',
    );
  });

  it('handles query_science_index tool call then submit', async () => {
    mockQueryScience.mockResolvedValue({
      result: { chunks: [{ sourceId: 'cneos', sourceTitle: 'Apophis Assessment', sourceYear: 2021, content: 'test', similarity: 0.9 }] },
      rawChunks: [scienceChunk],
    });
    // Turn 1: model queries science index
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'tool_use', id: 'call_1', name: 'query_science_index', input: { query: 'Apophis impact probability' } }],
      stop_reason: 'tool_use',
    });
    // Turn 2: model submits
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'tool_use', id: 'call_2', name: 'submit_risk_analysis', input: riskFixture }],
      stop_reason: 'tool_use',
    });

    const { output, trace } = await runRiskAssessor(mockAsteroid, {} as never, {});

    expect(mockQueryScience).toHaveBeenCalledWith({ query: 'Apophis impact probability' });
    expect(output.planetaryDefense.hazardRating).toBe('low');
    const eventTypes = trace.events.map((e) => e.type);
    expect(eventTypes).toContain('rag_lookup');
  });

  it('handles an unknown tool call and continues the loop', async () => {
    // Turn 1: model calls an unknown tool → catch block captures error; loop continues
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'tool_use', id: 'call_1', name: 'bad_tool', input: {} }],
      stop_reason: 'tool_use',
    });
    // Turn 2: model submits
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'tool_use', id: 'call_2', name: 'submit_risk_analysis', input: riskFixture }],
      stop_reason: 'tool_use',
    });

    const { output } = await runRiskAssessor(mockAsteroid, {} as never, {});

    expect(output.dataCompleteness).toBe(0.85);
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });

  it('handles a tool that throws an error and continues the loop', async () => {
    mockFetchCAD.mockRejectedValue(new Error('JPL CAD API timeout'));

    // Turn 1: model calls fetch_close_approaches → tool throws; error result sent back
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'tool_use', id: 'call_1', name: 'fetch_close_approaches', input: { designation: '99942 Apophis' } }],
      stop_reason: 'tool_use',
    });
    // Turn 2: model submits despite the tool failure
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'tool_use', id: 'call_2', name: 'submit_risk_analysis', input: riskFixture }],
      stop_reason: 'tool_use',
    });

    const { output } = await runRiskAssessor(mockAsteroid, {} as never, {});

    expect(output.dataCompleteness).toBe(0.85);
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });
});
