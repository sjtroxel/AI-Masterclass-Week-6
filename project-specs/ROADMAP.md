# Asteroid Bonanza — Roadmap

*Phase-by-phase implementation plan. Each phase has its own detailed file in `roadmap/`.*

---

## Phase Status

| Phase | Name | Status |
|---|---|---|
| 0 | [Foundation](roadmap/PHASE_0_FOUNDATION.md) | **Complete** ✓ |
| 1 | [Data Layer](roadmap/PHASE_1_DATA_LAYER.md) | **In progress** — ingest run pending |
| 2 | [Search & Browse](roadmap/PHASE_2_SEARCH_BROWSE.md) | Not started |
| 3 | [RAG Knowledge Base](roadmap/PHASE_3_RAG_KNOWLEDGE_BASE.md) | Not started |
| 4 | [The Analyst](roadmap/PHASE_4_ANALYST.md) | Not started |
| 5 | [The Agent Swarm](roadmap/PHASE_5_AGENT_SWARM.md) | Not started |
| 6 | [Mission Planning & Orbital Visualization](roadmap/PHASE_6_MISSION_PLANNING.md) | Not started |
| 7 | [Planetary Defense Watch](roadmap/PHASE_7_PLANETARY_DEFENSE.md) | Not started |
| 8 | [Hardening, Polish & Production](roadmap/PHASE_8_HARDENING.md) | Not started |

**Rule**: No phase begins until the previous phase's deliverables are complete and tested. There is no deadline — quality over speed.

---

## Resolved Decisions

| Decision | Resolution |
|---|---|
| Project name | **Asteroid Bonanza** |
| Authentication | **None — public app.** No login required. Analyst sessions use a 24-hour anonymous token. |
| NASA API key | **Free registered key** (api.nasa.gov). 1,000 req/hour → ~20,000 asteroids/hour. Full 35k NEO ingest in ~2 hours. |
| Three.js orbital viz | **In scope — Phase 6.** Desktop: full 3D. Mobile: orthographic top-down + touch controls. See `PHASE_6_MISSION_PLANNING.md`. |
| Mobile strategy | **Mobile-first from Phase 0.** Every component built at 375px first, enhanced upward. Bottom nav on mobile, sidebar on desktop. |
| Embedding refresh | **No automated schedule.** Portfolio project. One-time ingest. Manual re-run if desired; at most annually. |
| HANDOFF_THRESHOLD | **Start at 0.55, calibrate in Phase 5.** Not a pre-implementation question — adjust after first 20–30 real analyses reveal where the threshold should actually sit. |
| AI field ingest timing | **Split.** Raw NASA data: Phase 1. AI-generated fields (`composition_summary`, `resource_profile`, `economic_tier`): back-filled in Phase 5 after agents exist. Dossier shows "Pending analysis" in between. |
| RAG document sourcing | **Phase 0 pre-code task.** Source list compiled and verified before Phase 3 begins. See `PHASE_0_FOUNDATION.md`. |

---

## Quick Reference

**Stack**: Angular 21 + Express 5 + Supabase + Claude (Sonnet 4.6 / Haiku 4.5) + Voyage AI
**Deployment**: Railway (backend) + Vercel (frontend) + Supabase (database)
**Spec documents**: See numbered files in `project-specs/` for architecture details.

---

*Document created: 2026-03-13*
