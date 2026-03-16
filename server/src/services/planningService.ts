/**
 * planningService.ts
 *
 * Mission planning logic: multi-asteroid comparison, scenario building, portfolio
 * optimization.
 *
 * All Navigator calls run in parallel. Scoring is computed from observable fields
 * (Navigator output + DB economic_tier) — no self-reported confidence.
 *
 * Public API:
 *   compareAsteroids  — run Navigator on each candidate; rank by accessibility
 *   buildScenario     — score candidates against user constraints + priorities
 *   optimizePortfolio — find the optimal K-asteroid combination
 */

import { getAsteroidById } from './asteroidService.js';
import { runNavigator } from './orchestrator/navigator.js';
import { ValidationError } from '../errors/AppError.js';
import type {
  MissionParams,
  MissionConstraints,
  CandidateScore,
  ComparisonResponse,
  ScenarioResponse,
  PortfolioResponse,
  NavigatorOutput,
  SwarmState,
  AgentType,
} from '../../../shared/types.js';
import type { AsteroidRow } from './asteroidService.js';

const MAX_CANDIDATES = 10;

// ── Public API ─────────────────────────────────────────────────────────────────

export async function compareAsteroids(
  asteroidIds: string[],
  missionParams: MissionParams,
): Promise<ComparisonResponse> {
  validateCandidateCount(asteroidIds);
  const asteroids = await fetchAsteroids(asteroidIds);
  const navResults = await runNavigatorsInParallel(asteroids, missionParams);

  const constraints = missionParamsToConstraints(missionParams);
  const scored = navResults.map(({ asteroid, navOutput }) =>
    scoreCandidate(asteroid, navOutput, constraints),
  );

  return {
    candidates: rankCandidates(scored),
    missionParams,
    rankedAt: new Date().toISOString(),
  };
}

export async function buildScenario(
  asteroidIds: string[],
  constraints: MissionConstraints,
): Promise<ScenarioResponse> {
  validateCandidateCount(asteroidIds);
  const missionParams = constraintsToMissionParams(constraints);
  const asteroids = await fetchAsteroids(asteroidIds);
  const navResults = await runNavigatorsInParallel(asteroids, missionParams);

  const scored = navResults.map(({ asteroid, navOutput }) =>
    scoreCandidate(asteroid, navOutput, constraints),
  );

  const ranked = rankCandidates(scored);

  return {
    recommendations: ranked,
    constraints,
    topPick: ranked[0] ?? null,
    feasibleCount: ranked.filter((c) => c.passesConstraints).length,
    rankedAt: new Date().toISOString(),
  };
}

export async function optimizePortfolio(
  asteroidIds: string[],
  constraints: MissionConstraints,
  portfolioSize: number,
): Promise<PortfolioResponse> {
  validateCandidateCount(asteroidIds);
  const clampedSize = Math.min(portfolioSize, asteroidIds.length);

  const scenario = await buildScenario(asteroidIds, constraints);
  const allCandidates = scenario.recommendations;

  const optimalPortfolio = findOptimalCombination(allCandidates, clampedSize);
  const portfolioScore =
    optimalPortfolio.length > 0
      ? optimalPortfolio.reduce((sum, c) => sum + c.score, 0) / optimalPortfolio.length
      : 0;

  return {
    optimalPortfolio,
    portfolioScore: Math.round(portfolioScore * 1000) / 1000,
    allCandidates,
    constraints,
    portfolioRationale: buildPortfolioRationale(optimalPortfolio, constraints),
    rankedAt: scenario.rankedAt,
  };
}

// ── Internal helpers ───────────────────────────────────────────────────────────

function validateCandidateCount(ids: string[]): void {
  if (ids.length < 1) throw new ValidationError('At least one asteroid ID is required');
  if (ids.length > MAX_CANDIDATES) {
    throw new ValidationError(`Maximum ${MAX_CANDIDATES} candidates per request`);
  }
}

async function fetchAsteroids(ids: string[]): Promise<AsteroidRow[]> {
  return Promise.all(ids.map((id) => getAsteroidById(id)));
}

