import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Hoist mock refs so they're available in vi.mock factories ─────────────────
const { mockCreate, mockFetchNHATS, mockFetchCAD } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  mockFetchNHATS: vi.fn(),
  mockFetchCAD: vi.fn(),
}));

// ── Mock external dependencies before importing the module ────────────────────

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: mockCreate },
  })),
}));

vi.mock('../../src/services/orchestrator/tools.js', () => ({
  FETCH_NHATS_TOOL: { name: 'fetch_nhats_data', description: 'mock', input_schema: { type: 'object', properties: {} } },
  FETCH_CLOSE_APPROACHES_TOOL: { name: 'fetch_close_approaches', description: 'mock', input_schema: { type: 'object', properties: {} } },
  fetchNHATSData: mockFetchNHATS,
  fetchCloseApproaches: mockFetchCAD,
}));

import { runNavigator } from '../../src/services/orchestrator/navigator.js';
import type { NavigatorOutput } from '../../../shared/types.js';
import type { AsteroidRow } from '../../src/services/asteroidService.js';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const mockAsteroid: AsteroidRow = {
  id: 'test-asteroid-uuid',
  nasa_id: '2015 XC',
  spkid: '3888000',
  full_name: '(2015 XC)',
  name: null,
  designation: '2015 XC',
  is_pha: false,
  is_sentry_object: false,
  absolute_magnitude_h: 22.5,
  diameter_min_km: 0.1,
  diameter_max_km: 0.3,
  diameter_sigma_km: null,
  spectral_type_smass: 'C',
  spectral_type_tholen: null,
  orbit_epoch_jd: null,
  semi_major_axis_au: 1.15,
  eccentricity: 0.38,
  inclination_deg: 5.2,
  longitude_asc_node_deg: null,
  argument_perihelion_deg: null,
  mean_anomaly_deg: null,
  perihelion_distance_au: null,
  aphelion_distance_au: null,
  orbital_period_yr: 1.23,
  min_orbit_intersection_au: 0.012,
  nhats_accessible: true,
  nhats_min_delta_v_kms: 4.8,
  nhats_min_duration_days: 150,
  next_approach_date: '2027-03-15',
  next_approach_au: 0.025,
  next_approach_miss_km: 3740000,
  closest_approach_date: '2027-03-15',
  closest_approach_au: 0.025,
  composition_summary: null,
  resource_profile: null,
  economic_tier: null,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

const navFixture: NavigatorOutput = {
  accessibilityRating: 'good',
  minDeltaV_kms: 4.8,
  bestLaunchWindows: [
    { date: '2027-01-01', deltaV_kms: 4.8, missionDurationDays: 150, notes: 'Favorable window' },
  ],
  missionDurationDays: 150,
  orbitalClass: 'Apollo',
  dataCompleteness: 0.8,
  assumptionsRequired: ['Using DB pre-fetched delta-V values'],
  reasoning: 'This asteroid has a moderate delta-V requirement and is classified as accessible by NHATS.',
  sources: [],
};

beforeEach(() => {
  // clearAllMocks preserves the Anthropic factory mock implementation;
  // resetAllMocks would wipe it, causing "Cannot read properties of undefined (reading 'create')"
  vi.clearAllMocks();
  // Reset queued mockResolvedValueOnce values on mockCreate
  mockCreate.mockReset();
  mockFetchNHATS.mockReset();
  mockFetchCAD.mockReset();

  process.env['ANTHROPIC_API_KEY'] = 'test-key';

  // Default: NHATS + CAD tools return data
  mockFetchNHATS.mockResolvedValue({ found: true, minDeltaV_kms: 4.8, solutions: [] });
  mockFetchCAD.mockResolvedValue({ nextApproach: { date: '2027-03-15', missDistance_au: 0.025 } });
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('runNavigator', () => {
  it('returns NavigatorOutput when model submits on first turn', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'tool_use', id: 'call_1', name: 'submit_navigator_analysis', input: navFixture }],
      stop_reason: 'tool_use',
    });

    const { output } = await runNavigator(mockAsteroid, {} as never, {});

    expect(output.accessibilityRating).toBe('good');
    expect(output.dataCompleteness).toBe(0.8);
    expect(output.assumptionsRequired).toBeInstanceOf(Array);
    expect(output.sources).toBeInstanceOf(Array);
    expect(output.orbitalClass).toBe('Apollo');
  });

  it('accessibilityRating is one of the valid enum values', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'tool_use', id: 'call_1', name: 'submit_navigator_analysis', input: navFixture }],
      stop_reason: 'tool_use',
    });

    const { output } = await runNavigator(mockAsteroid, {} as never, {});

    expect(['exceptional', 'good', 'marginal', 'inaccessible']).toContain(output.accessibilityRating);
  });

  it('dataCompleteness is between 0 and 1', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'tool_use', id: 'call_1', name: 'submit_navigator_analysis', input: navFixture }],
      stop_reason: 'tool_use',
    });

    const { output } = await runNavigator(mockAsteroid, {} as never, {});

    expect(output.dataCompleteness).toBeGreaterThanOrEqual(0);
    expect(output.dataCompleteness).toBeLessThanOrEqual(1);
  });

  it('handles 2-turn loop: data tool call then submit', async () => {
    // Turn 1: model calls fetch_nhats_data
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'tool_use', id: 'call_1', name: 'fetch_nhats_data', input: { designation: '2015 XC' } }],
      stop_reason: 'tool_use',
    });
    // Turn 2: model submits final analysis
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'tool_use', id: 'call_2', name: 'submit_navigator_analysis', input: navFixture }],
      stop_reason: 'tool_use',
    });

    const { output, trace } = await runNavigator(mockAsteroid, {} as never, {});

    // Anthropic called twice
    expect(mockCreate).toHaveBeenCalledTimes(2);
    // Tool was dispatched
    expect(mockFetchNHATS).toHaveBeenCalledWith({ designation: '2015 XC' });
    // Output is correct
    expect(output.accessibilityRating).toBe('good');
    // Trace contains tool_call and output events
    const eventTypes = trace.events.map((e) => e.type);
    expect(eventTypes).toContain('tool_call');
    expect(eventTypes).toContain('output');
  });

  it('trace contains input and output events', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'tool_use', id: 'call_1', name: 'submit_navigator_analysis', input: navFixture }],
      stop_reason: 'tool_use',
    });

    const { trace } = await runNavigator(mockAsteroid, {} as never, {});

    const types = trace.events.map((e) => e.type);
    expect(types).toContain('input');
    expect(types).toContain('output');
  });

  it('throws AIServiceError if model never submits within turn limit', async () => {
    // Always return a text-only response (no tool_use) to exhaust the turn limit
    const textResponse = {
      content: [{ type: 'text', text: 'I need more data.' }],
      stop_reason: 'end_turn',
    };
    mockCreate.mockResolvedValue(textResponse);

    await expect(runNavigator(mockAsteroid, {} as never, {})).rejects.toThrow(
      'Navigator agent did not call submit_navigator_analysis within turn limit',
    );
  });

  it('throws AIServiceError when ANTHROPIC_API_KEY is missing', async () => {
    delete process.env['ANTHROPIC_API_KEY'];
    await expect(runNavigator(mockAsteroid, {} as never, {})).rejects.toThrow(
      'ANTHROPIC_API_KEY',
    );
  });

  it('handles fetch_close_approaches tool call with a next approach', async () => {
    mockFetchCAD.mockResolvedValue({
      designation: '2015 XC',
      nextApproach: { date: '2027-03-15', distanceAu: 0.025, distanceKm: 3_740_000 },
      closestApproach: null,
    });
    // Turn 1: model calls fetch_close_approaches
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'tool_use', id: 'call_1', name: 'fetch_close_approaches', input: { designation: '2015 XC' } }],
      stop_reason: 'tool_use',
    });
    // Turn 2: model submits
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'tool_use', id: 'call_2', name: 'submit_navigator_analysis', input: navFixture }],
      stop_reason: 'tool_use',
    });

    const { output } = await runNavigator(mockAsteroid, {} as never, {});

    expect(mockFetchCAD).toHaveBeenCalledWith({ designation: '2015 XC' });
    expect(output.accessibilityRating).toBe('good');
  });

  it('handles fetch_close_approaches returning no next approach', async () => {
    mockFetchCAD.mockResolvedValue({
      designation: '2015 XC',
      nextApproach: null,
      closestApproach: null,
    });
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'tool_use', id: 'call_1', name: 'fetch_close_approaches', input: { designation: '2015 XC' } }],
      stop_reason: 'tool_use',
    });
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'tool_use', id: 'call_2', name: 'submit_navigator_analysis', input: navFixture }],
      stop_reason: 'tool_use',
    });

    const { output } = await runNavigator(mockAsteroid, {} as never, {});

    expect(output.accessibilityRating).toBe('good');
  });

  it('handles an unknown tool call gracefully and continues the loop', async () => {
    // Turn 1: model calls an unknown tool → dispatchTool throws; loop continues
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'tool_use', id: 'call_1', name: 'bad_tool', input: {} }],
      stop_reason: 'tool_use',
    });
    // Turn 2: model submits after receiving the error result
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'tool_use', id: 'call_2', name: 'submit_navigator_analysis', input: navFixture }],
      stop_reason: 'tool_use',
    });

    const { output } = await runNavigator(mockAsteroid, {} as never, {});

    // Despite the bad tool call, the orchestration recovered and got a valid output
    expect(output.accessibilityRating).toBe('good');
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });
});
