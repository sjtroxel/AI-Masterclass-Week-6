# Phase 5 — The Agent Swarm

**Goal**: Full four-agent swarm with orchestration, confidence scoring, handoff logic, and AI enrichment back-fill.

**Status**: Not started

**This is the most complex phase. Take the time it needs.**

---

## Architecture Reference

See `03_AI_ARCHITECTURE.md` for the complete agent design: state object, orchestrator routing logic, agent signatures, and all four structured output types. Read it fully before writing any agent code.

---

## Deliverables

### Types
- [ ] `SwarmState` interface finalized in `shared/types.d.ts`
- [ ] All agent output interfaces finalized: `NavigatorOutput`, `GeologistOutput`, `EconomistOutput`, `RiskOutput`
- [ ] `ConfidenceScores`, `HandoffPacket`, `MissionParams` types finalized

### Agents
- [ ] `navigatorAgent.ts` — orbital mechanics and mission accessibility
- [ ] `geologistAgent.ts` — spectral analysis and mineral composition estimation
- [ ] `economistAgent.ts` — resource value modeling (depends on Geologist output)
- [ ] `riskAgent.ts` — planetary defense and mission risk

### Orchestrator
- [ ] `orchestrator.ts` — state machine: routes, dispatches in parallel where possible, synthesizes
- [ ] Parallel dispatch: Geologist + Risk run simultaneously (they are independent)
- [ ] Sequential constraint: Economist runs after Geologist (needs composition data)
- [ ] `ConfidenceScores` computation — deterministic formula from agent uncertainty fields, never self-reported
- [ ] `HandoffPacket` construction when `overall < HANDOFF_THRESHOLD` (starting value: 0.55)
- [ ] Synthesis pass via Claude Sonnet 4.6 when confidence is sufficient
- [ ] Analysis persisted to `analyses` table

### API Endpoints
- [ ] `POST /api/analysis/start` — enqueue analysis, return `analysis_id`
- [ ] `GET /api/analysis/:id` — poll for status and result
- [ ] `GET /api/analysis/:id/stream` — SSE stream of agent progress
- [ ] `GET /api/asteroids/:id/analyses` — cached previous analyses

### Frontend
- [ ] Analysis panel:
  - Mobile: sequential card reveal as each agent completes
  - Desktop: side-by-side agent panels with live progress
- [ ] Agent progress component — shows which phase is running ("Navigator Agent running...")
- [ ] Confidence score visualization — all four scores + overall, always visible
- [ ] Handoff banner — unmistakably clear on both mobile and desktop when triggered

### AI Enrichment Back-fill
- [ ] `scripts/backfillCompositions.ts` — runs Geologist Agent across all 35k asteroids, populates `composition_summary`, `resource_profile`, `economic_tier`
- [ ] Run back-fill after agents are proven working on individual asteroids
- [ ] After back-fill: dossier pages show real AI content instead of "Pending analysis"

### HANDOFF_THRESHOLD Calibration
- [ ] After first 20–30 real analyses, review outputs
- [ ] Identify which results genuinely needed expert review vs. which were false positives
- [ ] Adjust threshold value and document reasoning in this file

### Tests
- [ ] Agent output tests: known asteroid inputs → validate output *structure* (not content) conforms to TypeScript interface, confidence fields within 0–1 bounds
- [ ] Mock isolation: `vi.resetAllMocks()` + explicit `.mockReset()` on Supabase and Anthropic mocks in every `beforeEach`
- [ ] E2E: request analysis → watch agent progress → read synthesis
- [ ] E2E: low-confidence result triggers handoff banner

**Exit condition**: A full four-agent analysis completes for a real asteroid, persists to the database, and displays correctly on mobile and desktop. The back-fill script has run and dossier pages show real composition data.

---

*Phase document created: 2026-03-13*
