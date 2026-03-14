/**
 * api.service.ts
 *
 * The single HTTP boundary for all server calls. No component may call
 * HttpClient directly — all requests go through this service.
 */

import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

// ── Response types ────────────────────────────────────────────────────────────
// Defined inline to avoid cross-workspace import issues with Angular's build system.

export interface AsteroidListItem {
  id: string;
  nasa_id: string;
  full_name: string | null;
  name: string | null;
  designation: string | null;
  is_pha: boolean;
  is_sentry_object: boolean;
  absolute_magnitude_h: number | null;
  diameter_min_km: number | null;
  diameter_max_km: number | null;
  spectral_type_smass: string | null;
  spectral_type_tholen: string | null;
  min_orbit_intersection_au: number | null;
  nhats_accessible: boolean | null;
  nhats_min_delta_v_kms: number | null;
  next_approach_date: string | null;
  next_approach_au: number | null;
  economic_tier: string | null;
  created_at: string;
  updated_at: string;
}

export interface AsteroidDetail extends AsteroidListItem {
  spkid: string | null;
  diameter_sigma_km: number | null;
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
  nhats_min_duration_days: number | null;
  next_approach_miss_km: number | null;
  closest_approach_date: string | null;
  closest_approach_au: number | null;
  composition_summary: string | null;
  resource_profile: Record<string, unknown> | null;
}

export interface AsteroidSearchResult extends AsteroidListItem {
  similarity: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  per_page: number;
}

export interface AsteroidFilters {
  is_pha?: boolean;
  nhats_accessible?: boolean;
  spectral_type?: string;
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly base = '/api';

  listAsteroids(
    page: number,
    perPage: number,
    filters: AsteroidFilters = {},
  ): Observable<PaginatedResponse<AsteroidListItem>> {
    let params = new HttpParams()
      .set('page', String(page))
      .set('per_page', String(perPage));

    if (filters.is_pha !== undefined) {
      params = params.set('is_pha', String(filters.is_pha));
    }
    if (filters.nhats_accessible !== undefined) {
      params = params.set('nhats_accessible', String(filters.nhats_accessible));
    }
    if (filters.spectral_type) {
      params = params.set('spectral_type', filters.spectral_type);
    }

    return this.http.get<PaginatedResponse<AsteroidListItem>>(
      `${this.base}/asteroids`,
      { params },
    );
  }

  searchAsteroids(
    query: string,
    count = 20,
  ): Observable<PaginatedResponse<AsteroidSearchResult>> {
    const params = new HttpParams()
      .set('q', query)
      .set('count', String(count));

    return this.http.get<PaginatedResponse<AsteroidSearchResult>>(
      `${this.base}/asteroids/search`,
      { params },
    );
  }

  getAsteroid(id: string): Observable<AsteroidDetail> {
    return this.http.get<AsteroidDetail>(`${this.base}/asteroids/${id}`);
  }
}
