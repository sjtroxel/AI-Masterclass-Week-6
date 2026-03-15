# Phase 5 Handoff — Agent Swarm Remaining Work

*Written 2026-03-15 at end-of-session to brief the next Claude Code conversation.*

---

## What Was Built This Session (Do Not Rebuild)

The core Phase 5 agent swarm is complete and type-checks clean. Everything below exists:

```
shared/
  types.d.ts          — fully reconciled SwarmState + all 4 agent output interfaces
  models.d.ts         — SONNET / HAIKU constants (declaration)
  models.js           — SONNET / HAIKU constants (runtime ES module)

server/src/db/migrations/
  0006_analyses.sql   — analyses table, APPLIED IN SUPABASE (success, no rows)

server/src/services/orchestrator/
  agentLogger.ts      — structured event logger (AgentLogger class, AgentTrace type)
  tools.ts            — fetch_nhats_data, fetch_close_approaches, query_science_index, query_scenario_index
  navigator.ts        — Navigator agent, forced-output tool pattern
  geologist.ts        — Geologist agent
  riskAssessor.ts     — Risk Assessor agent
  economist.ts        — Economist agent (depends on geologistOutput in SwarmState)
  orchestrator.ts     — Lead Orchestrator: routing, parallel dispatch, confidence, handoff, synthesis, DB persist

server/src/routes/
  analysis.ts         — POST /api/analysis/:asteroidId, GET /api/analysis/:asteroidId/latest, GET /api/analysis/record/:analysisId
  (registered in app.ts as /api/analysis)

client/src/app/
  core/api.service.ts             — triggerAnalysis(), getLatestAnalysis(), all analysis types
  features/analysis/
    analysis.component.ts         — full mobile-first analysis page
  app.routes.ts                   — /analysis/:id route wired
  features/dossier/
    dossier.component.ts          — "Analyze →" links in Composition + Resource Economics sections
```

`npm run typecheck` passes clean across all workspaces.

---

## What Remains (Priority Order)

### 1. Tests — Most Important Gap

No tests exist for any Phase 5 code. The existing test pattern is in:
- `server/tests/unit/analystService.test.ts` — Vitest, Anthropic SDK mocked with `vi.mock('@anthropic-ai/sdk', ...)`, `vi.resetAllMocks()` in `beforeEach`
- `server/tests/integration/analyst.test.ts` — Supertest against `app.ts` (never `server.ts`)

**Files to create:**

#### `server/tests/unit/navigator.test.ts`
Mock Anthropic to return a 2-turn conversation: turn 1 = `tool_use` block for `fetch_nhats_data`, turn 2 = `tool_use` block for `submit_navigator_analysis` with a fixture `NavigatorOutput`. Also mock `NHATSService` and `CADService`. Assert:
- `output.accessibilityRating` is one of the valid enum values
- `output.dataCompleteness` is between 0 and 1
- `output.assumptionsRequired` is a string array
- `output.sources` is a string array
- `trace.events` contains at least one `tool_call` and one `output` event

#### `server/tests/unit/geologist.test.ts`
Mock Anthropic + `queryRag` (via `vi.mock('../../src/services/ragService.js', ...)`). Assert `GeologistOutput` structure, `compositionEstimate` has all 6 sub-fields each with `min`/`max`, `compositionConfidence` is a valid enum value, RAG lookup event appears in trace.

#### `server/tests/unit/riskAssessor.test.ts`
Same pattern. Assert `planetaryDefense.hazardRating` and `missionRisk.overallRating` are valid enums.

#### `server/tests/unit/economist.test.ts`
Key things to test:
- Reads `state.geologistOutput` — pass a state with a populated `geologistOutput`, verify the user message sent to Claude includes composition data
- `output.disclaimer` is always a non-empty string (MANDATORY per spec)
- `output.missionROI` is a valid enum value

#### `server/tests/unit/orchestrator.test.ts`
Most important unit test file. Mock all four runner functions: `vi.mock('../../src/services/orchestrator/navigator.js', ...)` etc. Supply fixture outputs. Test:
1. **Confidence formula** — `dataCompleteness: 1.0`, `assumptionsRequired: []` → score should be 1.0; `dataCompleteness: 0.8`, `assumptionsRequired: ['a','b','c']` (3 × 0.05 = 0.15 penalty) → score 0.65
2. **Handoff trigger** — engineer low confidence (all agents `dataCompleteness: 0.3`) → `state.handoffTriggered === true`, `state.handoffPacket` populated
3. **Synthesis path** — all agents `dataCompleteness: 1.0` → mock the synthesis Claude call, assert `state.synthesis` populated
4. **Parallel dispatch** — verify `runGeologist` and `runRiskAssessor` were called before `runEconomist` (check call order via mock)
5. **Agent error recovery** — make one agent mock reject, assert others still run, `state.errors` has one entry

