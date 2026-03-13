# Asteroid Bonanza — AI Architecture

*The agent swarm, orchestration state machine, and RAG Analyst. Read this completely before writing any agent code.*

---

## Design Philosophy

The agent swarm is built on the Anthropic SDK directly — not LangChain or LangGraph. However, the architecture is conceptually isomorphic with LangGraph: there are **nodes** (agents), **edges** (routing logic), **state** (a typed object passed between agents), and **conditional routing** (the orchestrator decides which agents run and in what order based on current state and outputs).

Building this from scratch means we own every line of the orchestration. This is both more instructive and more auditable.

---

## The State Object

Every agent in the swarm reads from and writes to a shared, typed state object. No agent communicates with another agent directly — they communicate through state mutations. This is the **stateless reducer pattern** (12-Factor Agents Factor 12).

```typescript
// shared/types.d.ts

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

export interface ConfidenceScores {
  orbital: number;          // 0–1: Navigator's certainty about accessibility data
  compositional: number;    // 0–1: Geologist's certainty about mineral content
  economic: number;         // 0–1: Economist's certainty about value model
  risk: number;             // 0–1: Risk Assessor's certainty about hazard assessment
  overall: number;          // Weighted average
}
```

---

## The Lead Orchestrator

`orchestrator.ts` is the state machine controller. It does not do any analysis — it routes, sequences, and synthesizes.

**Routing logic:**
1. Receives a request with `asteroidId` and `missionParams`
2. Fetches asteroid data from database
3. Dispatches Navigator Agent → waits for output
4. Dispatches Geologist Agent in parallel with Risk Agent (they are independent)
5. Waits for both to complete
6. Dispatches Economist Agent (depends on Geologist output for composition data)
7. Computes `ConfidenceScores` across all four outputs
8. If `overall < HANDOFF_THRESHOLD` → build `HandoffPacket`, set phase to `'handoff'`
9. If `overall >= HANDOFF_THRESHOLD` → run synthesis pass (Claude Sonnet), set phase to `'complete'`
10. Persist to `analyses` table

**HANDOFF_THRESHOLD**: Initially set to `0.55`. This is a calibration value — it must be adjusted empirically after the system has produced real outputs. A threshold calibrated once at launch and never revisited leads to silent degradation. The threshold will be documented and reviewed.

**Confidence is not self-reported**: Following the principle from Class 5, agents do not produce a single holistic confidence number. Instead:
- Each agent produces a structured output with explicit uncertainty fields (e.g., `dataCompleteness`, `sourceQuality`, `assumptionsRequired`)
- The Orchestrator computes confidence scores from these fields using a deterministic formula
- LLMs are systematically overconfident due to RLHF — we never ask the model "how confident are you?" and take that number at face value

---

## Agent Function Signature

Each agent is a TypeScript function with a consistent signature:

```typescript
type AgentFn<TOutput> = (
  asteroid: AsteroidRecord,
  state: SwarmState,
  missionParams: MissionParams
) => Promise<TOutput>;
```

Each agent makes one or more Claude API calls (using tool use where appropriate), returns a typed structured output, and never calls another agent.

---

## Navigator Agent

**Domain**: Orbital mechanics and mission accessibility.

**Inputs consumed**:
- Asteroid orbital elements from database (`semi_major_axis_au`, `eccentricity`, `inclination_deg`, `orbital_class`)
- NHATS accessibility data fetched at runtime (delta-V budget, mission windows)
- `missionParams.maxDeltaV` (user constraint)
- `missionParams.missionWindow` (date range the user cares about)

**Claude's role**: Interpret NASA's pre-computed accessibility data in plain language. Reason about which close-approach windows are most favorable. Explain tradeoffs between mission duration and delta-V. The LLM does not calculate trajectories — it reasons about NASA's calculations.

**Tools available** (via Anthropic tool_use):
- `fetchNHATSData(asteroidId)` → returns JPL NHATS API response
- `fetchCloseApproaches(asteroidId, dateMin, dateMax)` → returns upcoming close approach windows

