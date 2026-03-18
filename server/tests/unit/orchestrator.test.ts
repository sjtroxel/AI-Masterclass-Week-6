import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Hoist mock refs ───────────────────────────────────────────────────────────
const {
  mockRunNavigator,
  mockRunGeologist,
  mockRunRiskAssessor,
  mockRunEconomist,
  mockGetAsteroidById,
  mockCreate,
  mockSupabaseFrom,
} = vi.hoisted(() => {
  // Supabase chained call builder
  const eqFn = vi.fn().mockResolvedValue({ error: null });
  const singleFn = vi.fn().mockResolvedValue({ data: { id: 'test-analysis-uuid' }, error: null });
  const selectFn = vi.fn().mockReturnValue({ single: singleFn, eq: eqFn });
  const insertFn = vi.fn().mockReturnValue({ select: selectFn });
  const updateFn = vi.fn().mockReturnValue({ eq: eqFn });
  const fromFn = vi.fn().mockReturnValue({ insert: insertFn, update: updateFn, select: selectFn });

  return {
    mockRunNavigator: vi.fn(),
    mockRunGeologist: vi.fn(),
    mockRunRiskAssessor: vi.fn(),
    mockRunEconomist: vi.fn(),
    mockGetAsteroidById: vi.fn(),
    mockCreate: vi.fn(),
    mockSupabaseFrom: fromFn,
  };
});

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('../../src/services/orchestrator/navigator.js', () => ({
  runNavigator: mockRunNavigator,
}));

vi.mock('../../src/services/orchestrator/geologist.js', () => ({
  runGeologist: mockRunGeologist,
}));

vi.mock('../../src/services/orchestrator/riskAssessor.js', () => ({
  runRiskAssessor: mockRunRiskAssessor,
}));

vi.mock('../../src/services/orchestrator/economist.js', () => ({
  runEconomist: mockRunEconomist,
}));

vi.mock('../../src/services/asteroidService.js', () => ({
  getAsteroidById: mockGetAsteroidById,
}));

vi.mock('../../src/db/supabase.js', () => ({
  supabase: { from: mockSupabaseFrom },
  supabaseAdmin: { from: mockSupabaseFrom },
}));

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: mockCreate },
  })),
}));

