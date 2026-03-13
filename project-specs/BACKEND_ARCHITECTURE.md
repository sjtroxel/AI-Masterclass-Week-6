# Asteroid Bonanza — Backend Architecture

*Express 5 server structure, middleware stack, error classes, and API endpoints.*

---

## App / Server Split

`app.ts` exports the configured Express application with all middleware and routes but **no `listen()` call**.
`server.ts` imports `app` and calls `app.listen()`.

Tests import `app` via supertest. `server.ts` is never imported in tests. This eliminates port conflict flakiness — a pattern proven in Strawberry Star.

---

## Middleware Stack

Applied in order in `app.ts`:

1. `helmet()` — Security headers
2. `cors({ origin: CORS_ALLOWLIST })` — Allowlist only (Vercel frontend URL + localhost)
3. `express.json({ limit: '1mb' })` — Body parsing with size limit
4. `express-rate-limit` — 100 requests per 15 minutes per IP (tighter on AI endpoints)
5. Route handlers
6. Global error handler (four-parameter signature: `(err, req, res, _next)` — the underscore prefix on `_next` satisfies ESLint's `no-unused-vars` without disabling the rule)

---

## Typed Error Classes

```
AppError (base)
├── NotFoundError (404)
├── ValidationError (400)
├── DatabaseError (500)
├── AIServiceError (503)        -- Claude API failures
├── ExternalAPIError (502)      -- NASA/JPL API failures
├── FatalAPIError (500)         -- Non-retryable external API failure
└── SessionExpiredError (410)   -- Analyst session expired
```

---

## API Endpoints

### Asteroid Endpoints

```
GET  /api/health                    → health check
GET  /api/asteroids                 → paginated, filterable asteroid list
GET  /api/asteroids/:id             → single asteroid detail
GET  /api/asteroids/search?q=       → semantic vector search
GET  /api/asteroids/:id/analyses    → cached previous analyses for this asteroid
```

### Analysis Endpoints

Analysis runs are expensive (multiple Claude calls) and treated as async operations:

```
POST /api/analysis/start            → enqueues analysis, returns analysis_id
GET  /api/analysis/:id              → poll for status + result
GET  /api/analysis/:id/stream       → SSE stream of agent progress (which phase is running)
```

The SSE stream on analysis provides real-time visibility into the swarm's progress — users can see "Navigator Agent running...", "Geologist Agent running...", "Synthesizing..." rather than staring at a spinner for 30 seconds.

### Analyst Endpoints

```
POST   /api/analyst/start           → creates session, returns session_token
POST   /api/analyst/message         → sends user message, streams SSE response
DELETE /api/analyst/session         → cleans up session
```

The frontend Angular service manages the `EventSource` connection, assembles streaming tokens, and handles connection errors.

### Defense Endpoints

```
GET  /api/defense/pha               → list of PHAs with risk data
GET  /api/defense/upcoming          → upcoming close approaches
GET  /api/defense/apophis           → Apophis 2029 featured case study data
```

---

## SSE Streaming Pattern

Both the Analyst chat and Analysis progress use Server-Sent Events. The pattern:

1. Client calls the start/message endpoint
2. Server sets headers: `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`
3. Server writes `data: {...}\n\n` chunks as events arrive from Claude SDK
4. Client reads via `EventSource` or `fetch` with streaming response
5. Server sends `data: [DONE]\n\n` on completion
6. Client closes the connection

---

*Document created: 2026-03-13*
