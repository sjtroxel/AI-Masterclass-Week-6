# Phase 7 — Planetary Defense Watch

**Goal**: PHA dashboard, live close approach tracking, and Apophis 2029 as a rich featured case study.

**Status**: In progress — Steps 1–4 complete ✓ (2026-03-17)

---

## Apophis 2029 — Featured Case Study

Apophis 99942 makes a confirmed close approach on **April 13, 2029** — one of the closest approaches of a large asteroid in recorded history. This is a real, well-documented, genuinely newsworthy event happening only ~3 years from now. It is the anchor of Phase 7 and the most compelling hook for anyone who discovers the app.

The Apophis page is **hand-crafted** — not AI-generated boilerplate. It should feel like a dedicated editorial feature, not a generated dossier. Think: timeline of the 2004 discovery and the fear/relief cycle, the 2029 flyby specifics, what scientists will be able to observe, and why Apophis matters for planetary defense methodology.

---

## Deliverables

### Data
- [ ] Close approach data for all PHAs ingested and current
- [ ] Apophis 99942 data fully populated — all orbital elements, close approach history, 2029 event data

### Backend
- [ ] Risk Assessor Agent surfaced as a standalone endpoint (not only part of full swarm analysis)
- [x] `GET /api/defense/pha` — PHA list with risk data ✓
- [x] `GET /api/defense/upcoming` — upcoming close approaches, sorted by date ✓
- [x] `GET /api/defense/apophis` — Apophis 2029 detailed data for the featured page ✓

### Frontend — Defense Dashboard
- [x] PHA list with risk visualization — mobile: stacked list; desktop: 2-column grid ✓
- [x] Upcoming close approaches — real data, sorted by date, with 30/90/365-day filter ✓
- [ ] Risk Assessor Agent results displayed as standalone feature

### Frontend — Apophis Feature Page
- [x] Hand-crafted editorial content — discovery story, 2029 flyby details, scientific significance ✓
- [x] Live countdown to April 13, 2029 ✓
- [x] Orbital visualization (Phase 6 canvas) with Apophis highlighted ✓
- [ ] Risk Assessor Agent analysis of Apophis surfaced prominently
- [x] Mobile-first layout — shareable and readable on a phone ✓

**Exit condition**: The Apophis feature page is live with hand-crafted content and a working countdown. The PHA dashboard shows real upcoming approach data. The defense watch is usable and informative on mobile.

---

*Phase document created: 2026-03-13*

---

## Implementation Plan (added 2026-03-17)

### Step 1 — Backend Routes (3 endpoints) ✓ DONE

**`server/src/routes/defense.ts`**
- `GET /api/defense/pha` — query `asteroids` where `is_pha = true`, join `close_approaches` for next approach date, return with `is_sentry_object` flag and last known `RiskOutput` if analysis exists
- `GET /api/defense/upcoming` — query `close_approaches` with `approach_date` in next 365 days, sorted by date; join asteroid `is_pha` + `estimated_diameter_max_km`
- `GET /api/defense/apophis` — single record for nasa_id `"99942"` with all close approaches

Mount at `app.ts` alongside existing routes. Write 8–10 integration tests.

### Step 2 — Shared Types ✓ DONE

Add to `shared/types.d.ts`:
- `PhaListItem` — asteroid fields + next approach date + hazard flag
- `UpcomingApproach` — approach date, miss distance, asteroid name/id/diameter
- `ApophisDetail` — full close approach history + orbital elements + curated 2029 event data

### Step 3 — Frontend: Defense Dashboard (`/defense`) ✓ DONE

`client/src/app/features/defense-watch/`
- `DefenseWatchComponent` — signals-first, `OnPush`
- Mobile: stacked card list; desktop: 2-column grid
- Filter bar: "Next 30 / 90 / 365 days" pill toggles + diameter range
- Each card: asteroid name, approach date, miss distance, hazard badge, link to dossier/analysis
- Add to `api.service.ts`: `getPhAs()`, `getUpcomingApproaches()`

### Step 4 — Frontend: Apophis Feature Page (`/defense/apophis`) ✓ DONE

`client/src/app/features/defense-watch/apophis-feature/`
- **Hand-crafted editorial sections**: discovery (2004), scare cycle + reassessment, 2029 flyby specs (38,017 km — inside GEO orbit), scientific significance for planetary defense methodology
- Live countdown signal to April 13, 2029
- `OrbitalCanvasComponent` embedded with `highlightId="99942"`
- Close approach timeline component (shared, reusable)
- CTA links → dossier + agent swarm analysis

### Step 5 — Close Approach Timeline Component

`shared/components/approach-timeline/`
- Input: `CloseApproach[]`
- Mobile: horizontal scrollable pill list sorted by date
- Desktop: simple SVG bar timeline (date axis, miss-distance bars)

### Step 6 — Navigation + Routing ✓ DONE

- Add `/defense` and `/defense/apophis` lazy routes to `app.routes.ts`
- Add "Defense" entry to bottom nav (mobile) + sidebar (desktop)
- Bottom nav: 5 items max — may need to consolidate or drop "Orbital Map" to sidebar-only

### Step 7 — Tests

- 8–10 server integration tests for the 3 defense endpoints
- 6–8 client Vitest unit tests (countdown logic, timeline sorting, filter logic)
- Target: ~160 total tests passing

### Order of Execution

1. Shared types → 2. Backend routes + tests → 3. `api.service.ts` additions → 4. Defense dashboard → 5. Timeline component → 6. Apophis feature page → 7. Nav wiring → 8. Final typecheck + test run
