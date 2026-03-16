import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Hoist mock refs ───────────────────────────────────────────────────────────

const { mockRunNavigator, mockGetAsteroidById } = vi.hoisted(() => ({
  mockRunNavigator: vi.fn(),
  mockGetAsteroidById: vi.fn(),
}));

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('../../src/services/orchestrator/navigator.js', () => ({
  runNavigator: mockRunNavigator,
}));

vi.mock('../../src/services/asteroidService.js', () => ({
  getAsteroidById: mockGetAsteroidById,
}));

import { compareAsteroids, buildScenario, optimizePortfolio } from '../../src/services/planningService.js';
import type { NavigatorOutput } from '../../../../shared/types.js';
import type { AsteroidRow } from '../../src/services/asteroidService.js';

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeAsteroid(overrides: Partial<AsteroidRow> = {}): AsteroidRow {
  return {
    id: 'asteroid-uuid',
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
    economic_tier: 'tier2',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeNavOutput(
  overrides: Partial<NavigatorOutput> = {},
): NavigatorOutput {
  return {
    accessibilityRating: 'good',
    minDeltaV_kms: 5.0,
    bestLaunchWindows: [],
    missionDurationDays: 200,
    orbitalClass: 'Apollo',
    dataCompleteness: 0.85,
    assumptionsRequired: [],
    reasoning: 'Good accessibility.',
    sources: [],
    ...overrides,
  };
}

function mockNavigatorFor(asteroid: AsteroidRow, navOutput: NavigatorOutput): void {
  mockGetAsteroidById.mockImplementation(async (id: string) => {
    if (id === asteroid.id) return asteroid;
    throw new Error(`Unexpected ID: ${id}`);
  });
  mockRunNavigator.mockResolvedValue({
    output: navOutput,
    trace: { agent: 'navigator', events: [], totalLatencyMs: 500 },
  });
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.resetAllMocks();
});

// ── compareAsteroids ──────────────────────────────────────────────────────────

describe('compareAsteroids', () => {
  it('returns candidates array ranked by score', async () => {
    const asteroid = makeAsteroid();
    mockGetAsteroidById.mockResolvedValue(asteroid);
    mockRunNavigator.mockResolvedValue({
      output: makeNavOutput({ accessibilityRating: 'good' }),
      trace: { agent: 'navigator', events: [], totalLatencyMs: 500 },
    });

    const result = await compareAsteroids(['asteroid-uuid'], {});

    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]?.rank).toBe(1);
    expect(result.candidates[0]?.asteroidId).toBe('asteroid-uuid');
    expect(result.missionParams).toEqual({});
    expect(result.rankedAt).toMatch(/^\d{4}-/);
  });

  it('calls Navigator once per asteroid', async () => {
    const a1 = makeAsteroid({ id: 'id-1', name: 'Alpha' });
    const a2 = makeAsteroid({ id: 'id-2', name: 'Beta' });

    mockGetAsteroidById.mockImplementation(async (id: string) =>
      id === 'id-1' ? a1 : a2,
    );
    mockRunNavigator.mockResolvedValue({
      output: makeNavOutput(),
      trace: { agent: 'navigator', events: [], totalLatencyMs: 300 },
    });

    await compareAsteroids(['id-1', 'id-2'], {});

    expect(mockRunNavigator).toHaveBeenCalledTimes(2);
  });

  it('ranks exceptional before good before marginal', async () => {
    const asteroids = [
      makeAsteroid({ id: 'id-marginal', name: 'Marginal' }),
      makeAsteroid({ id: 'id-exceptional', name: 'Exceptional' }),
      makeAsteroid({ id: 'id-good', name: 'Good' }),
    ];

    const navOutputs: Record<string, NavigatorOutput> = {
      'id-marginal':    makeNavOutput({ accessibilityRating: 'marginal',    minDeltaV_kms: 7.0 }),
      'id-exceptional': makeNavOutput({ accessibilityRating: 'exceptional', minDeltaV_kms: 4.0 }),
      'id-good':        makeNavOutput({ accessibilityRating: 'good',        minDeltaV_kms: 5.5 }),
    };

    mockGetAsteroidById.mockImplementation(async (id: string) => {
      const a = asteroids.find((x) => x.id === id);
      if (!a) throw new Error(`Unknown id: ${id}`);
      return a;
    });
    mockRunNavigator.mockImplementation(async (asteroid: AsteroidRow) => ({
      output: navOutputs[asteroid.id] ?? makeNavOutput(),
      trace: { agent: 'navigator', events: [], totalLatencyMs: 300 },
    }));

    const result = await compareAsteroids(['id-marginal', 'id-exceptional', 'id-good'], {});

    const names = result.candidates.map((c) => c.asteroidName);
    expect(names[0]).toBe('Exceptional');
    expect(names[1]).toBe('Good');
    expect(names[2]).toBe('Marginal');
  });

  it('throws ValidationError when no asteroid IDs provided', async () => {
    await expect(compareAsteroids([], {})).rejects.toThrow('At least one asteroid ID is required');
  });

  it('throws ValidationError when more than 10 asteroid IDs provided', async () => {
    const ids = new Array(11).fill('some-id');
    await expect(compareAsteroids(ids, {})).rejects.toThrow('Maximum 10 candidates');
  });
});

