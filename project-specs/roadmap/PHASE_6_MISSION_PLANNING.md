# Phase 6 — Mission Planning & Orbital Visualization

**Goal**: Multi-asteroid comparison, mission scenario builder, and Three.js solar system visualization (mobile and desktop).

**Status**: **Complete ✓** — backend + frontend + orbital canvas all done (2026-03-16)

---

## Pre-work (before writing Phase 6 code)

- [ ] **Backfill compositions** — run `npm run backfillCompositions -- --limit 50` (or more) to populate `composition_summary` on dossier pages. Deferred from Phase 5; only meaningful once the swarm was verified working. Do this before building the comparison UI so there is real data to compare.
- [x] **Confirm Three.js approach** — decided 2026-03-16. See decision record below.

---

## Three.js Decision Record (2026-03-16)

**Chosen approach**: `three` direct import (ships its own types). No Angular CDK Portal.

**Rationale**: CDK Portal is for rendering content outside its natural DOM position (modals, overlays). An orbital canvas living at a fixed route doesn't need it — it's unnecessary abstraction and an extra dependency.

**Angular 21 integration patterns — do not deviate from these**:
- `afterNextRender()` — initialize Three.js here (guarantees DOM exists); replaces `ngAfterViewInit`
- `NgZone.runOutsideAngular()` — wrap the entire `requestAnimationFrame` animation loop; prevents 60fps change-detection thrash
- Signal `input()` + `effect()` — receive asteroid data from parent, trigger scene updates reactively
- `DestroyRef.onDestroy()` — call `renderer.dispose()`, `cancelAnimationFrame()`, dispose geometries/materials; Three.js leaks GPU memory without explicit cleanup

**Mobile**:
- `OrbitControls` (from `three/addons/controls/OrbitControls.js`) handles pinch-to-zoom and one-finger pan natively — no separate touch implementation
- Switch camera type by viewport: `OrthographicCamera` (mobile, top-down locked) / `PerspectiveCamera` (desktop)
- Show only current asteroid + nearest neighbors by close approach on mobile; full set on desktop
- SVG fallback: **deferred** — attempt orthographic Three.js first; only implement SVG renderer if 375px testing reveals real usability problems. Do not pre-build it.

**File layout**:
```
client/src/app/features/orbital-canvas/
  orbital-canvas.component.ts   ← Three.js scene, signal inputs, NgZone isolation
  orbit-math.ts                 ← Pure functions: orbital elements → ellipse points
  planet-positions.ts           ← Simplified Kepler approximation for inner planets
```

**Install**: `npm install three --workspace=client` (no additional packages needed)

---

## Deliverables

### Mission Planning — Backend ✓
- [x] Multi-asteroid comparison: `POST /api/planning/compare` — runs Navigator in parallel across up to 10 candidates, returns ranked list (`ComparisonResponse`)
- [x] Mission scenario builder endpoint: `POST /api/planning/scenario` — accepts constraints + priority weights, returns ranked recommendations with constraint violation detail (`ScenarioResponse`)
- [x] "Portfolio" view logic: `POST /api/planning/portfolio` — brute-force optimal K-asteroid combination with orbital diversity bonus (`PortfolioResponse`)
- [x] Server tests for planning logic — 35 tests (19 integration, 16 unit); all pass
- [x] New shared types: `MissionConstraints`, `CandidateScore`, `ComparisonResponse`, `ScenarioResponse`, `PortfolioResponse`
- [x] `planningService.ts` with `compareAsteroids`, `buildScenario`, `optimizePortfolio`

### Mission Planning — Frontend ✓
- [x] Mission scenario builder UI — mobile-first inputs for delta-V budget, mission window, priority weighting; mode toggle (Scenario / Compare / Portfolio)
- [x] Ranked recommendation results with scoring rationale, score breakdown bars, constraint violation callouts
- [x] Portfolio comparison view — portfolio summary card + optimal candidate grid + collapsible full candidate list
- [x] `mission-planning.service.ts` — signals-first, wraps all three planning API calls
- [x] Nav links added: "Plan" (bottom nav + sidebar), "Orbital Map" (sidebar)

### Three.js Orbital Visualization — `orbital-canvas.component.ts` ✓

**Desktop behavior**:
- [x] Three.js scene: Sun at center, inner planets (Mercury through Mars), star field background
- [x] NEO orbits plotted as ellipses from orbital elements (`semi_major_axis_au`, `eccentricity`, `inclination_deg`)
- [x] OrbitControls: drag to rotate, scroll to zoom (with inertia damping)
- [x] Clickable asteroid marker spheres → emits `asteroidSelected` output → navigate to dossier
- [ ] Orbit highlight: when viewing a dossier, that asteroid's orbit is emphasized *(stretch — not blocking)*
- [ ] Close approach animation *(stretch — not blocking)*

**Mobile behavior**:
- [x] OrthographicCamera locked to top-down view (eliminates 3D disorientation)
- [x] OrbitControls handles pinch-to-zoom and one-finger pan natively
- [x] Mobile shows max 5 asteroids; desktop shows up to 20
- [x] Tap targets: asteroid markers are raycast-selectable
- SVG fallback: **deferred** — Three.js orthographic is presentable at 375px

**Implementation constraints**:
- Orbits drawn from stored orbital elements — not physics-simulated
- No orbital mechanics derivation — NASA's numbers are consumed, not recomputed
- Planet positions: simplified Kepler approximation or pre-computed lookup table

**Stretch goals**:
- [x] Orbit highlight: `highlightId` input on `OrbitalCanvasComponent` — highlighted asteroid renders white orbit + larger marker
- [x] Current epoch position marker: `meanAnomalyDeg` field on `OrbitalAsteroid`; amber dot shows DB-epoch position vs perihelion marker
- [x] Dossier orbital canvas: `OrbitalCanvasComponent` embedded in dossier page when orbital elements exist; current asteroid highlighted automatically
- [ ] Mission trajectory arc from Earth to selected asteroid — deferred (needs shape-reference data not cleanly in current API types)

**Exit condition**: Solar system canvas renders correctly at 375px (mobile) and 1280px (desktop). Asteroid orbits are plotted. Clicking/tapping an asteroid navigates to its dossier. Mission scenario builder produces ranked output.

---

*Phase document created: 2026-03-13 — Phase 6a backend complete 2026-03-16 — Phase 6b frontend + orbital canvas complete 2026-03-16 — stretch goals (orbit highlight, epoch marker, dossier canvas embed) complete 2026-03-16. 146 tests passing (132 server + 14 client Vitest). Note: three@0.183.x ships no .d.ts files; @types/three is required for Angular esbuild builds.*
