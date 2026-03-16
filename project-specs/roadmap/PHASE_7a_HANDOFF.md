# Phase 7 Handoff — Planetary Defense Watch

*Updated 2026-03-16 — pre-Phase 7 bugs fixed; ready to start Phase 7.*

---

## Pre-Phase 7 Bugs Fixed (do not re-fix these)

### 1. OrbitalCanvasComponent — `sceneReady` never flipped to `true`

**Root causes (two separate issues):**
- `afterNextRender(callback)` is deprecated in Angular 21 and doesn't guarantee `@ViewChild` is populated. Fixed by switching to `ngAfterViewInit` + `setTimeout(0)`.
- WSL2 dev environment has no GPU driver → WebGL context creation fails entirely. Three.js throws, nothing catches it, `sceneReady` stays `false`.

**Fix applied:**
- `ngAfterViewInit` + `setTimeout(0)` replaces `afterNextRender` for scene init
- `isWebGLAvailable()` probes before touching Three.js
- Full Canvas 2D fallback renderer (`initScene2D`, `draw2D`) — draws stars, planet orbits, asteroid orbits, sun, markers using HTML Canvas 2D API
- Zoom (wheel) + pan (drag) + click-to-select work in 2D mode
- `canvas2dMode` signal tracks which renderer is active
- `draw2D()` called both synchronously AND via `requestAnimationFrame` to survive ResizeObserver dimension resets

### 2. Dossier — Resource Economics showed raw JSON

`<pre>{{ resource_profile | json }}</pre>` placeholder replaced with a proper renderer: spectral class + key resources list + "Full economics analysis →" link. Two new computeds: `resourceKeyResources()` + `resourceSpectralClass()`.

---

## State of the Project Right Now

- **146/146 tests passing** — run `npm run typecheck && npm run test` before touching anything
- **Phases 0–6 complete + pre-Phase 7 cleanup done**
- **WebGL note:** WSL2 dev env has no WebGL → Canvas 2D fallback is used throughout development. The Three.js path is intact and will auto-activate in production. **Do not remove the fallback.**
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
4. `client/src/app/features/orbital-canvas/orbital-canvas.component.ts` — reuse for Apophis view; understand Canvas 2D fallback
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
- **Angular 21 DOM init pattern**: use `ngAfterViewInit` + `setTimeout(0)`, NOT `afterNextRender` — the latter is deprecated and doesn't guarantee ViewChild availability

---

## Do Not Do These Things

- Do not run `git commit` or suggest co-author — commits are user-only, no exceptions
- Do not remove `@types/three` — three@0.183.x ships no .d.ts files
- Do not remove the Canvas 2D fallback from `OrbitalCanvasComponent` — dev env has no WebGL
- Do not add NgRx, RxJS Subjects, or any state management library
- Do not use `any` in TypeScript
- Do not start Phase 8 (hardening/deployment) work

---

## Exit Condition for Phase 7 Complete

1. `/defense` route renders a live PHA list filtered/sorted by approach date
2. `/defense/apophis` case study page renders with embedded orbital canvas and narrative content
3. All new code passes `npm run typecheck && npm run test`

---

*Updated: 2026-03-16 — pre-Phase 7 bugs fixed (Canvas 2D fallback, ngAfterViewInit, dossier economics render). 146 tests passing. Phase 7 ready to start.*
