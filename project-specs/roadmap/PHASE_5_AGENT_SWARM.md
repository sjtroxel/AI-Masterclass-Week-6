# Phase 5 — The Agent Swarm

**Goal**: Full four-agent swarm with orchestration, confidence scoring, handoff logic, and AI enrichment back-fill.

**Status**: In progress — core swarm built and type-checked; tests + backfill script remain.

**This is the most complex phase. Take the time it needs.**

---

## Architecture Reference

See `AI_ARCHITECTURE.md` for the complete agent design: state object, orchestrator routing logic, agent signatures, and all four structured output types. Read it fully before writing any agent code.

---

## Deliverables

### Pre-work
- [x] `SwarmState` interface finalized in `shared/types.d.ts` — reconciled with AI_ARCHITECTURE.md (slice names `navigatorOutput`, `geologistOutput`, `economistOutput`, `riskOutput`, `phase`, `errors`, `confidenceScores`, `handoffTriggered`, `handoffPacket`, `missionParams`, `requestedAgents`)
- [x] All agent output interfaces finalized in `shared/types.d.ts`: `NavigatorOutput`, `GeologistOutput`, `EconomistOutput`, `RiskOutput`, plus supporting primitives `NumberRange`, `LaunchWindow`, `ResourceHighlight`, `ValueDriver`, `EconomicRisk`, `MissionRisk`, `AgentError`
- [x] `ConfidenceScores`, `HandoffPacket`, `MissionParams`, `AgentType`, `SwarmPhase` types finalized
- [x] `shared/models.d.ts` + `shared/models.js` — `SONNET` / `HAIKU` constants; ambient `.d.ts` + hand-written `.js` pattern avoids rootDir expansion
- [x] `0006_analyses.sql` migration — `analyses` table with UUID pk, `asteroid_id` FK (CASCADE), `status`/`phase` enums, jsonb agent output columns, updated_at trigger, RLS public-read policy, two indexes. **Run in Supabase SQL Editor: done.**

### Observability Infrastructure
- [x] `orchestrator/agentLogger.ts` — structured event logger. Typed events: `input`, `tool_call`, `tool_result`, `rag_lookup`, `output`, `error`. Each timestamped. `getTrace()` returns `AgentTrace` included in every API response.

### Tool Implementations
- [x] `orchestrator/tools.ts` — all four tool implementations + Anthropic tool definitions:
  - `fetch_nhats_data` / `FETCH_NHATS_TOOL` → JPL NHATS via `NHATSService`
  - `fetch_close_approaches` / `FETCH_CLOSE_APPROACHES_TOOL` → JPL CAD via `CADService`
  - `query_science_index` / `QUERY_SCIENCE_INDEX_TOOL` → science RAG via `ragService`
  - `query_scenario_index` / `QUERY_SCENARIO_INDEX_TOOL` → scenario RAG via `ragService`
  - RAG tools return both the API result and raw chunks for observability logging

### Agents
- [x] `orchestrator/navigator.ts` — orbital mechanics and mission accessibility
  - Tools: `fetch_nhats_data`, `fetch_close_approaches`, `submit_navigator_analysis` (forced output)
  - Agentic loop with `submit_*` pattern (forced-choice output tool — more reliable than parsing text JSON)
  - Logs every tool call, result, and RAG lookup via `AgentLogger`
- [x] `orchestrator/geologist.ts` — spectral analysis and mineral composition estimation
  - Tools: `query_science_index`, `submit_geologist_analysis`
  - RAG lookup logs include similarity scores and chunk previews
- [x] `orchestrator/riskAssessor.ts` — planetary defense and mission risk
  - Tools: `fetch_close_approaches`, `query_science_index`, `submit_risk_analysis`
  - Runs in parallel with Geologist (both independent of each other)
- [x] `orchestrator/economist.ts` — resource value modeling (depends on Geologist output)
  - Tools: `query_scenario_index`, `query_science_index`, `submit_economist_analysis`
  - Consumes `geologistOutput.compositionEstimate` and `navigatorOutput` from SwarmState
  - 2050 projections must come from scenario RAG; enforced in system prompt + `assumptionsRequired`

### Orchestrator
- [x] `orchestrator/orchestrator.ts` — state machine controller
  - Routing: Navigator → (Geologist ∥ Risk Assessor) → Economist → confidence → synthesis/handoff
  - Parallel dispatch: Geologist + Risk run simultaneously via `Promise.allSettled`
  - Sequential constraint: Economist runs after Geologist (enforced by ordering)
  - `ConfidenceScores` computation — deterministic formula: `dataCompleteness` − assumption penalty (5% per assumption, capped at 30%), never self-reported
  - `HANDOFF_THRESHOLD = 0.55` — calibrate empirically after 20–30 real analyses
  - `HandoffPacket` construction when `overall < HANDOFF_THRESHOLD` — first-class feature, not error state
  - Synthesis pass via Claude Sonnet 4.6 when confidence is sufficient
  - Analysis persisted to `analyses` table (create on start, update on phase change, final persist on complete/handoff)
  - Returns `OrchestratorResult` with full `SwarmTrace` (all agent traces + confidence inputs + latencies)

