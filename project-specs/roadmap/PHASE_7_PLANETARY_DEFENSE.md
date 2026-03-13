# Phase 7 — Planetary Defense Watch

**Goal**: PHA dashboard, live close approach tracking, and Apophis 2029 as a rich featured case study.

**Status**: Not started

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
- [ ] `GET /api/defense/pha` — PHA list with risk data
- [ ] `GET /api/defense/upcoming` — upcoming close approaches, sorted by date
- [ ] `GET /api/defense/apophis` — Apophis 2029 detailed data for the featured page

### Frontend — Defense Dashboard
- [ ] PHA list with risk visualization — mobile: stacked list; desktop: dashboard grid
- [ ] Upcoming close approaches — real data, sorted by date
- [ ] Risk Assessor Agent results displayed as standalone feature

### Frontend — Apophis Feature Page
- [ ] Hand-crafted editorial content — discovery story, 2029 flyby details, scientific significance
- [ ] Live countdown to April 13, 2029
- [ ] Orbital visualization (Phase 6 canvas) with Apophis highlighted and 2029 approach animated
- [ ] Risk Assessor Agent analysis of Apophis surfaced prominently
- [ ] Mobile-first layout — this page should be shareable and readable on a phone

**Exit condition**: The Apophis feature page is live with hand-crafted content and a working countdown. The PHA dashboard shows real upcoming approach data. The defense watch is usable and informative on mobile.

---

*Phase document created: 2026-03-13*
