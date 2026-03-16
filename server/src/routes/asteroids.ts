import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import {
  listAsteroids,
  getAsteroidById,
  getAsteroidByNasaId,
  type AsteroidFilters,
} from '../services/asteroidService.js';
import { searchAsteroids } from '../services/searchService.js';
import { ValidationError } from '../errors/AppError.js';

const router = Router();

// GET /api/asteroids/search?q=&count=&threshold=
// Semantic search via Voyage AI embeddings + pgvector.
// Must be registered before /:id so Express doesn't treat "search" as an id.
router.get('/search', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = req.query['q'];
    if (typeof q !== 'string' || q.trim().length === 0) {
      throw new ValidationError('Query parameter "q" is required and cannot be empty');
    }

    const count = req.query['count']
      ? Math.min(100, Math.max(1, parseInt(String(req.query['count']), 10)))
      : 20;

    const threshold = req.query['threshold']
      ? parseFloat(String(req.query['threshold']))
      : 0.3;

    const result = await searchAsteroids(q.trim(), count, threshold);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/asteroids
// Query params: page, per_page, is_pha, nhats_accessible, spectral_type
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Math.max(1, parseInt(String(req.query['page'] ?? '1'), 10));
    const perPage = Math.min(
      100,
      Math.max(1, parseInt(String(req.query['per_page'] ?? '20'), 10)),
    );

    const VALID_SORT_COLUMNS = ['name', 'absolute_magnitude_h', 'diameter_min_km', 'next_approach_date', 'nhats_min_delta_v_kms', 'has_real_name'] as const;

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
    if (typeof req.query['sort_by'] === 'string' &&
        (VALID_SORT_COLUMNS as readonly string[]).includes(req.query['sort_by'])) {
      filters.sort_by = req.query['sort_by'] as AsteroidFilters['sort_by'];
    }
    if (req.query['sort_dir'] === 'asc' || req.query['sort_dir'] === 'desc') {
      filters.sort_dir = req.query['sort_dir'];
    }
    if (req.query['include_orbital'] !== undefined) {
      filters.include_orbital = req.query['include_orbital'] === 'true';
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