async function runNavigatorsInParallel(
  asteroids: AsteroidRow[],
  missionParams: MissionParams,
): Promise<Array<{ asteroid: AsteroidRow; navOutput: NavigatorOutput }>> {
  const results = await Promise.all(
    asteroids.map(async (asteroid) => {
      const stubState: SwarmState = {
        asteroidId: asteroid.id,
        missionParams,
        requestedAgents: ['navigator'] as AgentType[],
        phase: 'idle',
        errors: [],
        handoffTriggered: false,
      };
      const { output } = await runNavigator(asteroid, stubState, missionParams);
      return { asteroid, navOutput: output };
    }),
  );
  return results;
}

// ── Scoring ────────────────────────────────────────────────────────────────────

const ACCESSIBILITY_SCORES: Record<NavigatorOutput['accessibilityRating'], number> = {
  exceptional: 1.0,
  good: 0.75,
  marginal: 0.4,
  inaccessible: 0.0,
};

function economicTierScore(tier: string | null): number {
  switch (tier) {
    case 'tier1': return 1.0;
    case 'tier2': return 0.75;
    case 'tier3': return 0.5;
    default:      return 0.25;
  }
}

function checkConstraintViolations(
  navOutput: NavigatorOutput,
  constraints: MissionConstraints,
): string[] {
  const violations: string[] = [];

  if (
    constraints.maxDeltaV_kms != null &&
    navOutput.minDeltaV_kms != null &&
    navOutput.minDeltaV_kms > constraints.maxDeltaV_kms
  ) {
    violations.push(
      `Delta-V ${navOutput.minDeltaV_kms} km/s exceeds budget of ${constraints.maxDeltaV_kms} km/s`,
    );
  }

  if (constraints.missionWindowStart != null || constraints.missionWindowEnd != null) {
    if (navOutput.bestLaunchWindows.length > 0) {
      const windowStart = constraints.missionWindowStart
        ? new Date(constraints.missionWindowStart)
        : null;
      const windowEnd = constraints.missionWindowEnd
        ? new Date(constraints.missionWindowEnd)
        : null;
      const anyFit = navOutput.bestLaunchWindows.some((w) => {
        const d = new Date(w.date);
        if (windowStart != null && d < windowStart) return false;
        if (windowEnd != null && d > windowEnd) return false;
        return true;
      });
      if (!anyFit) {
        violations.push('No launch windows fall within the specified mission window');
      }
    }
    // If no launch windows at all, we cannot verify compliance — not a hard violation
  }

  return violations;
}

function scoreCandidate(
  asteroid: AsteroidRow,
  navOutput: NavigatorOutput,
  constraints: MissionConstraints,
): Omit<CandidateScore, 'rank'> {
  const violations = checkConstraintViolations(navOutput, constraints);
  const passesConstraints = violations.length === 0;

  const accessibilityScore = ACCESSIBILITY_SCORES[navOutput.accessibilityRating];
  const economicsScore = economicTierScore(asteroid.economic_tier);
  const constraintSatisfaction = passesConstraints
    ? 1.0
    : Math.max(0, 1.0 - violations.length * 0.5);

  // Normalize priority weights (default: accessibility=0.5, economics=0.3, risk=0.2)
  const rawWeights = constraints.priorities ?? { accessibility: 0.5, economics: 0.3, risk: 0.2 };
  const weightSum = rawWeights.accessibility + rawWeights.economics + rawWeights.risk;
  const safeSum = weightSum > 0 ? weightSum : 1;
  const weights = {
    accessibility: rawWeights.accessibility / safeSum,
    economics: rawWeights.economics / safeSum,
    risk: rawWeights.risk / safeSum,
  };

  const score =
    weights.accessibility * accessibilityScore +
    weights.economics * economicsScore +
    weights.risk * constraintSatisfaction;

  const asteroidName = asteroid.name ?? asteroid.full_name ?? asteroid.nasa_id;

  return {
    asteroidId: asteroid.id,
    asteroidName,
    accessibilityRating: navOutput.accessibilityRating,
    minDeltaV_kms: navOutput.minDeltaV_kms,
    missionDurationDays: navOutput.missionDurationDays,
    orbitalClass: navOutput.orbitalClass,
    score: Math.round(score * 1000) / 1000,
    scoreBreakdown: {
      accessibility: accessibilityScore,
      economics: economicsScore,
      constraintSatisfaction,
    },
    rationale: buildCandidateRationale(asteroidName, navOutput, passesConstraints, violations),
    navigatorOutput: navOutput,
    passesConstraints,
    constraintViolations: violations,
  };
}

