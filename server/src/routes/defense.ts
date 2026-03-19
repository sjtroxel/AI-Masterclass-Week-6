/**
 * routes/defense.ts
 *
 * Planetary Defense Watch endpoints.
 *
 * GET /api/defense/pha
 *   All asteroids flagged is_pha=true, sorted by next approach date.
 *   Query params: days (filter PHAs with next_approach_date within N days; default: all)
 *
 * GET /api/defense/upcoming
 *   Asteroids with next_approach_date within the next N days.
 *   Query params: days (default 365, max 3650)
 *
 * GET /api/defense/apophis
 *   Full data for Apophis (nasa_id 99942) — the 2029 featured case study.
 */

import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { getPhaList, getUpcomingApproaches, getApophis, getRiskAssessment } from '../services/defenseService.js';
import { ValidationError } from '../errors/AppError.js';
import { cacheFor } from '../middleware/cache.js';

const router = Router();

// ── GET /api/defense/pha ──────────────────────────────────────────────────────

router.get('/pha', cacheFor(10 * 60), async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const phas = await getPhaList();
    res.json({ data: phas, total: phas.length });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/defense/upcoming ─────────────────────────────────────────────────

router.get('/upcoming', cacheFor(5 * 60), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rawDays = req.query['days'];
    let days = 365;
    if (rawDays !== undefined) {
      days = parseInt(String(rawDays), 10);
      if (isNaN(days) || days < 1 || days > 3650) {
        throw new ValidationError('days must be an integer between 1 and 3650');
      }
    }

    const approaches = await getUpcomingApproaches(days);
    res.json({ data: approaches, total: approaches.length, days });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/defense/apophis ──────────────────────────────────────────────────

router.get('/apophis', cacheFor(60 * 60), async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const apophis = await getApophis();
    res.json(apophis);
  } catch (err) {
    next(err);
  }
});

// ── GET /api/defense/risk/:nasaId ─────────────────────────────────────────────

router.get('/risk/:nasaId', cacheFor(5 * 60), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { nasaId } = req.params as { nasaId: string };
    const result = await getRiskAssessment(nasaId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