**Structured output**:
```typescript
interface NavigatorOutput {
  accessibilityRating: 'exceptional' | 'good' | 'marginal' | 'inaccessible';
  minDeltaV_kms: number | null;
  bestLaunchWindows: LaunchWindow[];
  missionDurationDays: number | null;
  orbitalClass: string;
  dataCompleteness: number;    // 0–1: how much NHATS data was available
  assumptionsRequired: string[]; // What the agent had to assume due to missing data
  reasoning: string;             // Plain-language explanation for the user
}
```

---

## Geologist Agent

**Domain**: Spectral analysis and mineral composition estimation.

**Inputs consumed**:
- Asteroid spectral class from database (`spectral_class`)
- Physical parameters (diameter, albedo)
- Retrieved chunks from the science RAG index relevant to that spectral class

**Claude's role**: Translate spectral classification into an estimated resource profile. Spectral classes have known compositional correlations (C-type → water/organics, M-type → iron/nickel/platinum-group metals, S-type → silicates/metals). The LLM reasons about these correlations, acknowledges uncertainty ranges, and produces a plain-language resource profile.

**Tools available**:
- `queryScienceIndex(query)` → retrieves relevant science chunks about spectral composition

**Structured output**:
```typescript
interface GeologistOutput {
  spectralClass: string;
  compositionEstimate: {
    water_ice_pct: NumberRange;        // e.g. {min: 5, max: 25}
    carbonaceous_pct: NumberRange;
    silicate_pct: NumberRange;
    iron_nickel_pct: NumberRange;
    platinum_group_pct: NumberRange;   // Very small for most — but high value
    other_pct: NumberRange;
  };
  keyResources: ResourceHighlight[];   // What's notable about this asteroid specifically
  compositionConfidence: 'well_characterized' | 'estimated' | 'uncertain' | 'unknown';
  analogAsteroids: string[];           // Real asteroids with similar profiles for reference
  dataCompleteness: number;
  assumptionsRequired: string[];
  reasoning: string;
}
```

---

## Economist Agent

**Domain**: Resource value modeling in the 2050 scenario context.

**Inputs consumed**:
- `geologistOutput.compositionEstimate` (required — cannot run without Geologist completing first)
- `navigatorOutput.minDeltaV_kms` (mission cost input)
- `navigatorOutput.missionDurationDays`
- Asteroid diameter (total resource volume estimate)
- Retrieved chunks from the scenario RAG index (2050 market assumptions, ISRU economics, extraction technology projections)

**Claude's role**: Model the economics of extracting and utilizing the asteroid's resources in a 2050 context. This involves three separate value streams:
1. **Terrestrial export value** — platinum-group metals and rare elements that would be worth bringing back to Earth
2. **In-space utilization value** — water-ice for propellant depots, iron/nickel for orbital construction, without the cost of Earth return
3. **Strategic value** — resources that unlock further capabilities (fuel depots, construction materials for stations or habitats)

All 2050 economic projections must be sourced from the scenario RAG index. The agent cannot invent market prices. If insufficient scenario context is retrieved, `dataCompleteness` reflects this and `assumptionsRequired` is populated.

**Tools available**:
- `queryScenarioIndex(query)` → retrieves 2050 scenario chunks
- `queryScienceIndex(query)` → retrieves science chunks for cross-reference

**Structured output**:
```typescript
interface EconomistOutput {
  totalResourceValueUSD: NumberRange;       // Extremely wide range — always shown with bounds
  terrestrialExportValue: NumberRange;      // Only resources worth returning to Earth
  inSpaceUtilizationValue: NumberRange;     // Resources usable in orbit/deep space
  missionROI: 'exceptional' | 'positive' | 'marginal' | 'negative' | 'unmodelable';
  keyValueDrivers: ValueDriver[];           // What makes this asteroid economically interesting
  keyRisks: EconomicRisk[];                 // What could make the economics fail
  scenarioAssumptions: string[];            // Explicit 2050 assumptions used
  dataCompleteness: number;
  assumptionsRequired: string[];
  reasoning: string;
  disclaimer: string;                       // Always present: "These are 2050 projections..."
}
```

