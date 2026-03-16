# Phase 6 Handoff — Mission Planning & Orbital Visualization

*Written 2026-03-16 to brief the next Claude Code conversation.*

---

## State of the Project Right Now

- **132/132 tests passing** — run `npm run typecheck && npm run test` to verify before touching anything
- **Phase 5 is fully complete** — agent swarm, orchestrator, routes, frontend analysis page, all tests
- **Phase 6 backend is complete** — mission planning service + 3 endpoints + 35 new tests; see below
- **50 asteroids backfilled** — `composition_summary`, `resource_profile`, `economic_tier` populated via Geologist agent. Bennu and Ryugu also have full 4-agent swarm analyses. Do not run more bulk backfill — Phase 8 only.

### Phase 6 Backend — Done ✓

New files:
- `server/src/services/planningService.ts` — `compareAsteroids`, `buildScenario`, `optimizePortfolio`
- `server/src/routes/planning.ts` — `POST /api/planning/{compare,scenario,portfolio}`
- `server/tests/integration/planning.test.ts` — 19 integration tests
- `server/tests/unit/planningService.test.ts` — 16 unit tests

New shared types in `shared/types.d.ts`:
`MissionConstraints`, `CandidateScore`, `ComparisonResponse`, `ScenarioResponse`, `PortfolioResponse`

Scoring logic: accessibility rating → 0–1, `economic_tier` DB field → 0–1, constraint satisfaction → 0–1; normalized priority weights; constraint violations (delta-V budget, launch window) detected and surfaced. Portfolio optimizer: brute-force best K-combination with small orbital diversity bonus (feasible for ≤10 candidates).

---

## Corrections to Know (Do Not Re-litigate)

- **`HANDOFF_THRESHOLD = 0.30`** — calibrated down from 0.55 during Phase 5 real runs. The constant is in `server/src/services/orchestrator/orchestrator.ts` line ~55. The `.claude/rules/agents.md` file still says 0.55 — that's outdated but leave it; the code is authoritative.
- **Backfill cost is ~$0.12/asteroid** (not $0.015 — the RAG chunks are large and context accumulates across turns). Full 35k catalog would be ~$4,200. Do not suggest bulk backfill.
- **Deployment backfill plan**: ~500 curated asteroids (NHATS-accessible + PHAs + named objects) at ~$60 total. Phase 8 only.

---

## Phase 6 Pre-work — Both Complete

### Backfill compositions ✓
50 asteroids processed. Script is `scripts/src/backfillCompositions.ts`. Safe to re-run (idempotent). Do not run again until Phase 8.

### Three.js approach confirmed ✓
Full decision record is in `project-specs/roadmap/PHASE_6_MISSION_PLANNING.md` under "Three.js Decision Record". Key points:

- **Direct import of `three`** (ships own types). No Angular CDK Portal. No wrapper library.
- Install: `npm install three --workspace=client`
- Angular 21 integration — these four patterns are mandatory, do not deviate:
  1. `afterNextRender()` — initialize Three.js (guarantees DOM exists)
  2. `NgZone.runOutsideAngular()` — wrap the entire rAF animation loop (prevents 60fps CD thrash)
  3. Signal `input()` + `effect()` — receive/react to asteroid data from parent
  4. `DestroyRef.onDestroy()` — dispose renderer, geometries, materials (GPU memory leaks without this)
- `OrbitControls` from `three/addons/controls/OrbitControls.js` — handles mouse AND touch natively
- Mobile: `OrthographicCamera` top-down; desktop: `PerspectiveCamera`
- SVG fallback: **do not pre-build** — assess only if 375px testing reveals real problems

---

## What to Build (Phase 6)

Full deliverable list is in `project-specs/roadmap/PHASE_6_MISSION_PLANNING.md`. Summary:

### Backend ✓ Complete
1. ~~Multi-asteroid comparison endpoint~~ — done: `POST /api/planning/compare`
2. ~~Mission scenario builder~~ — done: `POST /api/planning/scenario`
3. ~~Portfolio view logic~~ — done: `POST /api/planning/portfolio`
4. ~~Server tests~~ — done: 35 tests passing

### Frontend (next)
5. Mission scenario builder UI — mobile-first, signal-first
6. Ranked recommendations display
7. Portfolio comparison view
8. `orbital-canvas.component.ts` — Three.js solar system visualization

### File layout for orbital canvas
```
client/src/app/features/orbital-canvas/
  orbital-canvas.component.ts   ← scene, NgZone, signals, cleanup
  orbit-math.ts                 ← orbital elements → ellipse points (pure functions)
  planet-positions.ts           ← simplified Kepler for inner planets
```

### Exit condition
Solar system canvas renders at 375px and 1280px. Asteroid orbits plotted. Click/tap navigates to dossier. Mission scenario builder produces ranked output.

---

## Key Files to Read Before Coding

1. `CLAUDE.md` — rules (especially: git commits = user only, no co-author; mobile-first; no NgRx)
2. `project-specs/roadmap/PHASE_6_MISSION_PLANNING.md` — full deliverable list + Three.js decision record
3. `server/src/services/orchestrator/navigator.ts` — the Navigator agent you'll be calling in batch for comparison
4. `server/src/routes/analysis.ts` — existing analysis route pattern to follow for new planning routes
5. `client/src/app/features/analysis/analysis.component.ts` — existing Angular signal-first component pattern
6. `server/tests/unit/orchestrator.test.ts` — mock pattern to follow for new backend tests

---

## Commands

```bash
npm run typecheck          # always run before and after changes
npm run test               # 97 tests, all must pass
npm run dev                # starts server + client in watch mode
npm run test:e2e           # Playwright (requires dev servers running)
```

---

## Do Not Do These Things

- Do not run `git commit` or suggest co-author — commits are user-only, no exceptions
- Do not run more bulk backfill — 50 is enough for Phase 6
- Do not use Angular CDK Portal for Three.js
- Do not pre-build the SVG orbital fallback
- Do not add NgRx, RxJS Subjects, or any state management library
- Do not use `any` in TypeScript
- Do not call `server.ts` from tests — always import `app.ts`
- Do not implement SSE streaming for the analysis endpoint — deferred to Phase 8

---

*Written: 2026-03-16 — Phase 5 complete ✓; 97 tests passing; 50 asteroids backfilled; Three.js approach decided; Phase 6 ready to begin.*
*Updated: 2026-03-16 — Phase 6 backend complete ✓; 132 tests passing; frontend (mission builder UI + orbital canvas) is next.*