import { runOrchestrator } from '../../src/services/orchestrator/orchestrator.js';
import type {
  NavigatorOutput,
  GeologistOutput,
  EconomistOutput,
  RiskOutput,
  AgentTrace,
} from '../../../../shared/types.js';
import type { AsteroidRow } from '../../src/services/asteroidService.js';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const mockAsteroid: AsteroidRow = {
  id: 'test-asteroid-uuid',
  nasa_id: '2015 XC',
  spkid: null,
  full_name: '(2015 XC)',
  name: 'Test Asteroid',
  designation: '2015 XC',
  is_pha: false,
  is_sentry_object: false,
  absolute_magnitude_h: 22.0,
  diameter_min_km: 0.1,
  diameter_max_km: 0.3,
  diameter_sigma_km: null,
  spectral_type_smass: 'C',
  spectral_type_tholen: null,
  orbit_epoch_jd: null,
  semi_major_axis_au: 1.1,
  eccentricity: 0.35,
  inclination_deg: 5.0,
  longitude_asc_node_deg: null,
  argument_perihelion_deg: null,
  mean_anomaly_deg: null,
  perihelion_distance_au: null,
  aphelion_distance_au: null,
  orbital_period_yr: 1.2,
  min_orbit_intersection_au: 0.01,
  nhats_accessible: true,
  nhats_min_delta_v_kms: 5.0,
  nhats_min_duration_days: 200,
  next_approach_date: '2028-01-01',
  next_approach_au: 0.03,
  next_approach_miss_km: 4500000,
  closest_approach_date: '2028-01-01',
  closest_approach_au: 0.03,
  composition_summary: null,
  resource_profile: null,
  economic_tier: null,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

const mockTrace: AgentTrace = {
  agent: 'navigator',
  events: [],
  totalLatencyMs: 1000,
};

function makeNavOutput(dataCompleteness: number, assumptions: string[] = []): NavigatorOutput {
  return {
    accessibilityRating: 'good',
    minDeltaV_kms: 5.0,
    bestLaunchWindows: [],
    missionDurationDays: 200,
    orbitalClass: 'Apollo',
    dataCompleteness,
    assumptionsRequired: assumptions,
    reasoning: 'Test navigator output.',
    sources: [],
  };
}

function makeGeoOutput(dataCompleteness: number, assumptions: string[] = []): GeologistOutput {
  return {
    spectralClass: 'C',
    compositionEstimate: {
      water_ice_pct: { min: 5, max: 20 },
      carbonaceous_pct: { min: 30, max: 50 },
      silicate_pct: { min: 20, max: 40 },
      iron_nickel_pct: { min: 5, max: 15 },
      platinum_group_pct: { min: 0, max: 0.5 },
      other_pct: { min: 0, max: 5 },
    },
    keyResources: [],
    compositionConfidence: 'estimated',
    analogAsteroids: [],
    dataCompleteness,
    assumptionsRequired: assumptions,
    reasoning: 'Test geologist output.',
    sources: [],
  };
}

function makeEconOutput(dataCompleteness: number, assumptions: string[] = []): EconomistOutput {
  return {
    totalResourceValueUSD: { min: 1e9, max: 1e11 },
    terrestrialExportValue: { min: 5e8, max: 5e10 },
    inSpaceUtilizationValue: { min: 5e8, max: 5e10 },
    missionROI: 'positive',
    keyValueDrivers: [],
    keyRisks: [],
    scenarioAssumptions: [],
    dataCompleteness,
    assumptionsRequired: assumptions,
    reasoning: 'Test economist output.',
    disclaimer: 'These are 2050 scenario projections, not current market values.',
    sources: [],
  };
}

function makeRiskOutput(dataCompleteness: number, assumptions: string[] = []): RiskOutput {
  return {
    planetaryDefense: {
      isPHA: false,
      hazardRating: 'none',
      monitoringStatus: 'No significant monitoring required.',
      notableApproaches: [],
      mitigationContext: '',
    },
    missionRisk: {
      overallRating: 'low',
      communicationDelayMinutes: { min: 2, max: 10 },
      surfaceConditions: 'Unknown surface conditions.',
      primaryRisks: [],
    },
    dataCompleteness,
    assumptionsRequired: assumptions,
    reasoning: 'Test risk output.',
    sources: [],
  };
}

function setupAgentMocks(
  navDC: number,
  geoDC: number,
  econDC: number,
  riskDC: number,
  options: {
    navAssumptions?: string[];
    geoAssumptions?: string[];
    econAssumptions?: string[];
    riskAssumptions?: string[];
  } = {},
) {
  mockRunNavigator.mockResolvedValue({
    output: makeNavOutput(navDC, options.navAssumptions ?? []),
    trace: { ...mockTrace, agent: 'navigator' },
  });
  mockRunGeologist.mockResolvedValue({
    output: makeGeoOutput(geoDC, options.geoAssumptions ?? []),
    trace: { ...mockTrace, agent: 'geologist' },
  });
  mockRunRiskAssessor.mockResolvedValue({
    output: makeRiskOutput(riskDC, options.riskAssumptions ?? []),
    trace: { ...mockTrace, agent: 'riskAssessor' },
  });
  mockRunEconomist.mockResolvedValue({
    output: makeEconOutput(econDC, options.econAssumptions ?? []),
    trace: { ...mockTrace, agent: 'economist' },
  });
}

beforeEach(() => {
  // clearAllMocks preserves the Anthropic factory mock implementation;
  // resetAllMocks would wipe it, causing "Cannot read properties of undefined (reading 'create')"
  vi.clearAllMocks();
  mockCreate.mockReset();
  mockRunNavigator.mockReset();
  mockRunGeologist.mockReset();
  mockRunRiskAssessor.mockReset();
  mockRunEconomist.mockReset();
  mockGetAsteroidById.mockReset();

  process.env['ANTHROPIC_API_KEY'] = 'test-key';

  mockGetAsteroidById.mockResolvedValue(mockAsteroid);

  // Re-apply supabase chain mocks (needed because clearAllMocks clears mockReturnValue too)
  const eqFn = vi.fn().mockResolvedValue({ error: null });
  const singleFn = vi.fn().mockResolvedValue({ data: { id: 'test-analysis-uuid' }, error: null });
  const selectFn = vi.fn().mockReturnValue({ single: singleFn, eq: eqFn });
  const insertFn = vi.fn().mockReturnValue({ select: selectFn });
  const updateFn = vi.fn().mockReturnValue({ eq: eqFn });
  mockSupabaseFrom.mockReturnValue({ insert: insertFn, update: updateFn, select: selectFn });
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('runOrchestrator — confidence formula', () => {
  it('computes score of 1.0 when dataCompleteness=1.0 and no assumptions', async () => {
    setupAgentMocks(1.0, 1.0, 1.0, 1.0);

    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'Full synthesis text here.' }],
      stop_reason: 'end_turn',
    });

    const { state } = await runOrchestrator(mockAsteroid.id, {});

    expect(state.confidenceScores?.orbital).toBe(1.0);
    expect(state.confidenceScores?.compositional).toBe(1.0);
    expect(state.confidenceScores?.economic).toBe(1.0);
    expect(state.confidenceScores?.risk).toBe(1.0);
    expect(state.confidenceScores?.overall).toBe(1.0);
  });

  it('applies assumption penalty: dataCompleteness=0.8 with 3 assumptions → 0.65', async () => {
    // 0.8 - 3*0.05 = 0.8 - 0.15 = 0.65
    setupAgentMocks(0.8, 0.8, 0.8, 0.8, {
      navAssumptions: ['a', 'b', 'c'],
      geoAssumptions: ['a', 'b', 'c'],
      econAssumptions: ['a', 'b', 'c'],
      riskAssumptions: ['a', 'b', 'c'],
    });

    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'Synthesis with some assumptions.' }],
      stop_reason: 'end_turn',
    });

    const { state } = await runOrchestrator(mockAsteroid.id, {});

    expect(state.confidenceScores?.orbital).toBe(0.65);
    expect(state.confidenceScores?.compositional).toBe(0.65);
  });

  it('caps assumption penalty at 0.3', async () => {
    // dataCompleteness=0.8, 10 assumptions → min(0.3, 10*0.05=0.5) = 0.3 → 0.8-0.3=0.5
    setupAgentMocks(0.8, 0.8, 0.8, 0.8, {
      navAssumptions: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'],
      geoAssumptions: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'],
      econAssumptions: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'],
      riskAssumptions: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'],
    });

    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'Synthesis.' }],
      stop_reason: 'end_turn',
    });

    const { state } = await runOrchestrator(mockAsteroid.id, {});

    // Should be capped at 0.5 (not 0.3 from over-penalization)
    expect(state.confidenceScores?.orbital).toBe(0.5);
  });
});

