# Server / Express Rules — Asteroid Bonanza

## app.ts / server.ts split (critical)
- `server/src/app.ts` exports the Express app — it must NEVER call `app.listen()`
- `server/src/server.ts` imports app and calls `app.listen()` — it must NEVER be imported in tests
- All tests import from `app.ts` only, via Supertest — this prevents port-in-use errors in parallel runs
- This pattern is documented in `testing.md` and enforced there — keep the two files consistent

## Express 5 async error handling
- Express 5 catches async errors automatically — no need to wrap route handlers in `try/catch` or `next(err)` manually
- Throw typed errors from route handlers; Express 5 will forward them to the error middleware
- Typed error classes live in `server/src/errors/AppError.ts` — use these, do not throw plain `Error` objects

## Route structure
- Route files live in `server/src/routes/` — one file per feature domain (e.g., `asteroids.ts`, `analysis.ts`, `defense.ts`)
- Each route file exports a single `Router` instance
- Route files import services from `server/src/services/` — no business logic in route files
- HTTP method handlers should be thin: validate input → call service → return response

## Request validation
- Validate query params and body at the route layer before passing to services
- Use typed parameter extraction — never pass raw `req.query` or `req.body` to services
- Return 400 with a descriptive message for invalid input

## Response conventions
- Success: return the data directly (no wrapping envelope required)
- Error: `{ error: string, message: string }` shape — consistent with `AppError` structure
- 404 for unknown asteroid IDs or missing resources
- 500 for unexpected errors (let the error middleware handle these)

## External API calls
- NASA/JPL API calls go through `server/src/services/nasaApi/` — do not add raw `fetch()` calls to routes
- External API timeouts: handle gracefully — return 504 with a descriptive message, do not hang
- Rate limit errors from external APIs: return 429 with retry-after if available

## File naming
- Service files in `server/src/services/` use camelCase: `asteroidService.ts`, `ragService.ts`, `voyageService.ts`
- NASA API sub-services in `server/src/services/nasaApi/` use PascalCase: `CADService.ts`, `NeoWsService.ts`
- Route files use camelCase: `asteroids.ts`, `analysis.ts`
- Error classes use PascalCase: `AppError.ts`

## See also
- `.claude/rules/testing.md` — Supertest pattern for testing routes
- `.claude/rules/typescript.md` — NodeNext module resolution, `.js` extensions
