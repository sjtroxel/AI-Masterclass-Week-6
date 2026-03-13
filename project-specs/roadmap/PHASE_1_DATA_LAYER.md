# Phase 1 — Data Layer

**Goal**: Full NASA data pipeline (raw data only), all database migrations, asteroid CRUD, and basic API endpoints.

**Status**: Not started

---

## Ingest Scope Note

Raw NASA/JPL fields only in this phase. The AI-generated fields (`composition_summary`, `resource_profile`, `economic_tier`) are intentionally left null and back-filled in Phase 5 after the agents exist. The Phase 2 frontend displays these as "Pending analysis" — which is honest and expected. Raw asteroid data must exist early so Phase 2 has real records to display.

---

## Deliverables

### Database
- [ ] All migrations written and tested — every migration has a paired rollback script
- [ ] Supabase RPC functions: `match_asteroids`, `match_science_chunks`, `match_scenario_chunks`

### NASA API Services (`server/src/services/nasaApi/`)
- [ ] `ExternalAPIService` base class — retry logic, rate limiting, error handling
- [ ] `NeoWsService` — NEO catalog, close approaches
- [ ] `SBDBService` — spectral types, orbital elements, physical parameters
- [ ] `NHATSService` — human-accessible targets, delta-V budgets
- [ ] `CADService` — close approach data

### Ingestion Script
- [ ] `scripts/ingestNasa.ts` — pulls full NEO catalog from NASA → transforms → upserts to Supabase
- [ ] **Full bulk ingest run**: all ~35,000 known NEOs using registered API key (1,000 req/hour, ~2 hour run). AI-generated fields left null.

### Server Services
- [ ] `asteroidService.ts` — CRUD operations on the `asteroids` table

### API Endpoints
- [ ] `GET /api/health` — basic health check
- [ ] `GET /api/asteroids` — paginated, filterable list
- [ ] `GET /api/asteroids/:id` — single asteroid detail

### Tests
- [ ] Unit tests for all services (Supabase, Claude, NASA APIs mocked)
- [ ] Integration tests for all three endpoints via Supertest

**Exit condition**: All three endpoints return real data from the Supabase database. `ingestNasa.ts` has completed the full bulk ingest. Server test coverage ≥ 90%.

---

*Phase document created: 2026-03-13*
