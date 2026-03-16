# Phase 6b Handoff — Mission Planning Frontend & Orbital Canvas

*Written 2026-03-16 to brief the next Claude Code conversation.*

---

## State of the Project Right Now

- **132/132 tests passing** — run `npm run typecheck && npm run test` before touching anything
- **Phase 6 backend is complete** — all three planning endpoints live and tested
- **`three` is NOT yet installed** — first code task is `npm install three --workspace=client`

---

## What Was Built in Phase 6a (Backend)

Three new endpoints at `/api/planning/`:

| Endpoint | Body | Returns |
|---|---|---|
| `POST /api/planning/compare` | `{ asteroidIds: string[], missionParams?: MissionParams }` | `ComparisonResponse` |
| `POST /api/planning/scenario` | `{ asteroidIds: string[], constraints?: MissionConstraints }` | `ScenarioResponse` |
| `POST /api/planning/portfolio` | `{ asteroidIds: string[], constraints?: MissionConstraints, portfolioSize?: number }` | `PortfolioResponse` |

New files:
- `server/src/services/planningService.ts`
- `server/src/routes/planning.ts`
- `server/tests/integration/planning.test.ts`
- `server/tests/unit/planningService.test.ts`

New shared types in `shared/types.d.ts` (read this file before coding):
- `MissionConstraints` — user constraints + priority weights
- `CandidateScore` — single ranked candidate with score breakdown, rationale, constraint violations
- `ComparisonResponse` — `{ candidates: CandidateScore[], missionParams, rankedAt }`
- `ScenarioResponse` — `{ recommendations: CandidateScore[], constraints, topPick, feasibleCount, rankedAt }`
- `PortfolioResponse` — `{ optimalPortfolio: CandidateScore[], portfolioScore, allCandidates, constraints, portfolioRationale, rankedAt }`

---

## What to Build (Phase 6 Frontend)

Full spec in `project-specs/roadmap/PHASE_6_MISSION_PLANNING.md`.

### 1 — Mission Planning UI feature slice

```
client/src/app/features/mission-planning/
  mission-planning.component.ts    ← inputs form + constraint controls
  mission-results.component.ts     ← ranked recommendations display
  mission-portfolio.component.ts   ← portfolio comparison view
  mission-planning.service.ts      ← HTTP calls to /api/planning/*
```

- Mobile-first. Delta-V budget slider/input, mission window date pickers, priority weight controls (accessibility / economics / risk — three sliders summing to 100%)
- Results display: ranked cards showing accessibilityRating, minDeltaV_kms, score, rationale, constraint violations if any
- Portfolio view: side-by-side comparison of optimal portfolio candidates
- All reactive state via `signal()` and `computed()` — no RxJS in components

### 2 — Orbital Canvas feature slice

```
client/src/app/features/orbital-canvas/
  orbital-canvas.component.ts   ← Three.js scene, NgZone, signal inputs, cleanup
  orbit-math.ts                 ← orbital elements → ellipse points (pure functions)
  planet-positions.ts           ← simplified Kepler approximation for inner planets
```

---

## Three.js Integration — Mandatory Patterns (do not deviate)

These four patterns are non-negotiable for Angular 21 + Three.js. Read `project-specs/roadmap/PHASE_6_MISSION_PLANNING.md` for full rationale.

1. **`afterNextRender()`** — initialize the Three.js scene here (guarantees DOM exists); replaces `ngAfterViewInit`
2. **`NgZone.runOutsideAngular()`** — wrap the entire `requestAnimationFrame` animation loop; prevents 60fps change-detection thrash
3. **Signal `input()` + `effect()`** — receive asteroid data from parent; trigger scene updates reactively
4. **`DestroyRef.onDestroy()`** — call `renderer.dispose()`, `cancelAnimationFrame()`, dispose all geometries and materials; Three.js leaks GPU memory without this

**Install first:**
```bash
npm install three --workspace=client
```
`three` ships its own TypeScript types — no `@types/three` needed.

**Camera strategy:**
- Desktop (`window.innerWidth >= 768`): `PerspectiveCamera`
- Mobile: `OrthographicCamera` — top-down locked view (eliminates 3D disorientation)

**Controls:** `OrbitControls` from `three/addons/controls/OrbitControls.js` — handles pinch-to-zoom and one-finger pan natively on touch. Import via the addons path (not from `three` directly).

**Mobile orbit count:** Show only current asteroid + nearest neighbors by close-approach date. Full set on desktop.

**SVG fallback:** Do NOT pre-build. Only implement if 375px testing reveals real usability problems.

**Imports:** All Three.js imports use the package path (not relative). Example:
```typescript
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
```

---

## Key Files to Read Before Coding

Read these before writing any Angular code:

1. `shared/types.d.ts` — all shared types including the new Phase 6a planning types
2. `client/src/app/features/analysis/analysis.component.ts` — the signal-first Angular pattern to follow
3. `client/src/app/core/api.service.ts` — all HTTP calls go through here; add planning methods here
4. `client/src/app/app.routes.ts` — existing route structure; add planning + orbital routes here
5. `project-specs/roadmap/PHASE_6_MISSION_PLANNING.md` — full spec + Three.js decision record

---

## Angular Rules (summary — full rules in `.claude/rules/angular.md`)

- Signals only: `signal()`, `computed()`, `effect()` — no RxJS Subjects in components
- Mobile template first, always — 375px base, `md:` and `lg:` breakpoints layer on desktop
- Every interactive element: `min-h-[44px] min-w-[44px]` touch targets
- All HTTP via `core/api.service.ts` — never `HttpClient` directly in a component
- Lazy-load all feature routes
- `OnPush` change detection on all components
- `DestroyRef` + `takeUntilDestroyed()` for cleanup

---

## Exit Condition for Phase 6 Complete

Both of these must be true:
1. Solar system canvas renders correctly at 375px (mobile) and 1280px (desktop). Asteroid orbits plotted. Clicking/tapping an asteroid navigates to its dossier.
2. Mission scenario builder produces ranked output visible in the UI.

---

## Do Not Do These Things

- Do not run `git commit` or suggest co-author — commits are user-only, no exceptions
- Do not use Angular CDK Portal for Three.js
- Do not pre-build the SVG orbital fallback
- Do not add NgRx, RxJS Subjects, or any state management library
- Do not use `any` in TypeScript
- Do not install `@types/three` — `three` ships its own types
- Do not run more bulk backfill — 50 asteroids is enough for Phase 6

---

*Written: 2026-03-16 — Phase 6 backend complete ✓; 132 tests passing; frontend (mission builder UI + orbital canvas) is next.*