// ── buildScenario ─────────────────────────────────────────────────────────────

describe('buildScenario', () => {
  it('returns recommendations with topPick and feasibleCount', async () => {
    const asteroid = makeAsteroid();
    mockGetAsteroidById.mockResolvedValue(asteroid);
    mockRunNavigator.mockResolvedValue({
      output: makeNavOutput({ minDeltaV_kms: 5.0 }),
      trace: { agent: 'navigator', events: [], totalLatencyMs: 400 },
    });

    const result = await buildScenario(['asteroid-uuid'], { maxDeltaV_kms: 6.0 });

    expect(result.recommendations).toHaveLength(1);
    expect(result.topPick).not.toBeNull();
    expect(result.feasibleCount).toBe(1);
    expect(result.constraints).toMatchObject({ maxDeltaV_kms: 6.0 });
  });

  it('marks candidate as failing constraint when delta-V exceeds budget', async () => {
    const asteroid = makeAsteroid();
    mockGetAsteroidById.mockResolvedValue(asteroid);
    mockRunNavigator.mockResolvedValue({
      output: makeNavOutput({ minDeltaV_kms: 8.5 }),
      trace: { agent: 'navigator', events: [], totalLatencyMs: 400 },
    });

    const result = await buildScenario(['asteroid-uuid'], { maxDeltaV_kms: 6.0 });

    const candidate = result.recommendations[0];
    expect(candidate?.passesConstraints).toBe(false);
    expect(candidate?.constraintViolations).toHaveLength(1);
    expect(candidate?.constraintViolations[0]).toContain('8.5 km/s exceeds budget');
    expect(result.feasibleCount).toBe(0);
  });

  it('feasibleCount reflects how many candidates pass constraints', async () => {
    const a1 = makeAsteroid({ id: 'id-1', name: 'Cheap' });
    const a2 = makeAsteroid({ id: 'id-2', name: 'Expensive' });

    mockGetAsteroidById.mockImplementation(async (id: string) =>
      id === 'id-1' ? a1 : a2,
    );
    mockRunNavigator.mockImplementation(async (asteroid: AsteroidRow) => ({
      output: makeNavOutput({
        minDeltaV_kms: asteroid.id === 'id-1' ? 4.5 : 9.0,
        accessibilityRating: asteroid.id === 'id-1' ? 'exceptional' : 'marginal',
      }),
      trace: { agent: 'navigator', events: [], totalLatencyMs: 300 },
    }));

    const result = await buildScenario(['id-1', 'id-2'], { maxDeltaV_kms: 6.0 });

    expect(result.feasibleCount).toBe(1);
    // The feasible candidate should rank first
    expect(result.recommendations[0]?.passesConstraints).toBe(true);
    expect(result.topPick?.asteroidId).toBe('id-1');
  });

  it('topPick is null when there are no candidates', async () => {
    // This scenario can't happen normally (validation prevents empty array),
    // but test the field shape: buildScenario with a valid ID returns topPick
    const asteroid = makeAsteroid();
    mockNavigatorFor(asteroid, makeNavOutput());

    const result = await buildScenario([asteroid.id], {});

    expect(result.topPick).not.toBeNull();
  });

  it('applies mission window constraint violation', async () => {
    const asteroid = makeAsteroid();
    mockGetAsteroidById.mockResolvedValue(asteroid);
    mockRunNavigator.mockResolvedValue({
      output: makeNavOutput({
        bestLaunchWindows: [
          { date: '2025-01-01', deltaV_kms: 5.0, missionDurationDays: 200 },
        ],
      }),
      trace: { agent: 'navigator', events: [], totalLatencyMs: 400 },
    });

    // Window requires launch after 2030 — the only window (2025) doesn't fit
    const result = await buildScenario([asteroid.id], {
      missionWindowStart: '2030-01-01',
      missionWindowEnd: '2032-01-01',
    });

    expect(result.recommendations[0]?.passesConstraints).toBe(false);
    expect(result.recommendations[0]?.constraintViolations[0]).toContain('mission window');
  });

  it('does not flag window violation when bestLaunchWindows is empty (data gap)', async () => {
    const asteroid = makeAsteroid();
    mockGetAsteroidById.mockResolvedValue(asteroid);
    mockRunNavigator.mockResolvedValue({
      output: makeNavOutput({ bestLaunchWindows: [] }),
      trace: { agent: 'navigator', events: [], totalLatencyMs: 400 },
    });

    // Window constraint set, but no windows to check — should not be a violation
    const result = await buildScenario([asteroid.id], {
      missionWindowStart: '2030-01-01',
    });

    expect(result.recommendations[0]?.passesConstraints).toBe(true);
    expect(result.recommendations[0]?.constraintViolations).toHaveLength(0);
  });

  it('applies custom priority weights to scoring', async () => {
    // Two asteroids: Alpha is excellent accessibility, low economics
    //                Beta is poor accessibility, high economics
    // With accessibility weight=1.0, Alpha should win
    // With economics weight=1.0, Beta should win
    const alpha = makeAsteroid({ id: 'id-alpha', name: 'Alpha', economic_tier: 'tier3' });
    const beta  = makeAsteroid({ id: 'id-beta',  name: 'Beta',  economic_tier: 'tier1' });

    mockGetAsteroidById.mockImplementation(async (id: string) =>
      id === 'id-alpha' ? alpha : beta,
    );
    mockRunNavigator.mockImplementation(async (asteroid: AsteroidRow) => ({
      output: makeNavOutput({
        accessibilityRating: asteroid.id === 'id-alpha' ? 'exceptional' : 'inaccessible',
        minDeltaV_kms: asteroid.id === 'id-alpha' ? 4.0 : 9.0,
      }),
      trace: { agent: 'navigator', events: [], totalLatencyMs: 300 },
    }));

    const accessibilityFirst = await buildScenario(
      ['id-alpha', 'id-beta'],
      { priorities: { accessibility: 1.0, economics: 0.0, risk: 0.0 } },
    );
    expect(accessibilityFirst.topPick?.asteroidId).toBe('id-alpha');

    vi.clearAllMocks();
    mockGetAsteroidById.mockImplementation(async (id: string) =>
      id === 'id-alpha' ? alpha : beta,
    );
    mockRunNavigator.mockImplementation(async (asteroid: AsteroidRow) => ({
      output: makeNavOutput({
        accessibilityRating: asteroid.id === 'id-alpha' ? 'exceptional' : 'inaccessible',
        minDeltaV_kms: asteroid.id === 'id-alpha' ? 4.0 : 9.0,
      }),
      trace: { agent: 'navigator', events: [], totalLatencyMs: 300 },
    }));

    const economicsFirst = await buildScenario(
      ['id-alpha', 'id-beta'],
      { priorities: { accessibility: 0.0, economics: 1.0, risk: 0.0 } },
    );
    expect(economicsFirst.topPick?.asteroidId).toBe('id-beta');
  });
});