function rankCandidates(
  scored: Array<Omit<CandidateScore, 'rank'>>,
): CandidateScore[] {
  const sorted = [...scored].sort((a, b) => {
    // Candidates that pass all constraints come first
    if (a.passesConstraints !== b.passesConstraints) {
      return a.passesConstraints ? -1 : 1;
    }
    // Within each group, sort by composite score descending
    return b.score - a.score;
  });
  return sorted.map((c, i): CandidateScore => ({ ...c, rank: i + 1 }));
}

// ── Portfolio optimization ─────────────────────────────────────────────────────

function findOptimalCombination(candidates: CandidateScore[], size: number): CandidateScore[] {
  if (candidates.length <= size) return candidates;

  // Brute-force combinations — feasible for ≤10 candidates and size ≤5
  const combos = getCombinations(candidates, size);
  let bestScore = -Infinity;
  let bestCombo: CandidateScore[] = candidates.slice(0, size);

  for (const combo of combos) {
    const avgScore = combo.reduce((sum, c) => sum + c.score, 0) / size;
    const diversityBonus = orbitalDiversityBonus(combo);
    const totalScore = avgScore + diversityBonus;
    if (totalScore > bestScore) {
      bestScore = totalScore;
      bestCombo = combo;
    }
  }

  return bestCombo;
}

function getCombinations<T>(arr: T[], size: number): T[][] {
  if (size === 0) return [[]];
  if (arr.length === 0) return [];
  const [first, ...rest] = arr;
  // `first` is T | undefined when array is empty, but we guard above
  if (first === undefined) return [];
  const withFirst = getCombinations(rest, size - 1).map((combo) => [first, ...combo]);
  const withoutFirst = getCombinations(rest, size);
  return [...withFirst, ...withoutFirst];
}

function orbitalDiversityBonus(combo: CandidateScore[]): number {
  // Small bonus for orbital class diversity (max 0.05)
  const classes = new Set(combo.map((c) => c.orbitalClass));
  return Math.min(0.05, (classes.size - 1) * 0.02);
}

// ── Rationale builders ─────────────────────────────────────────────────────────

function buildCandidateRationale(
  name: string,
  navOutput: NavigatorOutput,
  passesConstraints: boolean,
  violations: string[],
): string {
  const parts: string[] = [`${name}: ${navOutput.accessibilityRating} accessibility`];

  if (navOutput.minDeltaV_kms != null) {
    parts.push(`${navOutput.minDeltaV_kms} km/s delta-V`);
  }
  if (navOutput.missionDurationDays != null) {
    parts.push(`${navOutput.missionDurationDays}-day mission`);
  }
  if (!passesConstraints && violations.length > 0) {
    parts.push(`Violations: ${violations.join('; ')}`);
  }
  return parts.join(' · ');
}

function buildPortfolioRationale(
  combo: CandidateScore[],
  constraints: MissionConstraints,
): string {
  if (combo.length === 0) return 'No candidates available.';
  const names = combo.map((c) => c.asteroidName).join(', ');
  const feasible = combo.filter((c) => c.passesConstraints).length;
  const maxDvNote =
    constraints.maxDeltaV_kms != null
      ? ` within ${constraints.maxDeltaV_kms} km/s delta-V budget`
      : '';
  return (
    `Optimal ${combo.length}-asteroid portfolio: ${names}. ` +
    `${feasible}/${combo.length} candidates satisfy all constraints${maxDvNote}. ` +
    `Selected for highest combined accessibility and resource potential.`
  );
}

// ── Constraint ↔ MissionParams adapters ───────────────────────────────────────

function missionParamsToConstraints(params: MissionParams): MissionConstraints {
  return {
    maxDeltaV_kms: params.maxDeltaV_kms,
    missionWindowStart: params.missionWindowStart,
    missionWindowEnd: params.missionWindowEnd,
    missionType: params.missionType,
  };
}

function constraintsToMissionParams(constraints: MissionConstraints): MissionParams {
  return {
    maxDeltaV_kms: constraints.maxDeltaV_kms,
    missionWindowStart: constraints.missionWindowStart,
    missionWindowEnd: constraints.missionWindowEnd,
    missionType: constraints.missionType,
  };
}
