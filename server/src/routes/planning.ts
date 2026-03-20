/**
 * routes/planning.ts
 *
 * Mission planning endpoints.
 *
 * POST /api/planning/compare
 *   Run Navigator across multiple candidates in parallel; return ranked list.
 *   Body: { asteroidIds: string[], missionParams?: MissionParams }
 *
 * POST /api/planning/scenario
 *   Accept mission constraints and priorities; return ranked recommendations.
 *   Body: { asteroidIds: string[], constraints?: MissionConstraints }
 *
 * POST /api/planning/portfolio
 *   Find the optimal K-asteroid combination within constraints.
 *   Body: { asteroidIds: string[], constraints?: MissionConstraints, portfolioSize?: number }
 */

import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { compareAsteroids, buildScenario, optimizePortfolio } from '../services/planningService.js';
import { getAsteroidById, getAsteroidByNasaId } from '../services/asteroidService.js';
import { ValidationError } from '../errors/AppError.js';
import type { MissionParams, MissionConstraints } from '../../../shared/types.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function resolveAsteroidUuid(id: string): Promise<string> {
  const asteroid = UUID_RE.test(id)
    ? await getAsteroidById(id)
    : await getAsteroidByNasaId(id);
  return asteroid.id;
}

async function resolveAllUuids(ids: string[]): Promise<string[]> {
  return Promise.all(ids.map(resolveAsteroidUuid));
}

const router = Router();

// ── POST /api/planning/compare ────────────────────────────────────────────────

router.post('/compare', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = req.body as { asteroidIds?: unknown; missionParams?: MissionParams };

    const asteroidIds = await resolveAllUuids(validateAsteroidIds(body.asteroidIds));
    const missionParams: MissionParams = body.missionParams ?? {};

    const result = await compareAsteroids(asteroidIds, missionParams);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ── POST /api/planning/scenario ───────────────────────────────────────────────

router.post('/scenario', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = req.body as { asteroidIds?: unknown; constraints?: MissionConstraints };

    const asteroidIds = await resolveAllUuids(validateAsteroidIds(body.asteroidIds));
    const constraints: MissionConstraints = body.constraints ?? {};

    const result = await buildScenario(asteroidIds, constraints);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ── POST /api/planning/portfolio ──────────────────────────────────────────────

router.post('/portfolio', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = req.body as {
      asteroidIds?: unknown;
      constraints?: MissionConstraints;
      portfolioSize?: unknown;
    };

    const asteroidIds = await resolveAllUuids(validateAsteroidIds(body.asteroidIds));
    const constraints: MissionConstraints = body.constraints ?? {};
    const portfolioSize = validatePortfolioSize(body.portfolioSize);

    const result = await optimizePortfolio(asteroidIds, constraints, portfolioSize);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ── Shared validators ─────────────────────────────────────────────────────────

const MAX_ASTEROID_IDS = 50;

function validateAsteroidIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    throw new ValidationError('asteroidIds must be an array of strings');
  }
  if (value.length === 0) {
    throw new ValidationError('asteroidIds must not be empty');
  }
  if (value.length > MAX_ASTEROID_IDS) {
    throw new ValidationError(`asteroidIds may contain at most ${MAX_ASTEROID_IDS} entries`);
  }
  if (value.some((id) => typeof id !== 'string' || id.trim() === '')) {
    throw new ValidationError('Each asteroidId must be a non-empty string');
  }
  return value as string[];
}

function validatePortfolioSize(value: unknown): number {
  if (value == null) return 3; // default
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) {
    throw new ValidationError('portfolioSize must be a positive integer');
  }
  return n;
}

export default router;