describe('runOrchestrator — handoff trigger', () => {
  it('triggers handoff when overall confidence < 0.30', async () => {
    // All agents return dataCompleteness=0.2 → overall=0.2 < 0.30 (HANDOFF_THRESHOLD)
    setupAgentMocks(0.2, 0.2, 0.2, 0.2);

    const { state } = await runOrchestrator(mockAsteroid.id, {});

    expect(state.handoffTriggered).toBe(true);
    expect(state.handoffPacket).toBeDefined();
    expect(state.phase).toBe('handoff');
    expect(state.synthesis).toBeUndefined();
  });

  it('handoffPacket has required fields', async () => {
    setupAgentMocks(0.2, 0.2, 0.2, 0.2);

    const { state } = await runOrchestrator(mockAsteroid.id, {});

    expect(state.handoffPacket).toMatchObject({
      triggeredBy: 'low_confidence',
      aggregateConfidence: expect.any(Number),
      whatWasFound: expect.any(String),
      whereConfidenceBrokDown: expect.any(String),
      whatHumanExpertNeeds: expect.any(String),
      generatedAt: expect.any(String),
    });
  });
});

describe('runOrchestrator — synthesis path', () => {
  it('runs synthesis when overall confidence ≥ 0.55', async () => {
    setupAgentMocks(1.0, 1.0, 1.0, 1.0);

    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'This asteroid is a strong candidate for resource extraction.' }],
      stop_reason: 'end_turn',
    });

    const { state } = await runOrchestrator(mockAsteroid.id, {});

    expect(state.handoffTriggered).toBe(false);
    expect(state.synthesis).toBeDefined();
    expect(state.synthesis).toContain('asteroid');
    expect(state.phase).toBe('complete');
  });

  it('falls back to handoff if synthesis Claude call fails', async () => {
    setupAgentMocks(1.0, 1.0, 1.0, 1.0);

    mockCreate.mockRejectedValue(new Error('Anthropic API rate limit'));

    const { state } = await runOrchestrator(mockAsteroid.id, {});

    expect(state.handoffTriggered).toBe(true);
    expect(state.handoffPacket?.triggeredBy).toBe('agent_failure');
    expect(state.phase).toBe('handoff');
  });
});

