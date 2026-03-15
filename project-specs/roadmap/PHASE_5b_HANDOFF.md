# Phase 5 Handoff (b) — Agent Swarm: Tests Complete

*Written 2026-03-15 at end-of-session to brief the next Claude Code conversation.*

---

## What Was Built This Session (Do Not Rebuild)

Tests for all Phase 5 code. **97 tests passing, 0 failing** across 6 new files + the existing 5 pass through unchanged.

```
server/tests/unit/
  navigator.test.ts      — 7 tests (2-turn loop, output structure, trace events, error paths)
  geologist.test.ts      — 6 tests (composition estimate, RAG in trace, 2-turn loop)
  riskAssessor.test.ts   — 6 tests (hazard/mission risk enums, normalization, 2-turn loop)
  economist.test.ts      — 7 tests (disclaimer mandatory, missionROI enum, geologistOutput pass-through)
  orchestrator.test.ts   — 11 tests (confidence formula, handoff trigger, synthesis path, parallel, error recovery)

server/tests/integration/
  analysis.test.ts       — 11 tests (POST/GET endpoints, 404/500, handoff shape, agents filter)

client/e2e/
  analysis.spec.ts       — Playwright: navigation, touch target, mocked complete/handoff, no overflow
```

**Critical mock pattern**: Agent unit tests use `vi.clearAllMocks()` + `.mockReset()` on `mockCreate` and tool mocks — NOT `vi.resetAllMocks()`. Using `resetAllMocks` wipes the Anthropic constructor's `mockImplementation`, causing "Cannot read properties of undefined (reading 'create')" in every test. This is documented in `PHASE_5_AGENT_SWARM.md`.

---

## What Remains (Priority Order)

### 1. Run 5–10 Real Analyses

The swarm is proven by unit tests but has never run against live data. Do this next — before calibration or backfill.

**How to run:**
```bash
npm run dev   # starts both client (4200) and server (3001)
```
Then open `http://localhost:4200/search`, pick an asteroid with a dossier, click "Analyze →" and press "Run Agent Swarm Analysis". Or hit the API directly:
```bash
# Replace <uuid> with a real asteroid ID from the DB
curl -X POST http://localhost:3001/api/analysis/<uuid> \
  -H "Content-Type: application/json" -d '{}'
```

**Good test candidates:**
- **Bennu** (101955) — C-type, NHATS accessible, OSIRIS-REx data in science index → expect high confidence, good synthesis
- **Apophis** (99942) — PHA, Sq-type, famous 2029 approach → expect strong Risk output, strong Navigator output
- A sparse, unnamed object with no spectral type → should produce a handoff (low `dataCompleteness`)

After each run:
- Check the `analyses` table in Supabase to confirm the record persisted
- Review the confidence scores and agent outputs
- Note whether handoff triggered appropriately

### 2. Calibrate HANDOFF_THRESHOLD

After 20–30 real analyses, review:
- How many triggered handoff? Were the outputs genuinely low quality?
- How many sailed through? Were the syntheses actually well-grounded?
- Adjust the constant in `server/src/services/orchestrator/orchestrator.ts` line 55 and document reasoning in `PHASE_5_AGENT_SWARM.md`

Current value: `0.55` (conservative default — calibrate before treating as final).

### 3. Backfill Script

Create `scripts/src/backfillCompositions.ts`. Run AFTER 5–10 individual analyses confirm the Geologist is working.

Pattern:
- Read asteroids from DB in batches of 50 (use `asteroidService` or direct Supabase)
- For each: call only `runGeologist(asteroid, emptyState, {})` directly (skip Navigator/Economist/Risk)
- Write `composition_summary`, `resource_profile`, `economic_tier` back to `asteroids` table
- Skip rows where `composition_summary` is already populated
- 100ms delay between calls to avoid Anthropic rate limits
- See existing scripts in `scripts/src/` for the pattern (ingestNasa.ts, ingestDocuments.ts)

After backfill, dossier pages will show real AI content instead of "Analyze →" prompts.

### 4. Mobile Review

Run `/mobile-review` on `client/src/app/features/analysis/analysis.component.ts`.

Key things to verify at 375px:
- Confidence score bars render (not overflowing)
- Agent result cards stack in 1-col layout
- "Run Agent Swarm Analysis" button has min-h-[44px] ✓ (already in template)
- Collapsible trace `<details>` summary has 44px touch target
- Handoff card is readable
- No horizontal scroll

### 5. Phase 5 Exit Condition

A full four-agent analysis completes for a real asteroid, persists to the database, displays correctly on mobile and desktop. The backfill script has run and dossier pages show real composition data.

---

## Key Architecture Facts (Do Not Re-litigate)

- **Forced-output tool pattern**: Agents use `submit_*` as the terminal tool. Do not change to JSON text parsing.
- **Confidence is never self-reported**: Orchestrator computes from `dataCompleteness` and `assumptionsRequired.length`.
- **Synchronous POST**: `/api/analysis/:asteroidId` waits for full result (30–90s). SSE is Phase 8, not now.
- **`HANDOFF_THRESHOLD = 0.55`**: In `orchestrator.ts` line 55. Calibrate after real data, not by guessing.
- **Confidence weights**: `orbital=0.25, compositional=0.30, economic=0.25, risk=0.20` (sum to 1.0).
- **Assumption penalty**: 5% per assumption, capped at 30% total deduction from `dataCompleteness`.

---

## Files to Read Before Coding

1. `CLAUDE.md` — rules (git = user only, no co-author)
2. `project-specs/AI_ARCHITECTURE.md` — agent spec
3. `project-specs/roadmap/PHASE_5_AGENT_SWARM.md` — full deliverable list with checkboxes
4. `server/src/services/orchestrator/orchestrator.ts` — confidence formula, `HANDOFF_THRESHOLD`
5. `scripts/src/ingestNasa.ts` — pattern to follow for `backfillCompositions.ts`

---

## Commands

```bash
npm run typecheck          # verify no regressions (passes clean as of this session)
npm run test               # run all Vitest tests (97/97 passing)
npm run test:e2e           # Playwright E2E (requires dev servers running)
npm run dev                # start client + server in watch mode
```

---

*Written 2026-03-15 — tests complete, 97 passing; next: real analyses → calibrate → backfill → mobile review → Phase 5 exit*
