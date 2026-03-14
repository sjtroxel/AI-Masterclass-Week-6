// ─────────────────────────────────────────────────────────────────────────────
// Asteroid Bonanza — Shared Type Definitions
// .d.ts (not .ts) prevents rootDir expansion when referenced across workspaces.
// ─────────────────────────────────────────────────────────────────────────────

// ── Asteroid core ─────────────────────────────────────────────────────────────

export interface Asteroid {
  id: string;
  nasa_id: string;
  name: string;
  designation: string | null;
  // Orbital classification
  orbit_class: OrbitClass;
  is_potentially_hazardous: boolean;
  // Physical parameters (nullable — not all asteroids are well-characterized)
  diameter_min_km: number | null;
  diameter_max_km: number | null;
  absolute_magnitude: number | null;
  // Spectral / composition
  spectral_type: string | null;
  // AI-generated fields — nullable until Phase 5
  composition_summary: string | null;
  resource_potential: ResourcePotential | null;
  embedding: number[] | null;
  // Timestamps
  created_at: string;
  updated_at: string;
}

export type OrbitClass =
  | 'Apollo'
  | 'Aten'
  | 'Amor'
  | 'Atira'
  | 'IMB'
  | 'MBA'
  | 'OMB'
  | 'TJN'
  | 'CEN'
  | 'TNO'
  | 'PAA'
  | 'HYA';

export type ResourcePotential = 'very_high' | 'high' | 'moderate' | 'low' | 'unknown';

// ── Close approaches ──────────────────────────────────────────────────────────

export interface CloseApproach {
  id: string;
  asteroid_id: string;
  close_approach_date: string; // ISO date string
  miss_distance_km: number;
  relative_velocity_km_s: number;
  orbiting_body: string;
}

// ── Confidence scoring ────────────────────────────────────────────────────────

export interface ConfidenceScore {
  orbital: number;       // 0–1: confidence in orbital accessibility data
  composition: number;   // 0–1: confidence in spectral/composition data
  economics: number;     // 0–1: confidence in economic value estimates
  risk: number;          // 0–1: confidence in risk assessment
  aggregate: number;     // 0–1: weighted mean
}

// ── SwarmState ────────────────────────────────────────────────────────────────
// Agents communicate only through this shared state object.
// Each agent writes to its designated slice only.

export interface SwarmState {
  asteroid_id: string;
  orbital: OrbitalAnalysis | null;
  composition: CompositionAnalysis | null;
  economics: EconomicsAnalysis | null;
  risk: RiskAnalysis | null;
  synthesis: SwarmSynthesis | null;
  handoff: HandoffPackage | null;
}

// ── Agent output interfaces ───────────────────────────────────────────────────

export type AgentStatus = 'success' | 'partial' | 'failed';

export interface OrbitalAnalysis {
  status: AgentStatus;
  confidence: Pick<ConfidenceScore, 'orbital'>;
  sources: string[];
  delta_v_km_s: number | null;
  synodic_period_days: number | null;
  next_launch_window: string | null; // ISO date string
  mission_duration_days: number | null;
  accessibility_tier: 'easy' | 'moderate' | 'difficult' | 'very_difficult' | null;
  summary: string;
}

export interface CompositionAnalysis {
  status: AgentStatus;
  confidence: Pick<ConfidenceScore, 'composition'>;
  sources: string[];
  spectral_class: string | null;
  inferred_composition: string[];
  water_ice_probability: number | null; // 0–1
  metal_content_estimate: 'high' | 'moderate' | 'low' | 'unknown';
  summary: string;
}

export interface EconomicsAnalysis {
  status: AgentStatus;
  confidence: Pick<ConfidenceScore, 'economics'>;
  sources: string[];
  estimated_value_usd_low: number | null;
  estimated_value_usd_high: number | null;
  primary_resources: string[];
  viability_2050: 'high' | 'moderate' | 'low' | 'insufficient_data';
  summary: string;
}

export interface RiskAnalysis {
  status: AgentStatus;
  confidence: Pick<ConfidenceScore, 'risk'>;
  sources: string[];
  // Planetary defense
  torino_scale: number | null;       // 0–10
  palermo_scale: number | null;      // log scale
  impact_probability: number | null; // 0–1
  // Mission risk
  mission_risk_tier: 'low' | 'moderate' | 'high' | 'very_high' | null;
  summary: string;
}

export interface SwarmSynthesis {
  confidence: ConfidenceScore;
  recommendation: string;
  key_findings: string[];
  caveats: string[];
  generated_at: string; // ISO datetime
}

export interface HandoffPackage {
  triggered_by: 'low_confidence' | 'data_gap' | 'agent_failure';
  aggregate_confidence: number;
  what_was_found: string;
  confidence_breakdown: ConfidenceScore;
  where_confidence_broke_down: string;
  what_human_expert_needs: string;
  generated_at: string;
}

// ── RAG ───────────────────────────────────────────────────────────────────────

export interface RagChunk {
  id: string;
  content: string;
  source_title: string;
  source_url: string | null;
  chunk_index: number;
  embedding: number[] | null;
  created_at: string;
}

// ── API responses ─────────────────────────────────────────────────────────────

export interface ApiError {
  error: {
    code: string;
    message: string;
  };
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  per_page: number;
}