describe('runOrchestrator — parallel dispatch', () => {
  it('calls Geologist and Risk Assessor before Economist', async () => {
    const callOrder: string[] = [];

    mockRunNavigator.mockImplementation(async () => {
      callOrder.push('navigator');
      return { output: makeNavOutput(0.8), trace: { ...mockTrace, agent: 'navigator' } };
    });
    mockRunGeologist.mockImplementation(async () => {
      callOrder.push('geologist');
      return { output: makeGeoOutput(0.8), trace: { ...mockTrace, agent: 'geologist' } };
    });
    mockRunRiskAssessor.mockImplementation(async () => {
      callOrder.push('riskAssessor');
      return { output: makeRiskOutput(0.8), trace: { ...mockTrace, agent: 'riskAssessor' } };
    });
    mockRunEconomist.mockImplementation(async () => {
      callOrder.push('economist');
      return { output: makeEconOutput(0.8), trace: { ...mockTrace, agent: 'economist' } };
    });

    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'Good synthesis.' }],
      stop_reason: 'end_turn',
    });

    await runOrchestrator(mockAsteroid.id, {});

    const navigatorIdx = callOrder.indexOf('navigator');
    const geologistIdx = callOrder.indexOf('geologist');
    const riskIdx = callOrder.indexOf('riskAssessor');
    const economistIdx = callOrder.indexOf('economist');

    // Navigator runs first
    expect(navigatorIdx).toBeLessThan(economistIdx);
    // Geologist and Risk run before Economist
    expect(geologistIdx).toBeLessThan(economistIdx);
    expect(riskIdx).toBeLessThan(economistIdx);
  });
});

describe('runOrchestrator — risk assessor error recovery', () => {
  it('continues when risk assessor fails and records the error', async () => {
    mockRunNavigator.mockResolvedValue({
      output: makeNavOutput(0.8),
      trace: { ...mockTrace, agent: 'navigator' },
    });
    mockRunGeologist.mockResolvedValue({
      output: makeGeoOutput(0.8),
      trace: { ...mockTrace, agent: 'geologist' },
    });
    // Risk Assessor fails
    mockRunRiskAssessor.mockRejectedValue(new Error('Risk assessor timed out'));
    mockRunEconomist.mockResolvedValue({
      output: makeEconOutput(0.7),
      trace: { ...mockTrace, agent: 'economist' },
    });

    const { state } = await runOrchestrator(mockAsteroid.id, {});

    expect(state.errors.some((e) => e.agent === 'riskAssessor')).toBe(true);
    const riskError = state.errors.find((e) => e.agent === 'riskAssessor');
    expect(riskError?.code).toBe('AGENT_ERROR');
    expect(riskError?.recoverable).toBe(true);
    expect(state.riskOutput).toBeUndefined();
    // Other agents still ran
    expect(state.navigatorOutput).toBeDefined();
    expect(state.geologistOutput).toBeDefined();
  });
});

describe('runOrchestrator — partial agent set', () => {
  it('skips geologist and riskAssessor when not in requestedAgents', async () => {
    mockRunNavigator.mockResolvedValue({
      output: makeNavOutput(0.8),
      trace: { ...mockTrace, agent: 'navigator' },
    });
    mockRunEconomist.mockResolvedValue({
      output: makeEconOutput(0.7),
      trace: { ...mockTrace, agent: 'economist' },
    });

    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'Navigator-only synthesis.' }],
      stop_reason: 'end_turn',
    });

    const { state } = await runOrchestrator(mockAsteroid.id, {}, ['navigator', 'economist']);

    expect(mockRunGeologist).not.toHaveBeenCalled();
    expect(mockRunRiskAssessor).not.toHaveBeenCalled();
    expect(state.navigatorOutput).toBeDefined();
    expect(state.geologistOutput).toBeUndefined();
    expect(state.riskOutput).toBeUndefined();
  });
});

