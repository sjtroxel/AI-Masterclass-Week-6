# Asteroid Bonanza — External API Integration

*NASA and JPL API endpoints, service architecture, and error handling.*

---

## NASA NeoWs

**Base URL**: `https://api.nasa.gov/neo/rest/v1/`

Key endpoints:
- `GET /neo/browse` — Paginated catalog of all NEOs. Used during initial ingestion.
- `GET /neo/{asteroid_id}` — Single asteroid data with close approach history.
- `GET /feed?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD` — Asteroids by close approach date range.

Authentication: NASA API key (free, apply at api.nasa.gov). Stored in environment variables, never committed. Rate limit: 1,000 requests/hour with key.

---

## JPL Small Body Database API

**Base URL**: `https://ssd-api.jpl.nasa.gov/sbdb.api`

Parameters: `sstr` (asteroid name or designation), `phys-par` (physical parameters), `orbit` (orbital elements).

Provides spectral classification (the key input for the Geologist Agent), precise orbital elements, and physical parameter estimates not always available from NeoWs.

---

## JPL NHATS API

**Base URL**: `https://ssd-api.jpl.nasa.gov/nhats.api`

The **Near-Earth Object Human Space Flight Accessible Targets Study** API. This is what NASA mission planners actually use to identify candidates for crewed or robotic missions. Returns delta-V budgets, mission duration estimates, and accessibility windows. This data is the Navigator Agent's primary input — pre-computed by NASA, consumed by us.

Parameters: `dv` (max delta-V in km/s), `dur` (max mission duration in days), `stay` (stay time at asteroid).

---

## JPL Close Approach Data API

**Base URL**: `https://ssd-api.jpl.nasa.gov/cad.api`

Parameters: `date-min`, `date-max`, `dist-max` (max close approach distance), `pha` (potentially hazardous only), `sort`.

Used to populate the `close_approaches` table and power the Planetary Defense Watch feature.

---

## API Integration Architecture

All external API calls live in dedicated service classes in `server/src/services/nasaApi/`. They never appear in route handlers or agent code directly.

```
ExternalAPIService (base: retry logic, error handling, rate limiting)
├── NeoWsService
├── SBDBService
├── NHATSService
└── CADService
```

`FatalAPIError` — thrown on 401, 403, 404 responses. Does not retry. Surfaces to the ingestion pipeline and stops immediately rather than burning API quota. Rate limit errors (429) use exponential backoff, not FatalAPIError.

---

## Open Questions

| Question | When to Decide | Notes |
|---|---|---|
| NASA API key tier | Phase 1 | Demo key (30 req/hour) sufficient for dev; production key (1000/hour) needed for full ingestion |
| Embedding refresh schedule | Phase 3 | How often to re-embed asteroids as NASA data updates |
| Public PDF source licensing | Phase 3 | Confirm all ingested documents are publicly licensed for use |

---

*Document created: 2026-03-13*
