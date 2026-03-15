# Phase 6 — Mission Planning & Orbital Visualization

**Goal**: Multi-asteroid comparison, mission scenario builder, and Three.js solar system visualization (mobile and desktop).

**Status**: Not started — ready to begin

---

## Pre-work (before writing Phase 6 code)

- [ ] **Backfill compositions** — run `npm run backfillCompositions -- --limit 50` (or more) to populate `composition_summary` on dossier pages. Deferred from Phase 5; only meaningful once the swarm was verified working. Do this before building the comparison UI so there is real data to compare.
- [ ] **Confirm Three.js approach** — decide between `@types/three` + direct import vs. Angular CDK portal. Read `project-specs/AI_ARCHITECTURE.md` section on visualization before writing any canvas code.

---

## Deliverables

### Mission Planning — Backend
- [ ] Multi-asteroid comparison: run Navigator Agent across multiple candidates simultaneously
- [ ] Mission scenario builder endpoint: accepts user constraints (max delta-V, mission window, priorities) → returns ranked recommendations
- [ ] "Portfolio" view logic: given N candidates, which combination maximizes value within constraints?
- [ ] Server tests for planning logic

### Mission Planning — Frontend
- [ ] Mission scenario builder UI — mobile-first inputs for delta-V budget, mission window, priority weighting
- [ ] Ranked recommendation results with scoring rationale
- [ ] Portfolio comparison view

### Three.js Orbital Visualization — `orbital-canvas.component.ts`

**Desktop behavior**:
- [ ] Three.js scene: Sun at center, inner planets (Mercury through Mars), asteroid belt region sketched
- [ ] NEO orbits plotted as ellipses from orbital elements (`semi_major_axis_au`, `eccentricity`, `inclination_deg`)
- [ ] Mouse orbit controls: drag to rotate, scroll to zoom
- [ ] Clickable asteroid objects → deep-link to dossier page
- [ ] Orbit highlight: when viewing a dossier, that asteroid's orbit is emphasized
- [ ] Close approach animation: show asteroid position relative to Earth for a selected approach date

**Mobile behavior** (required — not desktop-only):
- [ ] Orthographic camera locked to top-down view (eliminates 3D disorientation on small screens)
- [ ] Touch controls: pinch-to-zoom, one-finger drag to pan
- [ ] Fewer simultaneous orbits displayed (current asteroid + nearest neighbors by approach, not all 35k)
- [ ] Asteroid tap targets minimum 44px touch zone
- [ ] SVG fallback: if Three.js scene cannot be made presentable at 375px, a 2D SVG orbital diagram serves as the mobile renderer — same orbital element data, different renderer, still interactive

**Implementation constraints**:
- Orbits drawn from stored orbital elements — not physics-simulated
- No orbital mechanics derivation — NASA's numbers are consumed, not recomputed
- Planet positions: simplified Kepler approximation or pre-computed lookup table

**Stretch goal** (do not block phase completion on this):
- [ ] Mission trajectory arc from Earth to selected asteroid using NHATS pre-computed data for shape reference

**Exit condition**: Solar system canvas renders correctly at 375px (mobile) and 1280px (desktop). Asteroid orbits are plotted. Clicking/tapping an asteroid navigates to its dossier. Mission scenario builder produces ranked output.

---

*Phase document created: 2026-03-13 — pre-work items added 2026-03-15*
