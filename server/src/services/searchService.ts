import { supabase } from '../db/supabase.js';
import { embedText } from './voyageService.js';
import { DatabaseError, ValidationError } from '../errors/AppError.js';
import type { PaginatedResponse } from '../../../shared/types.js';
import type { AsteroidRow } from './asteroidService.js';

export interface AsteroidSearchResult extends Omit<AsteroidRow, 'embedding' | 'composition_summary' | 'resource_profile' | 'diameter_sigma_km' | 'orbit_epoch_jd' | 'semi_major_axis_au' | 'eccentricity' | 'inclination_deg' | 'longitude_asc_node_deg' | 'argument_perihelion_deg' | 'mean_anomaly_deg' | 'perihelion_distance_au' | 'aphelion_distance_au' | 'orbital_period_yr' | 'nhats_min_duration_days' | 'next_approach_miss_km' | 'closest_approach_date' | 'closest_approach_au' | 'spkid'> {
  similarity: number;
}

const MAX_COUNT = 100;
const DEFAULT_COUNT = 20;
const DEFAULT_THRESHOLD = 0.3;

export async function searchAsteroids(
  query: string,
  count: number = DEFAULT_COUNT,
  threshold: number = DEFAULT_THRESHOLD,
): Promise<PaginatedResponse<AsteroidSearchResult>> {
  if (!query.trim()) throw new ValidationError('Search query cannot be empty');

  const safeCount = Math.min(MAX_COUNT, Math.max(1, count));
  const safeThreshold = Math.max(0, Math.min(1, threshold));

  const embedding = await embedText(query.trim());

  const { data, error } = await supabase.rpc('match_asteroids', {
    query_embedding: embedding,
    match_threshold: safeThreshold,
    match_count: safeCount,
  });

  if (error) throw new DatabaseError(error.message);

  const results = (data ?? []) as AsteroidSearchResult[];

  return {
    data: results,
    total: results.length,
    page: 1,
    per_page: safeCount,
  };
}
