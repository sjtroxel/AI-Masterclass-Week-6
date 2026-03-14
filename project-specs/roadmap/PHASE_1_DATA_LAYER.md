# Phase 1 — Data Layer

**Goal**: Full NASA data pipeline (raw data only), all database migrations, asteroid CRUD, and basic API endpoints.

**Status**: Complete ✓

---

## Ingest Scope Note

Raw NASA/JPL fields only in this phase. The AI-generated fields (`composition_summary`, `resource_profile`, `economic_tier`) are intentionally left null and back-filled in Phase 5 after the agents exist. The Phase 2 frontend displays these as "Pending analysis" — which is honest and expected. Raw asteroid data must exist early so Phase 2 has real records to display.

---

## Deliverables

### Database
- [x] All migrations written and tested — every migration has a paired rollback script
- [x] Supabase RPC functions: `match_science_chunks`, `match_scenario_chunks` applied to Supabase
- [ ] `match_asteroids` RPC — **deferred to Phase 5** (asteroid embeddings are null until then)

### NASA API Services (`server/src/services/nasaApi/`)
- [x] `ExternalAPIService` base class — retry logic, exponential backoff, error handling
- [x] `NeoWsService` — NEO catalog browse + single-object detail
- [x] `SBDBService` — spectral types, diameter, MOID
- [x] `NHATSService` — human-accessible targets, delta-V budgets
- [x] `CADService` — close approach data, date normalization

### Ingestion Script
- [x] `scripts/ingestNasa.ts` — pulls full NEO catalog from NASA → transforms → upserts to Supabase
- [x] **Full bulk ingest run**: all ~35,000 known NEOs using registered API key (1,000 req/hour, ~2 hour run). AI-generated fields left null. Run via: `npm run ingestNasa`

### Server Services
- [x] `asteroidService.ts` — paginated list with filters, get by UUID, get by nasa_id

### API Endpoints
- [x] `GET /api/health` — basic health check
- [x] `GET /api/asteroids` — paginated list, filterable by `is_pha`, `nhats_accessible`, `spectral_type`
- [x] `GET /api/asteroids/:id` — single asteroid detail (accepts UUID or nasa_id)

### Tests
- [x] Unit tests for all NASA API services and asteroidService (fetch + Supabase mocked)
- [x] Integration tests for all three endpoints via Supertest — 26 tests, all passing

**Exit condition**: All three endpoints return real data from the Supabase database. `ingestNasa.ts` has completed the full bulk ingest. Server test coverage ≥ 90%.

---

*Phase document created: 2026-03-13*
*Last updated: 2026-03-14 — full bulk ingest complete; all deliverables done*
