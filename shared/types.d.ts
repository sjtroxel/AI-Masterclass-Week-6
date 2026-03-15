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

// ── Mission parameters (user inputs to the swarm) ─────────────────────────────

export interface MissionParams {
  maxDeltaV_kms?: number;       // Max acceptable delta-V budget (km/s)
  missionWindowStart?: string;  // ISO date — earliest acceptable launch
  missionWindowEnd?: string;    // ISO date — latest acceptable launch
  missionType?: 'flyby' | 'rendezvous' | 'sample_return' | 'mining';
}

// ── Agent types ───────────────────────────────────────────────────────────────

export type AgentType = 'navigator' | 'geologist' | 'economist' | 'riskAssessor';

// ── Swarm phase state machine ─────────────────────────────────────────────────

export type SwarmPhase =
  | 'idle'
  | 'navigating'
  | 'geologizing'
  | 'economizing'
  | 'risk_assessing'
  | 'synthesizing'
  | 'complete'
  | 'handoff'
  | 'error';

// ── Confidence scoring ────────────────────────────────────────────────────────
// Computed by the Orchestrator from observable fields — never self-reported by agents.

export interface ConfidenceScores {
  orbital: number;          // 0–1: Navigator's certainty about accessibility data
  compositional: number;    // 0–1: Geologist's certainty about mineral content
  economic: number;         // 0–1: Economist's certainty about value model
  risk: number;             // 0–1: Risk Assessor's certainty about hazard assessment
  overall: number;          // Weighted average — compared against HANDOFF_THRESHOLD
}

// ── Agent output primitives ───────────────────────────────────────────────────

export interface NumberRange {
  min: number;
  max: number;
}

export interface LaunchWindow {
  date: string;         // ISO date of launch opportunity
  deltaV_kms: number;
  missionDurationDays: number;
  notes?: string;
}

export interface ResourceHighlight {
  resource: string;     // e.g. "water ice", "platinum-group metals"
  significance: string; // Why this is notable for this specific asteroid
}

export interface ValueDriver {
  driver: string;
  impact: 'high' | 'moderate' | 'low';
  description: string;
}

export interface EconomicRisk {
  risk: string;
  severity: 'critical' | 'significant' | 'moderate' | 'minor';
  description: string;
}

export interface MissionRisk {
  risk: string;
  severity: 'critical' | 'high' | 'moderate' | 'low';
  mitigation?: string;
}

export interface AgentError {
  agent: AgentType;
  message: string;
  code: string;
  recoverable: boolean;
}

// ── Navigator Agent output ────────────────────────────────────────────────────

export interface NavigatorOutput {
  accessibilityRating: 'exceptional' | 'good' | 'marginal' | 'inaccessible';
  minDeltaV_kms: number | null;
  bestLaunchWindows: LaunchWindow[];
  missionDurationDays: number | null;
  orbitalClass: string;
  dataCompleteness: number;       // 0–1: how much NHATS/approach data was available
  assumptionsRequired: string[];  // What the agent had to assume due to missing data
  reasoning: string;              // Plain-language explanation for the user
  sources: string[];              // source_id strings from RAG chunks used
}

// ── Geologist Agent output ────────────────────────────────────────────────────

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
  keyResources: ResourceHighlight[];
  compositionConfidence: 'well_characterized' | 'estimated' | 'uncertain' | 'unknown';
  analogAsteroids: string[];      // Real asteroids with similar profiles
  dataCompleteness: number;
  assumptionsRequired: string[];
  reasoning: string;
  sources: string[];
}

// ── Economist Agent output ────────────────────────────────────────────────────

export interface EconomistOutput {
  totalResourceValueUSD: NumberRange;
  terrestrialExportValue: NumberRange;
  inSpaceUtilizationValue: NumberRange;
  missionROI: 'exceptional' | 'positive' | 'marginal' | 'negative' | 'unmodelable';
  keyValueDrivers: ValueDriver[];
  keyRisks: EconomicRisk[];
  scenarioAssumptions: string[];
  dataCompleteness: number;
  assumptionsRequired: string[];
  reasoning: string;
  disclaimer: string;            // Always present: "These are 2050 projections..."
  sources: string[];
}

// ── Risk Assessor Agent output ────────────────────────────────────────────────

export interface RiskOutput {
  planetaryDefense: {
    isPHA: boolean;
    hazardRating: 'none' | 'negligible' | 'low' | 'moderate' | 'elevated' | 'high';
    monitoringStatus: string;
    notableApproaches: CloseApproach[];
    mitigationContext: string;
  };
  missionRisk: {
    overallRating: 'low' | 'moderate' | 'high' | 'extreme';
    communicationDelayMinutes: NumberRange;
    surfaceConditions: string;
    primaryRisks: MissionRisk[];
  };
  dataCompleteness: number;
  assumptionsRequired: string[];
  reasoning: string;
  sources: string[];
}

// ── Handoff packet ────────────────────────────────────────────────────────────

export interface HandoffPacket {
  triggeredBy: 'low_confidence' | 'data_gap' | 'agent_failure';
  aggregateConfidence: number;
  whatWasFound: string;
  confidenceBreakdown: ConfidenceScores;
  whereConfidenceBrokDown: string;
  whatHumanExpertNeeds: string;
  generatedAt: string;        // ISO datetime
}

// ── SwarmState ────────────────────────────────────────────────────────────────
// Agents communicate only through this shared state object.
// Each agent writes to its designated output field only.
// The Orchestrator reads all fields and writes synthesis/handoff.

export interface SwarmState {
  // Input
  asteroidId: string;
  missionParams: MissionParams;
  requestedAgents: AgentType[];

  // Agent outputs (undefined until that agent has run)
  navigatorOutput?: NavigatorOutput;
  geologistOutput?: GeologistOutput;
  economistOutput?: EconomistOutput;
  riskOutput?: RiskOutput;

  // Orchestration control
  phase: SwarmPhase;
  errors: AgentError[];

  // Final outputs
  synthesis?: string;
  confidenceScores?: ConfidenceScores;
  handoffTriggered: boolean;
  handoffPacket?: HandoffPacket;
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

/** A retrieved chunk with similarity score and index label — returned by ragService. */
export interface RagResult {
  id: string;
  source_id: string;
  source_title: string;
  source_url: string | null;
  source_year: number;
  chunk_index: number;
  content: string;
  metadata: Record<string, unknown>;
  similarity: number;
  /** Which knowledge index this chunk came from. */
  source_type: 'science' | 'scenario';
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

// ── Analysis persistence (analyses table) ─────────────────────────────────────

export type AnalysisStatus = 'pending' | 'running' | 'complete' | 'handoff' | 'error';

export interface Analysis {
  id: string;
  asteroid_id: string;
  status: AnalysisStatus;
  phase: SwarmPhase;
  navigator_output: NavigatorOutput | null;
  geologist_output: GeologistOutput | null;
  economist_output: EconomistOutput | null;
  risk_output: RiskOutput | null;
  confidence_scores: ConfidenceScores | null;
  synthesis: string | null;
  handoff_packet: HandoffPacket | null;
  created_at: string;
  updated_at: string;
}