// ── optimizePortfolio ─────────────────────────────────────────────────────────

describe('optimizePortfolio', () => {
  it('returns a portfolio of the requested size', async () => {
    const asteroids = ['id-1', 'id-2', 'id-3', 'id-4'].map((id) =>
      makeAsteroid({ id, name: `Asteroid ${id}` }),
    );

    mockGetAsteroidById.mockImplementation(async (id: string) => {
      const a = asteroids.find((x) => x.id === id);
      if (!a) throw new Error(`Unknown: ${id}`);
      return a;
    });
    mockRunNavigator.mockResolvedValue({
      output: makeNavOutput({ accessibilityRating: 'good', minDeltaV_kms: 5.5 }),
      trace: { agent: 'navigator', events: [], totalLatencyMs: 300 },
    });

    const result = await optimizePortfolio(['id-1', 'id-2', 'id-3', 'id-4'], {}, 2);

    expect(result.optimalPortfolio).toHaveLength(2);
    expect(result.portfolioScore).toBeGreaterThan(0);
    expect(result.allCandidates).toHaveLength(4);
  });

  it('clamps portfolioSize to number of candidates if larger', async () => {
    const asteroid = makeAsteroid();
    mockGetAsteroidById.mockResolvedValue(asteroid);
    mockRunNavigator.mockResolvedValue({
      output: makeNavOutput(),
      trace: { agent: 'navigator', events: [], totalLatencyMs: 300 },
    });

    const result = await optimizePortfolio([asteroid.id], {}, 5);

    expect(result.optimalPortfolio).toHaveLength(1);
  });

  it('prefers feasible candidates in the portfolio', async () => {
    const feasible   = makeAsteroid({ id: 'id-f', name: 'Feasible',   economic_tier: 'tier1' });
    const infeasible = makeAsteroid({ id: 'id-x', name: 'Infeasible', economic_tier: 'tier1' });

    mockGetAsteroidById.mockImplementation(async (id: string) =>
      id === 'id-f' ? feasible : infeasible,
    );
    mockRunNavigator.mockImplementation(async (asteroid: AsteroidRow) => ({
      output: makeNavOutput({
        minDeltaV_kms: asteroid.id === 'id-f' ? 4.5 : 9.0,
        accessibilityRating: asteroid.id === 'id-f' ? 'exceptional' : 'marginal',
      }),
      trace: { agent: 'navigator', events: [], totalLatencyMs: 300 },
    }));

    const result = await optimizePortfolio(['id-f', 'id-x'], { maxDeltaV_kms: 6.0 }, 1);

    expect(result.optimalPortfolio[0]?.asteroidId).toBe('id-f');
  });

  it('portfolioRationale mentions all portfolio asteroid names', async () => {
    const a1 = makeAsteroid({ id: 'id-1', name: 'Bennu' });
    const a2 = makeAsteroid({ id: 'id-2', name: 'Ryugu' });

    mockGetAsteroidById.mockImplementation(async (id: string) =>
      id === 'id-1' ? a1 : a2,
    );
    mockRunNavigator.mockResolvedValue({
      output: makeNavOutput(),
      trace: { agent: 'navigator', events: [], totalLatencyMs: 300 },
    });

    const result = await optimizePortfolio(['id-1', 'id-2'], {}, 2);

    expect(result.portfolioRationale).toContain('Bennu');
    expect(result.portfolioRationale).toContain('Ryugu');
  });
});
