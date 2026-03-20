/**
 * api.service.ts
 *
 * The single HTTP boundary for all server calls. No component may call
 * HttpClient directly — all requests go through this service.
 */

import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { API_BASE_URL } from './env';

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
  has_real_name: boolean | null;
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

export interface AsteroidWithOrbital extends AsteroidListItem {
  semi_major_axis_au: number | null;
  eccentricity: number | null;
  inclination_deg: number | null;
  longitude_asc_node_deg: number | null;
  argument_perihelion_deg: number | null;
  mean_anomaly_deg: number | null;
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

export type SortColumn = 'name' | 'absolute_magnitude_h' | 'diameter_min_km' | 'next_approach_date' | 'nhats_min_delta_v_kms' | 'has_real_name';

export interface AsteroidFilters {
  is_pha?: boolean;
  nhats_accessible?: boolean;
  spectral_type?: string;
  sort_by?: SortColumn;
  sort_dir?: 'asc' | 'desc';
  include_orbital?: boolean;
}

// ── Analysis types ─────────────────────────────────────────────────────────────

export interface ConfidenceScores {
  orbital: number;
  compositional: number;
  economic: number;
  risk: number;
  overall: number;
}

export interface NumberRange { min: number; max: number; }

export interface NavigatorOutput {
  accessibilityRating: 'exceptional' | 'good' | 'marginal' | 'inaccessible';
  minDeltaV_kms: number | null;
  bestLaunchWindows: { date: string; deltaV_kms: number; missionDurationDays: number; notes?: string }[];
  missionDurationDays: number | null;
  orbitalClass: string;
  dataCompleteness: number;
  assumptionsRequired: string[];
  reasoning: string;
  sources: string[];
}

export interface GeologistOutput {
  spectralClass: string;
  compositionEstimate: {
    water_ice_pct: NumberRange;
    carbonaceous_pct: NumberRange;
    silicate_pct: NumberRange;
    iron_nickel_pct: NumberRange;
    platinum_group_pct: NumberRange;
    other_pct: NumberRange;
  };
  keyResources: { resource: string; significance: string }[];
  compositionConfidence: 'well_characterized' | 'estimated' | 'uncertain' | 'unknown';
  analogAsteroids: string[];
  dataCompleteness: number;
  assumptionsRequired: string[];
  reasoning: string;
  sources: string[];
}

export interface EconomistOutput {
  totalResourceValueUSD: NumberRange;
  terrestrialExportValue: NumberRange;
  inSpaceUtilizationValue: NumberRange;
  missionROI: 'exceptional' | 'positive' | 'marginal' | 'negative' | 'unmodelable';
  keyValueDrivers: { driver: string; impact: 'high' | 'moderate' | 'low'; description: string }[];
  keyRisks: { risk: string; severity: string; description: string }[];
  scenarioAssumptions: string[];
  dataCompleteness: number;
  assumptionsRequired: string[];
  reasoning: string;
  disclaimer: string;
  sources: string[];
}

export interface RiskOutput {
  planetaryDefense: {
    isPHA: boolean;
    hazardRating: 'none' | 'negligible' | 'low' | 'moderate' | 'elevated' | 'high';
    monitoringStatus: string;
    notableApproaches: { close_approach_date: string; miss_distance_km: number; orbiting_body: string }[];
    mitigationContext: string;
  };
  missionRisk: {
    overallRating: 'low' | 'moderate' | 'high' | 'extreme';
    communicationDelayMinutes: NumberRange;
    surfaceConditions: string;
    primaryRisks: { risk: string; severity: string; mitigation?: string }[];
  };
  dataCompleteness: number;
  assumptionsRequired: string[];
  reasoning: string;
  sources: string[];
}

export interface AgentEvent {
  type: 'input' | 'tool_call' | 'tool_result' | 'rag_lookup' | 'output' | 'error';
  agent: string;
  timestamp: string;
  [key: string]: unknown;
}

export interface AnalysisResponse {
  analysisId: string;
  asteroidId: string;
  status: 'pending' | 'running' | 'complete' | 'handoff' | 'error';
  phase: string;
  handoffTriggered: boolean;
  confidenceScores: ConfidenceScores | null;
  synthesis: string | null;
  handoffPacket: {
    triggeredBy: string;
    aggregateConfidence: number;
    whatWasFound: string;
    confidenceBreakdown: ConfidenceScores;
    whereConfidenceBrokDown: string;
    whatHumanExpertNeeds: string;
  } | null;
  outputs: {
    navigator: NavigatorOutput | null;
    geologist: GeologistOutput | null;
    economist: EconomistOutput | null;
    risk: RiskOutput | null;
  };
  trace: {
    totalLatencyMs: number;
    agentLatencies: Record<string, number | null>;
    confidenceInputs: Record<string, { dataCompleteness: number; assumptionsCount: number; agentSucceeded: boolean }>;
    agentEvents: Record<string, AgentEvent[]>;
  };
  errors: { agent: string; message: string; code: string }[];
}

// ── Planetary Defense types ────────────────────────────────────────────────────

export type HazardRating = 'none' | 'negligible' | 'low' | 'moderate' | 'elevated' | 'high';

export interface PhaListItem {
  nasa_id: string;
  name: string | null;
  full_name: string | null;
  is_sentry_object: boolean;
  diameter_min_km: number | null;
  diameter_max_km: number | null;
  absolute_magnitude_h: number | null;
  min_orbit_intersection_au: number | null;
  next_approach_date: string | null;
  next_approach_miss_km: number | null;
  closest_approach_date: string | null;
  closest_approach_au: number | null;
  hazard_rating: HazardRating | null;
}

export interface UpcomingApproach {
  nasa_id: string;
  name: string | null;
  full_name: string | null;
  is_pha: boolean;
  is_sentry_object: boolean;
  diameter_min_km: number | null;
  diameter_max_km: number | null;
  next_approach_date: string;
  next_approach_miss_km: number | null;
}

export interface DefenseListResponse<T> {
  data: T[];
  total: number;
}

export interface DefenseRiskResponse {
  nasaId: string;
  asteroidName: string | null;
  analysisId: string;
  analysisCreatedAt: string;
  riskOutput: RiskOutput;
}

export interface UpcomingResponse extends DefenseListResponse<UpcomingApproach> {
  days: number;
}

export interface ApophisDetail {
  nasa_id: string;
  name: string | null;
  full_name: string | null;
  is_pha: boolean;
  is_sentry_object: boolean;
  diameter_min_km: number | null;
  diameter_max_km: number | null;
  absolute_magnitude_h: number | null;
  spectral_type_smass: string | null;
  min_orbit_intersection_au: number | null;
  semi_major_axis_au: number | null;
  eccentricity: number | null;
  inclination_deg: number | null;
  orbital_period_yr: number | null;
  nhats_accessible: boolean | null;
  nhats_min_delta_v_kms: number | null;
  next_approach_date: string | null;
  next_approach_miss_km: number | null;
  closest_approach_date: string | null;
  closest_approach_au: number | null;
}

// ── Mission planning types ─────────────────────────────────────────────────────

export interface MissionConstraints {
  maxDeltaV_kms?: number;
  missionWindowStart?: string;
  missionWindowEnd?: string;
  missionType?: 'flyby' | 'rendezvous' | 'sample_return' | 'mining';
  priorities?: {
    accessibility: number;
    economics: number;
    risk: number;
  };
}

export interface CandidateScore {
  asteroidId: string;
  asteroidName: string;
  rank: number;
  accessibilityRating: 'exceptional' | 'good' | 'marginal' | 'inaccessible';
  minDeltaV_kms: number | null;
  missionDurationDays: number | null;
  orbitalClass: string;
  score: number;
  scoreBreakdown: {
    accessibility: number;
    economics: number;
    constraintSatisfaction: number;
  };
  rationale: string;
  navigatorOutput: NavigatorOutput;
  passesConstraints: boolean;
  constraintViolations: string[];
}

export interface ComparisonResponse {
  candidates: CandidateScore[];
  missionParams: {
    maxDeltaV_kms?: number;
    missionWindowStart?: string;
    missionWindowEnd?: string;
    missionType?: string;
  };
  rankedAt: string;
}

export interface ScenarioResponse {
  recommendations: CandidateScore[];
  constraints: MissionConstraints;
  topPick: CandidateScore | null;
  feasibleCount: number;
  rankedAt: string;
}

export interface PortfolioResponse {
  optimalPortfolio: CandidateScore[];
  portfolioScore: number;
  allCandidates: CandidateScore[];
  constraints: MissionConstraints;
  portfolioRationale: string;
  rankedAt: string;
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${API_BASE_URL}/api`;

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
    if (filters.sort_by) {
      params = params.set('sort_by', filters.sort_by);
    }
    if (filters.sort_dir) {
      params = params.set('sort_dir', filters.sort_dir);
    }

    return this.http.get<PaginatedResponse<AsteroidListItem>>(
      `${this.base}/asteroids`,
      { params },
    );
  }

  listAsteroidsWithOrbital(
    page: number,
    perPage: number,
    filters: Omit<AsteroidFilters, 'include_orbital'> = {},
  ): Observable<PaginatedResponse<AsteroidWithOrbital>> {
    let params = new HttpParams()
      .set('page', String(page))
      .set('per_page', String(perPage))
      .set('include_orbital', 'true');

    if (filters.is_pha !== undefined) {
      params = params.set('is_pha', String(filters.is_pha));
    }
    if (filters.nhats_accessible !== undefined) {
      params = params.set('nhats_accessible', String(filters.nhats_accessible));
    }
    if (filters.spectral_type) {
      params = params.set('spectral_type', filters.spectral_type);
    }
    if (filters.sort_by) {
      params = params.set('sort_by', filters.sort_by);
    }
    if (filters.sort_dir) {
      params = params.set('sort_dir', filters.sort_dir);
    }

    return this.http.get<PaginatedResponse<AsteroidWithOrbital>>(
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

  streamAnalysis(asteroidId: string): EventSource {
    return new EventSource(`${this.base}/analysis/${asteroidId}/stream`);
  }

  getLatestAnalysis(asteroidId: string): Observable<AnalysisResponse> {
    return this.http.get<AnalysisResponse>(`${this.base}/analysis/${asteroidId}/latest`);
  }

  // ── Mission planning ─────────────────────────────────────────────────────────

  compareAsteroids(
    asteroidIds: string[],
    constraints?: MissionConstraints,
  ): Observable<ComparisonResponse> {
    return this.http.post<ComparisonResponse>(`${this.base}/planning/compare`, {
      asteroidIds,
      missionParams: constraints,
    });
  }

  buildScenario(
    asteroidIds: string[],
    constraints?: MissionConstraints,
  ): Observable<ScenarioResponse> {
    return this.http.post<ScenarioResponse>(`${this.base}/planning/scenario`, {
      asteroidIds,
      constraints,
    });
  }

  buildPortfolio(
    asteroidIds: string[],
    constraints?: MissionConstraints,
    portfolioSize?: number,
  ): Observable<PortfolioResponse> {
    return this.http.post<PortfolioResponse>(`${this.base}/planning/portfolio`, {
      asteroidIds,
      constraints,
      ...(portfolioSize !== undefined && { portfolioSize }),
    });
  }

  // ── Planetary Defense ───────────────────────────────────────────────────────

  getPhaList(): Observable<DefenseListResponse<PhaListItem>> {
    return this.http.get<DefenseListResponse<PhaListItem>>(`${this.base}/defense/pha`);
  }

  getUpcomingApproaches(days = 365): Observable<UpcomingResponse> {
    const params = new HttpParams().set('days', String(days));
    return this.http.get<UpcomingResponse>(`${this.base}/defense/upcoming`, { params });
  }

  getApophis(): Observable<ApophisDetail> {
    return this.http.get<ApophisDetail>(`${this.base}/defense/apophis`);
  }

  getRiskAssessment(nasaId: string): Observable<DefenseRiskResponse> {
    return this.http.get<DefenseRiskResponse>(`${this.base}/defense/risk/${nasaId}`);
  }
}
