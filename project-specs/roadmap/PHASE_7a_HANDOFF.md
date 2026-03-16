# Phase 7 Handoff — Planetary Defense Watch

*Written 2026-03-16 to brief the next Claude Code conversation.*

---

## Known Bug — Fix This First

**`/orbital-canvas` page: endless loading spinner despite "20 asteroids plotted" in header**

- Header text shows correct count → data loaded fine, `loading.set(false)` was called
- The spinner is from `OrbitalCanvasComponent`'s `sceneReady` signal — it never flips to `true`
- `sceneReady` is set at the very end of `initScene()` via `this.zone.run(() => this.sceneReady.set(true))`; if anything throws before that line, signal stays `false` forever

**Diagnose:**
1. Open browser devtools **Console** tab when loading `/orbital-canvas` — look for JS/WebGL errors
2. Wrap the body of `this.zone.runOutsideAngular(...)` in a try/catch and `console.error` any exception
3. Verify `this.canvasHost?.nativeElement` is not `undefined` when `afterNextRender` fires
4. Check whether `OrbitControls` import (`three/addons/controls/OrbitControls.js`) resolves correctly

**Secondary: performance** — page fires 20 individual `GET /api/asteroids/:id` requests to collect orbital elements. Should be replaced with a single call or the list endpoint extended to include orbital fields.

---

## State of the Project Right Now

- **146/146 tests passing** — run `npm run typecheck && npm run test` before touching anything
- **Phases 0–6 complete, including all Phase 6 stretch goals**
- **`three` + `@types/three` installed** — `@types/three` is required; three@0.183.x ships no .d.ts files

---

## What Was Built in Phase 6 (complete)

### Backend
- `POST /api/planning/compare` → `ComparisonResponse`
- `POST /api/planning/scenario` → `ScenarioResponse`
- `POST /api/planning/portfolio` → `PortfolioResponse`
- 35 server tests for planning (19 integration, 16 unit)
- New shared types: `MissionConstraints`, `CandidateScore`, `ComparisonResponse`, `ScenarioResponse`, `PortfolioResponse`

### Frontend
- `client/src/app/features/mission-planning/` — scenario builder UI, ranked results, portfolio view
- `client/src/app/features/orbital-canvas/` — Three.js canvas, orbit-math.ts, planet-positions.ts
- `OrbitalCanvasComponent` accepts: `asteroids`, `highlightId` (highlights one orbit white), `asteroidSelected` output
- `OrbitalAsteroid.meanAnomalyDeg` — when present, renders a second epoch-position marker
- **Dossier page** now embeds orbital canvas when orbital elements exist; current asteroid highlighted
- Nav: "Plan" (bottom nav + sidebar), "Orbital Map" (sidebar only)

### Tests
- `client/tests/orbit-math.test.ts` — 14 Vitest unit tests for pure orbital math functions
- `client/e2e/mission-planning.spec.ts` — 12 Playwright E2E tests for mission planning + orbital canvas
- Client now runs Vitest via `npm run test` (Angular test via `npm run test:ng`)

---

## What to Build — Phase 7: Planetary Defense Watch

Full spec in `project-specs/roadmap/PHASE_7_PLANETARY_DEFENSE.md` (read this first).

### Core deliverables

**1 — Apophis 2029 Featured Case Study**
- Hand-crafted page at `/defense/apophis` (NOT auto-generated)
- Uses the real close approach data from CAD (April 13, 2029; ~38,000 km miss — inside geostationary orbit)
- Narrative sections: discovery history, 2004 scare, current risk assessment, 2029 flyby significance
- Embed `OrbitalCanvasComponent` with Apophis highlighted
- Link to dossier for raw data, link to analysis for agent swarm output

**2 — Defense Watch feed**
- Route: `/defense`
- Lists asteroids flagged as PHAs (`is_pha = true`) sorted by next approach date
- Hazard rating badge (from `RiskOutput.planetaryDefense.hazardRating` if analysis exists, else from `is_sentry_object`)
- Filter by: upcoming approaches (next 30/90/365 days), hazard rating, diameter
- Links to dossier + analysis for each

**3 — Close Approach Timeline**
- Visual timeline component showing close approaches for a selected asteroid over a date range
- Use the existing `CloseApproach` data already in the DB
- Mobile: scrollable horizontal list. Desktop: simple SVG timeline bars

### Stretch goals for Phase 7
- Real-time Sentry feed integration (JPL Sentry API — risk ratings for known impactors)
- Apophis animated orbital approach — use `orbitPositionAtMeanAnomaly` to show its track in 2029

---

## Key Files to Read Before Writing Phase 7 Code

1. `shared/types.d.ts` — `RiskOutput`, `CloseApproach`, `MissionParams`
2. `client/src/app/core/api.service.ts` — existing API methods; add any new ones here
3. `client/src/app/app.routes.ts` — add `/defense`, `/defense/apophis` lazy routes
4. `client/src/app/features/orbital-canvas/orbital-canvas.component.ts` — reuse for Apophis view
5. `server/src/routes/` — check existing routes before adding new ones
6. `project-specs/roadmap/PHASE_7_PLANETARY_DEFENSE.md` — full spec

---

## Angular / Tech Rules (unchanged from Phase 6)

- Signals only — no RxJS Subjects in components
- Mobile-first — 375px base, `md:` / `lg:` breakpoints
- `min-h-[44px] min-w-[44px]` on all interactive elements
- `OnPush` change detection on all components
- All HTTP through `core/api.service.ts`
- Lazy-load all feature routes
- `@types/three` is installed and required — do NOT remove it

---

## Do Not Do These Things

- Do not run `git commit` or suggest co-author — commits are user-only, no exceptions
- Do not remove `@types/three` — three@0.183.x ships no .d.ts files
- Do not add NgRx, RxJS Subjects, or any state management library
- Do not use `any` in TypeScript
- Do not start Phase 8 (hardening/deployment) work

---

## Exit Condition for Phase 7 Complete

1. `/defense` route renders a live PHA list filtered/sorted by approach date
2. `/defense/apophis` case study page renders with embedded orbital canvas and narrative content
3. All new code passes `npm run typecheck && npm run test`

---

*Written: 2026-03-16 — Phase 6 fully complete (146 tests); ready for Phase 7.*
