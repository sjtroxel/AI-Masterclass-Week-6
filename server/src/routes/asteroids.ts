import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import {
  listAsteroids,
  getAsteroidById,
  getAsteroidByNasaId,
  type AsteroidFilters,
} from '../services/asteroidService.js';

const router = Router();

// GET /api/asteroids
// Query params: page, per_page, is_pha, nhats_accessible, spectral_type
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Math.max(1, parseInt(String(req.query['page'] ?? '1'), 10));
    const perPage = Math.min(
      100,
      Math.max(1, parseInt(String(req.query['per_page'] ?? '20'), 10)),
    );

    const filters: AsteroidFilters = {};

    if (req.query['is_pha'] !== undefined) {
      filters.is_pha = req.query['is_pha'] === 'true';
    }
    if (req.query['nhats_accessible'] !== undefined) {
      filters.nhats_accessible = req.query['nhats_accessible'] === 'true';
    }
    if (typeof req.query['spectral_type'] === 'string') {
      filters.spectral_type = req.query['spectral_type'];
    }

    const result = await listAsteroids(page, perPage, filters);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/asteroids/:id
// :id can be either the internal UUID or a NASA integer ID
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rawId = req.params['id'];
    // Express 5 types allow string | string[]; route params are always scalar strings.
    const id = Array.isArray(rawId) ? rawId[0] : rawId;
    if (!id) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Missing id' } });
      return;
    }

    // UUID format → look up by internal id; otherwise treat as nasa_id
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    const asteroid = isUuid
      ? await getAsteroidById(id)
      : await getAsteroidByNasaId(id);

    res.json(asteroid);
  } catch (err) {
    next(err);
  }
});

export default router;