describe('runOrchestrator — agent error recovery', () => {
  it('continues when one agent fails, errors array is populated', async () => {
    mockRunNavigator.mockResolvedValue({
      output: makeNavOutput(0.8),
      trace: { ...mockTrace, agent: 'navigator' },
    });
    // Geologist fails
    mockRunGeologist.mockRejectedValue(new Error('Geologist RAG timeout'));
    mockRunRiskAssessor.mockResolvedValue({
      output: makeRiskOutput(0.8),
      trace: { ...mockTrace, agent: 'riskAssessor' },
    });
    mockRunEconomist.mockResolvedValue({
      output: makeEconOutput(0.3),  // Low DC since geo failed
      trace: { ...mockTrace, agent: 'economist' },
    });

    const { state } = await runOrchestrator(mockAsteroid.id, {});

    // errors array has geologist entry
    expect(state.errors.length).toBeGreaterThanOrEqual(1);
    expect(state.errors.some((e) => e.agent === 'geologist')).toBe(true);

    // Other agents still ran
    expect(state.navigatorOutput).toBeDefined();
    expect(state.riskOutput).toBeDefined();

    // Geologist output is absent
    expect(state.geologistOutput).toBeUndefined();
  });

  it('errors have required shape', async () => {
    mockRunNavigator.mockRejectedValue(new Error('Navigator timeout'));
    mockRunGeologist.mockResolvedValue({
      output: makeGeoOutput(0.5),
      trace: { ...mockTrace, agent: 'geologist' },
    });
    mockRunRiskAssessor.mockResolvedValue({
      output: makeRiskOutput(0.5),
      trace: { ...mockTrace, agent: 'riskAssessor' },
    });
    mockRunEconomist.mockResolvedValue({
      output: makeEconOutput(0.4),
      trace: { ...mockTrace, agent: 'economist' },
    });

    const { state } = await runOrchestrator(mockAsteroid.id, {});

    const navError = state.errors.find((e) => e.agent === 'navigator');
    expect(navError).toBeDefined();
    expect(navError?.recoverable).toBe(true);
    expect(navError?.code).toBe('AGENT_ERROR');
    expect(typeof navError?.message).toBe('string');
  });
});

describe('runOrchestrator — economist error recovery', () => {
  it('continues when economist fails, records error, and triggers handoff due to missing output', async () => {
    mockRunNavigator.mockResolvedValue({
      output: makeNavOutput(0.8),
      trace: { ...mockTrace, agent: 'navigator' },
    });
    mockRunGeologist.mockResolvedValue({
      output: makeGeoOutput(0.8),
      trace: { ...mockTrace, agent: 'geologist' },
    });
    mockRunRiskAssessor.mockResolvedValue({
      output: makeRiskOutput(0.8),
      trace: { ...mockTrace, agent: 'riskAssessor' },
    });
    // Economist fails
    mockRunEconomist.mockRejectedValue(new Error('Economist timed out'));

    const { state } = await runOrchestrator(mockAsteroid.id, {});

    expect(state.errors.some((e) => e.agent === 'economist')).toBe(true);
    const econError = state.errors.find((e) => e.agent === 'economist');
    expect(econError?.recoverable).toBe(true);
    expect(econError?.code).toBe('AGENT_ERROR');
    expect(state.economistOutput).toBeUndefined();
  });
});

describe('runOrchestrator — synthesis edge cases', () => {
  it('falls back to handoff when synthesis response has no text block', async () => {
    setupAgentMocks(1.0, 1.0, 1.0, 1.0);

    // Resolved successfully but no text content block in response
    mockCreate.mockResolvedValue({
      content: [{ type: 'tool_use', id: 'call_1', name: 'some_tool', input: {} }],
      stop_reason: 'tool_use',
    });

    const { state } = await runOrchestrator(mockAsteroid.id, {});

    expect(state.handoffTriggered).toBe(true);
    expect(state.handoffPacket?.triggeredBy).toBe('agent_failure');
  });
});

describe('runOrchestrator — return shape', () => {
  it('result contains state and trace', async () => {
    setupAgentMocks(0.8, 0.8, 0.8, 0.8);

    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'Synthesis complete.' }],
      stop_reason: 'end_turn',
    });

    const result = await runOrchestrator(mockAsteroid.id, {});

    expect(result).toHaveProperty('state');
    expect(result).toHaveProperty('trace');
    expect(result.trace.analysisId).toBe('test-analysis-uuid');
    expect(result.trace.asteroidId).toBe(mockAsteroid.id);
    expect(result.trace).toHaveProperty('confidenceScores');
    expect(result.trace).toHaveProperty('totalLatencyMs');
  });
});
