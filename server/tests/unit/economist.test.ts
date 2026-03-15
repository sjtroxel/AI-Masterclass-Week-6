import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Hoist mock refs ───────────────────────────────────────────────────────────
const { mockCreate, mockQueryScenario, mockQueryScience } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  mockQueryScenario: vi.fn(),
  mockQueryScience: vi.fn(),
}));

// ── Mock external dependencies ────────────────────────────────────────────────

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: mockCreate },
  })),
}));

vi.mock('../../src/services/orchestrator/tools.js', () => ({
  QUERY_SCENARIO_INDEX_TOOL: { name: 'query_scenario_index', description: 'mock', input_schema: { type: 'object', properties: {} } },
  QUERY_SCIENCE_INDEX_TOOL: { name: 'query_science_index', description: 'mock', input_schema: { type: 'object', properties: {} } },
  queryScenarioIndex: mockQueryScenario,
  queryScienceIndex: mockQueryScience,
}));

import { runEconomist } from '../../src/services/orchestrator/economist.js';
import type { EconomistOutput, GeologistOutput, NavigatorOutput, SwarmState } from '../../../../shared/types.js';
import type { AsteroidRow } from '../../src/services/asteroidService.js';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const mockAsteroid: AsteroidRow = {
  id: 'test-asteroid-uuid',
  nasa_id: '3554143',
  spkid: null,
  full_name: '(3554143) 2019 AQ3',
  name: null,
  designation: '2019 AQ3',
  is_pha: false,
  is_sentry_object: false,
  absolute_magnitude_h: 21.0,
  diameter_min_km: 0.15,
  diameter_max_km: 0.35,
  diameter_sigma_km: null,
  spectral_type_smass: 'M',
  spectral_type_tholen: null,
  orbit_epoch_jd: null,
  semi_major_axis_au: 1.08,
  eccentricity: 0.32,
  inclination_deg: 3.5,
  longitude_asc_node_deg: null,
  argument_perihelion_deg: null,
  mean_anomaly_deg: null,
  perihelion_distance_au: null,
  aphelion_distance_au: null,
  orbital_period_yr: 1.12,
  min_orbit_intersection_au: 0.015,
  nhats_accessible: true,
  nhats_min_delta_v_kms: 4.5,
  nhats_min_duration_days: 200,
  next_approach_date: '2028-06-10',
  next_approach_au: 0.035,
  next_approach_miss_km: 5234000,
  closest_approach_date: '2028-06-10',
  closest_approach_au: 0.035,
  composition_summary: null,
  resource_profile: null,
  economic_tier: null,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

const geologistOutput: GeologistOutput = {
  spectralClass: 'M',
  compositionEstimate: {
    water_ice_pct: { min: 0, max: 2 },
    carbonaceous_pct: { min: 0, max: 5 },
    silicate_pct: { min: 10, max: 30 },
    iron_nickel_pct: { min: 50, max: 80 },
    platinum_group_pct: { min: 0.01, max: 0.5 },
    other_pct: { min: 0, max: 10 },
  },
  keyResources: [
    { resource: 'Iron-nickel', significance: 'High-value structural metal for orbital construction' },
    { resource: 'Platinum-group metals', significance: 'Trace but high terrestrial export value' },
  ],
  compositionConfidence: 'estimated',
  analogAsteroids: ['Psyche'],
  dataCompleteness: 0.65,
  assumptionsRequired: ['M-type assumed based on spectral classification only'],
  reasoning: 'M-type asteroids are associated with metallic composition.',
  sources: [],
};

const navigatorOutput: NavigatorOutput = {
  accessibilityRating: 'good',
  minDeltaV_kms: 4.5,
  bestLaunchWindows: [],
  missionDurationDays: 200,
  orbitalClass: 'Apollo',
  dataCompleteness: 0.8,
  assumptionsRequired: [],
  reasoning: 'Good accessibility with delta-V within budget.',
  sources: [],
};

const econFixture: EconomistOutput = {
  totalResourceValueUSD: { min: 1e10, max: 5e11 },
  terrestrialExportValue: { min: 5e9, max: 2e11 },
  inSpaceUtilizationValue: { min: 5e9, max: 3e11 },
  missionROI: 'positive',
  keyValueDrivers: [
    { driver: 'Iron-nickel for orbital construction', impact: 'high', description: 'Growing orbital economy demand' },
  ],
  keyRisks: [
    { risk: 'Market saturation', severity: 'moderate', description: 'Large supply could depress prices' },
  ],
  scenarioAssumptions: ['PGM prices at 2050 projections per Hein et al. (2018)'],
  dataCompleteness: 0.75,
  assumptionsRequired: ['M-type composition estimate carries uncertainty'],
  reasoning: 'Metal-rich composition offers strong in-space utilization potential with moderate terrestrial export value.',
  disclaimer: 'These are 2050 scenario projections, not current market values. Actual economics depend on technology development, launch costs, and market conditions that cannot be predicted with confidence.',
  sources: ['asteroid-mining-economics-hein'],
};

const scenarioChunk = {
  id: 'sc-econ',
  source_id: 'asteroid-mining-economics-hein',
  source_title: 'Techno-Economic Analysis of Asteroid Mining — Hein et al. (2018)',
  source_url: null,
  source_year: 2018,
  source_type: 'scenario' as const,
  chunk_index: 0,
  content: 'By 2050, asteroid mining PGMs could generate significant ROI.',
  metadata: {},
  similarity: 0.82,
};

// ── State helpers ─────────────────────────────────────────────────────────────

function makeState(overrides: Partial<SwarmState> = {}): SwarmState {
  return {
    asteroidId: mockAsteroid.id,
    missionParams: {},
    requestedAgents: ['navigator', 'geologist', 'economist', 'riskAssessor'],
    phase: 'economizing',
    errors: [],
    handoffTriggered: false,
    geologistOutput,
    navigatorOutput,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCreate.mockReset();
  mockQueryScenario.mockReset();
  mockQueryScience.mockReset();

  process.env['ANTHROPIC_API_KEY'] = 'test-key';

  mockQueryScenario.mockResolvedValue({ result: [scenarioChunk], rawChunks: [scenarioChunk] });
  mockQueryScience.mockResolvedValue({ result: [], rawChunks: [] });
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('runEconomist', () => {
  it('returns EconomistOutput when model submits directly', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'tool_use', id: 'call_1', name: 'submit_economist_analysis', input: econFixture }],
      stop_reason: 'tool_use',
    });

    const { output } = await runEconomist(mockAsteroid, makeState(), {});

    expect(output.dataCompleteness).toBe(0.75);
    expect(output.assumptionsRequired).toBeInstanceOf(Array);
    expect(output.sources).toBeInstanceOf(Array);
  });

  it('missionROI is a valid enum value', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'tool_use', id: 'call_1', name: 'submit_economist_analysis', input: econFixture }],
      stop_reason: 'tool_use',
    });

    const { output } = await runEconomist(mockAsteroid, makeState(), {});

    expect(['exceptional', 'positive', 'marginal', 'negative', 'unmodelable']).toContain(
      output.missionROI,
    );
  });

  it('disclaimer is always a non-empty string', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'tool_use', id: 'call_1', name: 'submit_economist_analysis', input: econFixture }],
      stop_reason: 'tool_use',
    });

    const { output } = await runEconomist(mockAsteroid, makeState(), {});

    expect(typeof output.disclaimer).toBe('string');
    expect(output.disclaimer.length).toBeGreaterThan(0);
  });

  it('includes geologistOutput composition in user message sent to Claude', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'tool_use', id: 'call_1', name: 'submit_economist_analysis', input: econFixture }],
      stop_reason: 'tool_use',
    });

    await runEconomist(mockAsteroid, makeState(), {});

    // The first messages.create call should include composition data in user message
    const firstCall = mockCreate.mock.calls[0];
    const messages = firstCall?.[0]?.messages as Array<{ role: string; content: string }>;
    const userMessage = messages.find((m) => m.role === 'user')?.content ?? '';

    expect(userMessage).toContain('Iron/nickel');
    expect(userMessage).toContain('Platinum-group');
  });

  it('handles state without geologistOutput: sets missionROI to unmodelable path', async () => {
    const unmodelableFixture = { ...econFixture, missionROI: 'unmodelable' as const };
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'tool_use', id: 'call_1', name: 'submit_economist_analysis', input: unmodelableFixture }],
      stop_reason: 'tool_use',
    });

    const stateWithoutGeo = makeState({ geologistOutput: undefined });

    // Verify user message contains the "composition unknown" note
    const { output } = await runEconomist(mockAsteroid, stateWithoutGeo, {});

    const firstCall = mockCreate.mock.calls[0];
    const messages = firstCall?.[0]?.messages as Array<{ role: string; content: string }>;
    const userMessage = messages.find((m) => m.role === 'user')?.content ?? '';
    expect(userMessage).toContain('not available');
    expect(output.missionROI).toBe('unmodelable');
  });

  it('handles 2-turn loop: scenario RAG lookup then submit', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'tool_use', id: 'call_1', name: 'query_scenario_index', input: { query: 'platinum group metal mining economics 2050' } }],
      stop_reason: 'tool_use',
    });
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'tool_use', id: 'call_2', name: 'submit_economist_analysis', input: econFixture }],
      stop_reason: 'tool_use',
    });

    const { output } = await runEconomist(mockAsteroid, makeState(), {});

    expect(mockCreate).toHaveBeenCalledTimes(2);
    expect(mockQueryScenario).toHaveBeenCalled();
    expect(output.missionROI).toBe('positive');
  });

  it('throws AIServiceError if model never submits', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'Calculating...' }],
      stop_reason: 'end_turn',
    });

    await expect(runEconomist(mockAsteroid, makeState(), {})).rejects.toThrow(
      'Economist agent did not call submit_economist_analysis within turn limit',
    );
  });
});
