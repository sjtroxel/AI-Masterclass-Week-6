# Phase 2 — Search & Browse

**Goal**: Semantic search, asteroid dossier, and the initial space-themed UI — mobile-first throughout.

**Status**: Not started

---

## Mobile Testing Rule

**Mobile testing starts here and never stops.** Every component in this phase is reviewed at 375px (Chrome DevTools mobile emulation) before it is considered done. Playwright E2E tests run at both mobile (375px) and desktop (1280px) viewport configurations from this phase forward.

---

## Deliverables

### Backend
- [ ] Voyage AI embedding generation for all ingested asteroids (~$2 total cost at Voyage pricing)
- [ ] `searchService.ts` — vector similarity search against `asteroids` table
- [ ] `GET /api/asteroids/search?q=` — semantic search endpoint

### Frontend — Search
- [ ] Asteroid search component — mobile: full-width single-column card list; desktop: grid + sidebar filters
- [ ] Asteroid card component — shows name, spectral class, accessibility rating, economic tier
- [ ] Filter controls: spectral class, PHA status, NHATS accessibility

### Frontend — Dossier
- [ ] Asteroid detail page — mobile: stacked sections with tab nav; desktop: multi-panel layout
- [ ] Dossier sections: Orbital data, Composition (shows "Pending analysis"), Economics (shows "Pending analysis"), Risk
- [ ] All raw NASA/JPL fields displayed — diameters, orbital class, delta-V, close approaches

### Frontend — Navigation & Layout
- [ ] Bottom nav bar (mobile): Search, Dossier, Analysis, Analyst, Defense
- [ ] Sidebar nav (desktop): same five routes
- [ ] Tailwind design tokens fully applied — void/nebula/stellar/ion/plasma/gold/hazard/safe palette
- [ ] Space Grotesk + Inter + JetBrains Mono fonts loaded

### Tests
- [ ] E2E: search by name → view dossier → verify orbital data present — at 375px and 1280px
- [ ] E2E: semantic search ("metallic asteroid accessible before 2035") → results appear

**Exit condition**: A real asteroid can be found by name or semantic query, its dossier displays real NASA data, and everything looks correct on mobile and desktop. AI-generated fields show "Pending analysis" — intentional.

---

*Phase document created: 2026-03-13*
