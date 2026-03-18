/**
 * defenseService.ts
 *
 * Data layer for the Planetary Defense Watch endpoints.
 * All queries target the asteroids table; close approach data is denormalized there.
 */

import { supabase } from '../db/supabase.js';
import { DatabaseError, NotFoundError } from '../errors/AppError.js';
import type { PhaListItem, UpcomingApproach, ApophisDetail } from '../../../shared/types.js';
import type { AsteroidRow } from './asteroidService.js';

// Columns for PHA list and upcoming approaches
const PHA_COLUMNS = [
  'nasa_id', 'name', 'full_name', 'is_sentry_object',
  'diameter_min_km', 'diameter_max_km', 'absolute_magnitude_h',
  'min_orbit_intersection_au',
  'next_approach_date', 'next_approach_miss_km',
  'closest_approach_date', 'closest_approach_au',
].join(', ');

const UPCOMING_COLUMNS = [
  'nasa_id', 'name', 'full_name', 'is_pha', 'is_sentry_object',
  'diameter_min_km', 'diameter_max_km',
  'next_approach_date', 'next_approach_miss_km',
].join(', ');

const APOPHIS_COLUMNS = [
  'nasa_id', 'name', 'full_name', 'is_pha', 'is_sentry_object',
  'diameter_min_km', 'diameter_max_km', 'absolute_magnitude_h',
  'spectral_type_smass', 'min_orbit_intersection_au',
  'semi_major_axis_au', 'eccentricity', 'inclination_deg', 'orbital_period_yr',
  'nhats_accessible', 'nhats_min_delta_v_kms',
  'next_approach_date', 'next_approach_miss_km',
  'closest_approach_date', 'closest_approach_au',
].join(', ');

const APOPHIS_NASA_ID = '99942';

// ── getPhaList ─────────────────────────────────────────────────────────────────

export async function getPhaList(): Promise<PhaListItem[]> {
  // Exclude PHAs whose next_approach_date has already passed.
  // Use yesterday as the cutoff (not today) to be robust against server clock drift.
  // PHAs with null next_approach_date are retained — they are not stale, just unmapped.
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().split('T')[0]!;

  const { data, error } = await supabase
    .from('asteroids')
    .select(PHA_COLUMNS)
    .eq('is_pha', true)
    .or(`next_approach_date.is.null,next_approach_date.gt.${yesterday}`)
    .order('next_approach_date', { ascending: true, nullsFirst: false });

  if (error) {
    throw new DatabaseError(`Failed to fetch PHA list: ${error.message}`);
  }

  const rows = (data ?? []) as Partial<AsteroidRow>[];
  return rows.map((row) => ({
    nasa_id: row.nasa_id ?? '',
    name: row.name ?? null,
    full_name: row.full_name ?? null,
    is_sentry_object: row.is_sentry_object ?? false,
    diameter_min_km: row.diameter_min_km ?? null,
    diameter_max_km: row.diameter_max_km ?? null,
    absolute_magnitude_h: row.absolute_magnitude_h ?? null,
    min_orbit_intersection_au: row.min_orbit_intersection_au ?? null,
    next_approach_date: row.next_approach_date ?? null,
    next_approach_miss_km: row.next_approach_miss_km ?? null,
    closest_approach_date: row.closest_approach_date ?? null,
    closest_approach_au: row.closest_approach_au ?? null,
    hazard_rating: null, // AI analysis not yet surfaced here — populated in future phase
  }));
}

// ── getUpcomingApproaches ──────────────────────────────────────────────────────

export async function getUpcomingApproaches(days: number = 365): Promise<UpcomingApproach[]> {
  // Use yesterday as lower bound (not today) to be robust against server clock
  // drift — a same-day approach is still relevant. Cutoff is N days from now.
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().split('T')[0]!;
  const cutoff = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().split('T')[0]!;

  const { data, error } = await supabase
    .from('asteroids')
    .select(UPCOMING_COLUMNS)
    .gt('next_approach_date', yesterday)
    .lte('next_approach_date', cutoff)
    .order('next_approach_date', { ascending: true });

  if (error) {
    throw new DatabaseError(`Failed to fetch upcoming approaches: ${error.message}`);
  }

  const rows = (data ?? []) as Partial<AsteroidRow>[];
  return rows.map((row) => ({
    nasa_id: row.nasa_id ?? '',
    name: row.name ?? null,
    full_name: row.full_name ?? null,
    is_pha: row.is_pha ?? false,
    is_sentry_object: row.is_sentry_object ?? false,
    diameter_min_km: row.diameter_min_km ?? null,
    diameter_max_km: row.diameter_max_km ?? null,
    next_approach_date: row.next_approach_date ?? '',
    next_approach_miss_km: row.next_approach_miss_km ?? null,
  }));
}

// ── getApophis ─────────────────────────────────────────────────────────────────

export async function getApophis(): Promise<ApophisDetail> {
  const { data, error } = await supabase
    .from('asteroids')
    .select(APOPHIS_COLUMNS)
    .eq('nasa_id', APOPHIS_NASA_ID)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      throw new NotFoundError('Apophis (99942) not found in database');
    }
    throw new DatabaseError(`Failed to fetch Apophis: ${error.message}`);
  }

  const row = data as Partial<AsteroidRow>;
  return {
    nasa_id: row.nasa_id ?? '',
    name: row.name ?? null,
    full_name: row.full_name ?? null,
    is_pha: row.is_pha ?? false,
    is_sentry_object: row.is_sentry_object ?? false,
    diameter_min_km: row.diameter_min_km ?? null,
    diameter_max_km: row.diameter_max_km ?? null,
    absolute_magnitude_h: row.absolute_magnitude_h ?? null,
    spectral_type_smass: row.spectral_type_smass ?? null,
    min_orbit_intersection_au: row.min_orbit_intersection_au ?? null,
    semi_major_axis_au: row.semi_major_axis_au ?? null,
    eccentricity: row.eccentricity ?? null,
    inclination_deg: row.inclination_deg ?? null,
    orbital_period_yr: row.orbital_period_yr ?? null,
    nhats_accessible: row.nhats_accessible ?? null,
    nhats_min_delta_v_kms: row.nhats_min_delta_v_kms ?? null,
    next_approach_date: row.next_approach_date ?? null,
    next_approach_miss_km: row.next_approach_miss_km ?? null,
    closest_approach_date: row.closest_approach_date ?? null,
    closest_approach_au: row.closest_approach_au ?? null,
  };
}