---

## Risk Assessor Agent

**Domain**: Planetary defense and mission risk.

**Inputs consumed**:
- PHA classification from database (`is_potentially_hazardous`)
- Close approach data (distances, dates)
- Orbital elements (for hazard assessment)
- `navigatorOutput` (mission risk is partly a function of how hard the object is to reach)
- Science RAG chunks on planetary defense and impact risk

**Claude's role**: Evaluate two separate risk dimensions. Planetary defense risk: how much of a threat does this object pose to Earth, and what is the monitoring/mitigation status? Mission risk: if we sent a spacecraft to this object, what are the operational challenges and failure modes?

**Tools available**:
- `fetchCloseApproaches(asteroidId, dateMin, dateMax)` → upcoming approaches
- `queryScienceIndex(query)` → planetary defense science

**Structured output**:
```typescript
interface RiskOutput {
  planetaryDefense: {
    isPHA: boolean;
    hazardRating: 'none' | 'negligible' | 'low' | 'moderate' | 'elevated' | 'high';
    monitoringStatus: string;              // Plain language on NASA's current tracking
    notableApproaches: CloseApproach[];   // Dates and distances of significant events
    mitigationContext: string;            // What deflection options exist, if relevant
  };
  missionRisk: {
    overallRating: 'low' | 'moderate' | 'high' | 'extreme';
    communicationDelayMinutes: NumberRange;
    surfaceConditions: string;            // What landing/mining on this type looks like
    primaryRisks: MissionRisk[];
  };
  dataCompleteness: number;
  assumptionsRequired: string[];
  reasoning: string;
}
```

---

## The AI Analyst

Separate from the swarm. A grounded RAG chatbot that answers open-ended questions about asteroid science and the 2050 space economy.

**Architecture**: Identical to Poster Pilot's Archivist — Server-Sent Events (SSE) for streaming, session history in `analyst_sessions`, Claude Sonnet 4.6 as the model.

**Grounding rules** (enforced in system prompt and architecturally):
- May only cite information retrieved from `science_chunks` or `scenario_chunks`
- Must clearly distinguish science (factual) from scenario (projection) in every response
- Must say "I don't have enough information to answer that accurately" when context is insufficient
- Cannot speculate about specific asteroid values or mission outcomes without retrieval support
- Cannot fabricate statistics, paper citations, or mission data

**Dual-index retrieval**: Every user query is embedded and matched against both indices simultaneously. The top-k results from each are included in context with their `source_type` label so the model knows which is science and which is scenario.

**Optional context anchoring**: When a user is viewing a specific asteroid's dossier, the Analyst receives that asteroid's data as additional context. "How much is this asteroid worth?" is answerable in context (within caveats) rather than as a generic question.

**Session management**: 24-hour TTL on sessions. Expired sessions are gracefully handled — the user is informed the session expired and a new one begins.

---

## RAG Knowledge Base — Initial Document Set

The following documents will be ingested into the knowledge base as Phase 3 work. This list will grow.

**Science Index (Hard Facts)**:
- NASA OSIRIS-REx Mission Final Report (Bennu composition and sample data)
- NASA Psyche Mission overview and spectral analysis papers
- Asteroid spectral classification surveys (Bus-DeMeo taxonomy)
- ESA HERA mission documentation (Dimorphos/DART impact assessment)
- Planetary Science Journal papers on near-Earth object composition
- JPL NHATS technical documentation

**Scenario Index (2050 Projections)**:
- NASA Planetary Science Vision 2050 roadmap
- NASA In-Situ Resource Utilization (ISRU) technology roadmap
- World Economic Forum Space Economy reports
- European Space Agency Space Resources Strategy documents
- Academic papers on asteroid mining economics and market models

**Chunking Strategy**: Document-structure chunking — respecting H1/H2/H3 hierarchy and keeping section headings attached to their content. Scientific papers use semantic chunking at the paragraph level with 50-token overlap. Maximum chunk size: 512 tokens.

---

*Document created: 2026-03-13*