### API Endpoints
- [x] `POST /api/analysis/:asteroidId` — trigger full swarm analysis; returns complete result (synchronous long-poll, 30–90s)
- [x] `GET /api/analysis/:asteroidId/latest` — fetch most recent complete/handoff analysis from DB
- [x] `GET /api/analysis/record/:analysisId` — fetch raw analysis record by ID
- [ ] `GET /api/analysis/:asteroidId/stream` — SSE stream of per-agent progress (deferred: current synchronous approach works; SSE is a Phase 8 polish item if needed)

### Frontend
- [x] `features/analysis/analysis.component.ts` — full mobile-first analysis page at `/analysis/:id`
  - Idle state: trigger button with swarm description
  - Running state: spinner + per-agent phase indicator cards
  - Confidence score bars: all four dimensions + overall, color-coded (green ≥70%, amber ≥50%, red <50%)
  - Four agent result cards: Navigator, Geologist, Economist, Risk Assessor
  - Synthesis section (when `state === 'complete'`)
  - Handoff packet card with breakdown (when `state === 'handoff'`)
  - Collapsible observability trace: agent latencies + all events with type badges
  - Checks for existing analysis on load; shows results immediately if found
- [x] `app.routes.ts` — `/analysis/:id` route wired, lazy-loaded
- [x] `dossier.component.ts` — "Pending analysis" placeholders replaced with "Analyze →" links to `/analysis/:id` in Composition and Resource Economics sections
- [x] `api.service.ts` — `triggerAnalysis()`, `getLatestAnalysis()`, full analysis type definitions

### AI Enrichment Back-fill
- [ ] `scripts/backfillCompositions.ts` — runs Geologist Agent across all asteroids; populates `composition_summary`, `resource_profile`, `economic_tier` on the `asteroids` table
- [ ] Run back-fill after agents are proven working on 5–10 individual asteroids
- [ ] After back-fill: dossier pages show real AI content instead of "Analyze →" prompts

### HANDOFF_THRESHOLD Calibration
- [ ] After first 20–30 real analyses, review outputs
- [ ] Identify which results genuinely needed expert review vs. which were false positives
- [ ] Adjust threshold value and document reasoning in this file

### Tests
**Not yet written. Required before Phase 5 exit.**

- [ ] `server/tests/unit/navigator.test.ts`
  - Mock Anthropic SDK: stub `messages.create` to return a `submit_navigator_analysis` tool_use block with a fixture payload
  - Assert `NavigatorOutput` structure conforms to interface (all required fields present, `dataCompleteness` in 0–1, `assumptionsRequired` is string array)
  - Test the agentic loop: stub two turns (one tool call + one submit) and verify both are handled
  - `vi.resetAllMocks()` in `beforeEach`

- [ ] `server/tests/unit/geologist.test.ts` — same pattern: mock Anthropic + `queryRag`, assert `GeologistOutput` structure, verify RAG lookup is logged

- [ ] `server/tests/unit/riskAssessor.test.ts` — same pattern

- [ ] `server/tests/unit/economist.test.ts` — verify Economist reads `geologistOutput` from state, assert `EconomistOutput.disclaimer` is always present

- [ ] `server/tests/unit/orchestrator.test.ts`
  - Mock all four agent runner functions; supply fixture outputs
  - Test confidence computation formula: known `dataCompleteness` inputs → expected `ConfidenceScores`
  - Test handoff trigger: supply overall < 0.55 → `HandoffPacket` returned, `state.phase === 'handoff'`
  - Test synthesis path: supply overall ≥ 0.55, mock synthesis Claude call → `state.synthesis` populated
  - Test parallel execution: `runGeologist` and `runRiskAssessor` called before `runEconomist`

- [ ] `server/tests/integration/analysis.test.ts`
  - Supertest against `app.ts` (never `server.ts`)
  - Mock Anthropic SDK + Supabase + NHATSService + CADService
  - `POST /api/analysis/:asteroidId` → 200 with correct shape
  - `GET /api/analysis/:asteroidId/latest` → 404 when no analysis exists
  - Agent error recovery: one agent throws → others still complete, `errors` array populated

- [ ] E2E `client/e2e/analysis.spec.ts` — 375px + 1280px viewports
  - Navigate to `/dossier/:id` → click "Analyze →" → lands on `/analysis/:id`
  - "Run Agent Swarm Analysis" button visible and tappable at 375px
  - After (mocked) completion: confidence bars render, synthesis text present
  - Handoff banner visible when `handoffTriggered: true`

---

## What's Left Before Phase 5 Exit Condition

1. **Write the tests** (listed above) — the most important remaining item
2. **Run 5–10 real analyses** on actual asteroids to verify the swarm works end-to-end
3. **Calibrate `HANDOFF_THRESHOLD`** based on real outputs
4. **Write and run `backfillCompositions.ts`** so dossier pages show real AI data
5. **Verify mobile layout** of analysis component at 375px (run `/mobile-review`)

**Exit condition**: A full four-agent analysis completes for a real asteroid, persists to the database, and displays correctly on mobile and desktop. The back-fill script has run and dossier pages show real composition data.

---

*Phase document created: 2026-03-13 — updated: 2026-03-15 (core swarm, orchestrator, API, and frontend complete; tests + backfill remain)*
