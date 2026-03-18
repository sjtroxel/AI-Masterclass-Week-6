/**
 * defenseService.ts
 *
 * Data layer for the Planetary Defense Watch endpoints.
 * All queries target the asteroids table; close approach data is denormalized there.
 */

import { supabase } from '../db/supabase.js';
import { DatabaseError, NotFoundError } from '../errors/AppError.js';
import type { PhaListItem, UpcomingApproach, ApophisDetail, RiskOutput } from '../../../shared/types.js';
import { getAsteroidByNasaId } from './asteroidService.js';
import type { AsteroidRow } from './asteroidService.js';

export interface DefenseRiskResponse {
  nasaId: string;
  asteroidName: string | null;
  analysisId: string;
  analysisCreatedAt: string;
  riskOutput: RiskOutput;
}

// Columns for PHA list and upcoming approaches
// Include 'id' so we can join with the analyses table for hazard_rating.
const PHA_COLUMNS = [
  'id', 'nasa_id', 'name', 'full_name', 'is_sentry_object',
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

const APOPHIS_NASA_ID = '2099942';

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

  const rows = (data ?? []) as Partial<AsteroidRow & { id: string }>[];
  if (rows.length === 0) return [];

  // Fetch the latest risk_output for each PHA from the analyses table.
  // A second query is cheaper than N per-card lookups on the frontend.
  const asteroidIds = rows.map((r) => r.id).filter((id): id is string => !!id);
  const riskMap = new Map<string, RiskOutput['planetaryDefense']['hazardRating']>();

  if (asteroidIds.length > 0) {
    const { data: analyses } = await supabase
      .from('analyses')
      .select('asteroid_id, risk_output')
      .in('asteroid_id', asteroidIds)
      .in('status', ['complete', 'handoff'])
      .not('risk_output', 'is', null)
      .order('created_at', { ascending: false });

    // Build asteroid_id → hazard_rating map; keep only the most recent per asteroid.
    for (const row of (analyses ?? []) as { asteroid_id: string; risk_output: unknown }[]) {
      if (!riskMap.has(row.asteroid_id)) {
        const ro = row.risk_output as RiskOutput | null;
        if (ro?.planetaryDefense?.hazardRating) {
          riskMap.set(row.asteroid_id, ro.planetaryDefense.hazardRating);
        }
      }
    }
  }

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
    hazard_rating: riskMap.get(row.id ?? '') ?? null,
  }));
}

// ── getRiskAssessment ──────────────────────────────────────────────────────────

export async function getRiskAssessment(nasaId: string): Promise<DefenseRiskResponse> {
  // Resolve the asteroid UUID from its nasa_id.
  const asteroid = await getAsteroidByNasaId(nasaId);

  const { data, error } = await supabase
    .from('analyses')
    .select('id, asteroid_id, risk_output, created_at')
    .eq('asteroid_id', asteroid.id)
    .in('status', ['complete', 'handoff'])
    .not('risk_output', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      throw new NotFoundError(`No risk assessment found for asteroid ${nasaId}`);
    }
    throw new DatabaseError(`Failed to fetch risk assessment: ${error.message}`);
  }

  const row = data as { id: string; risk_output: unknown; created_at: string };
  const riskOutput = row.risk_output as RiskOutput;

  if (!riskOutput?.planetaryDefense) {
    throw new NotFoundError(`No risk assessment found for asteroid ${nasaId}`);
  }

  return {
    nasaId,
    asteroidName: asteroid.name ?? asteroid.full_name ?? null,
    analysisId: row.id,
    analysisCreatedAt: row.created_at,
    riskOutput,
  };
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
      throw new NotFoundError('Apophis (2099942) not found in database');
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