#### `server/tests/integration/analysis.test.ts`
Supertest, mock Anthropic + Supabase + external APIs. Test:
- `POST /api/analysis/:asteroidId` with valid UUID → 200, response has `analysisId`, `confidenceScores`, `outputs`
- `GET /api/analysis/:asteroidId/latest` → 404 when no analysis in DB (mock Supabase to return `PGRST116`)
- `POST /api/analysis/:asteroidId` with unknown asteroid UUID → 404 from `getAsteroidById`

#### `client/e2e/analysis.spec.ts`
Playwright, both 375px × 812px and 1280px × 800px viewports (follow pattern from `client/e2e/search.spec.ts`). Tests:
- Navigate to `/dossier/:id` → "Analyze →" link is visible and tappable (44px touch target)
- Click "Analyze →" → lands on `/analysis/:id` with "Run Agent Swarm Analysis" button visible
- Button has min-h-[44px] at 375px (touch target check)
- (Mocked API response) After analysis: confidence bars render, synthesis section present
- Handoff banner visible when response has `handoffTriggered: true`

### 2. Run 5–10 Real Analyses

After tests pass, trigger real analyses against live asteroids to validate the full loop. Good test candidates:
- **Bennu** (NHATS accessible, C-type, well-characterized) — should produce high confidence
- **Apophis** (PHA, famous, 2029 approach) — should produce strong risk output
- A random unknown asteroid with sparse data — should produce a handoff

The Supabase `analyses` table is live and ready. Check results there after each run.

### 3. Calibrate HANDOFF_THRESHOLD

Currently `0.55` in `orchestrator/orchestrator.ts` line ~13. After 20–30 real analyses, review:
- How many triggered handoff? Were they genuinely low quality?
- How many sailed through? Were their syntheses actually well-grounded?
- Adjust the constant and document reasoning in `PHASE_5_AGENT_SWARM.md`

### 4. Backfill Script

Create `scripts/src/backfillCompositions.ts`. Pattern from existing scripts in `scripts/src/`:
- Read asteroids from DB in batches of 50
- For each asteroid: run just the Geologist agent (skip Navigator/Economist/Risk)
- Write `composition_summary`, `resource_profile`, `economic_tier` back to `asteroids` table
- Skip asteroids where `composition_summary` is already populated
- Rate-limit to avoid Anthropic API hammering (100ms delay between calls)
- Run AFTER 5–10 individual analyses confirm the Geologist is working correctly

After backfill runs, the "Analyze →" prompts on dossier pages show real AI content instead.

### 5. Mobile Review

Run `/mobile-review` on `client/src/app/features/analysis/analysis.component.ts`. Key things to check:
- "Run Agent Swarm Analysis" button: min-h-[44px] ✓ (already in template)
- Confidence score bars render correctly at 375px
- Agent cards stack properly in 1-col layout on mobile
- "Assumptions" `<details>` summary has min-h-[44px] touch target ✓ (already in template)
- Observability trace `<details>` summary has min-h-[44px] ✓ (already in template)
- Handoff packet card readable at 375px

---

## Key Architecture Decisions (Do Not Re-litigate)

- **Forced-output tool pattern**: Agents use a `submit_*` tool as their final action instead of parsing JSON text. This is more reliable than asking the model to output structured JSON. Do not change to text parsing.
- **Confidence is never self-reported**: The Orchestrator computes it from `dataCompleteness` and `assumptionsRequired.length`. Do not add any "how confident are you?" prompts.
- **Synchronous POST for analysis**: The `/api/analysis/:asteroidId` endpoint waits for the full result (30–90s). SSE streaming of per-agent progress is deferred to Phase 8. Do not add SSE now.
- **`HANDOFF_THRESHOLD = 0.55`**: Calibrate after real data, not by adjusting preemptively.

---

## Files to Read Before Coding

If unfamiliar with the codebase:
1. `CLAUDE.md` — rules and constraints (especially git commits = user only, no co-author)
2. `project-specs/AI_ARCHITECTURE.md` — agent spec (authoritative)
3. `server/tests/unit/analystService.test.ts` — the mock pattern to follow for agent tests
4. `server/src/services/orchestrator/orchestrator.ts` — to understand the confidence formula before writing orchestrator tests

---

## Commands

```bash
npm run typecheck          # verify no regressions before/after changes
npm run test               # run all Vitest tests
npm run test:e2e           # run Playwright (requires dev servers running)
npm run dev                # start both server + client in watch mode
```

---


