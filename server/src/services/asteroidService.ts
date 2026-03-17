import { supabase } from '../db/supabase.js';
import { DatabaseError, NotFoundError } from '../errors/AppError.js';
import type { PaginatedResponse } from '../../../shared/types.js';

// Row shape returned from the asteroids table.
// Mirrors the DB schema; AI fields are included as nullable.
export interface AsteroidRow {
  id: string;
  nasa_id: string;
  spkid: string | null;
  full_name: string | null;
  name: string | null;
  designation: string | null;
  is_pha: boolean;
  is_sentry_object: boolean;
  absolute_magnitude_h: number | null;
  diameter_min_km: number | null;
  diameter_max_km: number | null;
  diameter_sigma_km: number | null;
  spectral_type_smass: string | null;
  spectral_type_tholen: string | null;
  orbit_epoch_jd: number | null;
  semi_major_axis_au: number | null;
  eccentricity: number | null;
  inclination_deg: number | null;
  longitude_asc_node_deg: number | null;
  argument_perihelion_deg: number | null;
  mean_anomaly_deg: number | null;
  perihelion_distance_au: number | null;
  aphelion_distance_au: number | null;
  orbital_period_yr: number | null;
  min_orbit_intersection_au: number | null;
  nhats_accessible: boolean | null;
  nhats_min_delta_v_kms: number | null;
  nhats_min_duration_days: number | null;
  next_approach_date: string | null;
  next_approach_au: number | null;
  next_approach_miss_km: number | null;
  closest_approach_date: string | null;
  closest_approach_au: number | null;
  composition_summary: string | null;
  resource_profile: Record<string, unknown> | null;
  economic_tier: string | null;
  created_at: string;
  updated_at: string;
}

// Columns returned on list endpoints (omits heavy/nullable AI fields)
const LIST_COLUMNS = [
  'id', 'nasa_id', 'full_name', 'name', 'designation',
  'is_pha', 'is_sentry_object', 'absolute_magnitude_h',
  'diameter_min_km', 'diameter_max_km',
  'spectral_type_smass', 'spectral_type_tholen',
  'min_orbit_intersection_au',
  'nhats_accessible', 'nhats_min_delta_v_kms',
  'next_approach_date', 'next_approach_au',
  'economic_tier', 'has_real_name', 'created_at', 'updated_at',
].join(', ');

// Columns for orbital canvas: list columns + orbital elements
const ORBITAL_COLUMNS = LIST_COLUMNS + ', semi_major_axis_au, eccentricity, inclination_deg, longitude_asc_node_deg, argument_perihelion_deg, mean_anomaly_deg';

const _VALID_SORT_COLUMNS = [
  'name',
  'absolute_magnitude_h',
  'diameter_min_km',
  'next_approach_date',
  'nhats_min_delta_v_kms',
  'has_real_name',
] as const;
type SortColumn = (typeof _VALID_SORT_COLUMNS)[number];

export interface AsteroidFilters {
  is_pha?: boolean;
  nhats_accessible?: boolean;
  spectral_type?: string;
  sort_by?: SortColumn;
  sort_dir?: 'asc' | 'desc';
  include_orbital?: boolean;
}

export async function listAsteroids(
  page: number,
  perPage: number,
  filters: AsteroidFilters,
): Promise<PaginatedResponse<Partial<AsteroidRow>>> {
  const columns = filters.include_orbital ? ORBITAL_COLUMNS : LIST_COLUMNS;
  let query = supabase
    .from('asteroids')
    .select(columns, { count: 'exact' });

  if (filters.is_pha !== undefined) {
    query = query.eq('is_pha', filters.is_pha);
  }
  if (filters.nhats_accessible !== undefined) {
    query = query.eq('nhats_accessible', filters.nhats_accessible);
  }
  if (filters.spectral_type) {
    query = query.eq('spectral_type_smass', filters.spectral_type);
  }

  // When sorting by next approach date, exclude asteroids whose approach has
  // already passed. Use yesterday as the cutoff (not today) to be robust against
  // server clock drift — a same-day approach is still relevant.
  if (filters.sort_by === 'next_approach_date') {
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().split('T')[0]!;
    query = query.gt('next_approach_date', yesterday);
  }

  const from = (page - 1) * perPage;
  const to = from + perPage - 1;

  // Named-first sort: partition by has_real_name DESC (named first),
  // then alphabetical by name within each partition.
  let sortedQuery;
  if (filters.sort_by === 'has_real_name') {
    const nameAscending = (filters.sort_dir ?? 'asc') === 'asc';
    sortedQuery = query
      .order('has_real_name', { ascending: false, nullsFirst: false })
      .order('name', { ascending: nameAscending, nullsFirst: false });
  } else {
    const sortColumn = filters.sort_by ?? 'absolute_magnitude_h';
    const ascending = (filters.sort_dir ?? 'asc') === 'asc';
    sortedQuery = query.order(sortColumn, { ascending, nullsFirst: false });
  }

  const { data, error, count } = await sortedQuery.range(from, to);

  if (error) throw new DatabaseError(error.message);

  return {
    data: (data ?? []) as Partial<AsteroidRow>[],
    total: count ?? 0,
    page,
    per_page: perPage,
  };
}

export async function getAsteroidById(id: string): Promise<AsteroidRow> {
  const { data, error } = await supabase
    .from('asteroids')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') throw new NotFoundError(`Asteroid not found: ${id}`);
    throw new DatabaseError(error.message);
  }

  return data as AsteroidRow;
}

export async function getAsteroidByNasaId(nasaId: string): Promise<AsteroidRow> {
  const { data, error } = await supabase
    .from('asteroids')
    .select('*')
    .eq('nasa_id', nasaId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') throw new NotFoundError(`Asteroid not found: ${nasaId}`);
    throw new DatabaseError(error.message);
  }

  return data as AsteroidRow;
}
