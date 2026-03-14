# Phase 2 — Search & Browse

**Goal**: Semantic search, asteroid dossier, and the initial space-themed UI — mobile-first throughout.

**Status**: Complete ✓

---

## Mobile Testing Rule

**Mobile testing starts here and never stops.** Every component in this phase is reviewed at 375px (Chrome DevTools mobile emulation) before it is considered done. Playwright E2E tests run at both mobile (375px) and desktop (1280px) viewport configurations from this phase forward.

---

## Deliverables

### Backend
- [x] Voyage AI embedding generation for all ingested asteroids — `scripts/src/generateEmbeddings.ts`, run via `npm run generateEmbeddings`
- [x] `searchService.ts` — vector similarity search against `asteroids` table via pgvector
- [x] `GET /api/asteroids/search?q=` — semantic search endpoint (registered before `/:id`)
- [x] Migration `0005_match_asteroids_rpc.sql` — `match_asteroids` Supabase RPC function
- [x] `voyageService.ts` — Voyage AI embedding utility for the server
- [x] Angular dev proxy (`proxy.conf.json`) — forwards `/api` to Express on port 3001

### Frontend — Navigation & Layout
- [x] Bottom nav bar (mobile): Search, Dossier, Analysis, Analyst, Defense — 5 items, 44px touch targets
- [x] Sidebar nav (desktop): same five routes, sticky, with logo and data attribution footer
- [x] Tailwind design tokens — void/nebula/stellar/ion/plasma/asteroid/hazard/safe palette
- [x] Plus Jakarta Sans (sans-serif) + JetBrains Mono fonts loaded via Google Fonts

### Frontend — Search
- [x] `search.service.ts` — signals-based state: browse mode (filtered) + semantic mode (query)
- [x] Asteroid search component — mobile: full-width card list; desktop: grid + sidebar filters
- [x] Asteroid card component — name, spectral type, diameter, access delta-V, economic tier / similarity score
- [x] Filter controls: spectral class buttons, PHA checkbox, NHATS checkbox

### Frontend — Dossier
- [x] Asteroid detail page — mobile: stacked sections; desktop: 2-column grid
- [x] Dossier sections: Orbital elements, Close approaches, Composition ("Pending analysis"), Economics ("Pending analysis")
- [x] NHATS mission details section (shown only when nhats_accessible = true)
- [x] All raw NASA/JPL fields displayed — diameters, orbital elements, delta-V, close approaches

### Tests
- [x] E2E: search by name → view dossier → verify orbital data present — at 375px and 1280px
- [x] E2E: semantic search ("metallic asteroid accessible before 2035") → results appear
- [x] `playwright.config.ts` — mobile (375×812) and desktop (1280×800) projects
- [x] `playwright-report/` and `test-results/` added to both `.gitignore` files

**Exit condition**: A real asteroid can be found by name or semantic query, its dossier displays real NASA data, and everything looks correct on mobile and desktop. AI-generated fields show "Pending analysis" — intentional.

---

*Phase document created: 2026-03-13*
*Last updated: 2026-03-14 — all deliverables complete; exit condition met*
