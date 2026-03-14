# Testing Rules — Asteroid Bonanza

## Test runner
- Vitest for all unit and integration tests (both client and server)
- Playwright for E2E tests
- No Jest — Vitest is the standard

## beforeEach discipline
- Every `describe` block that uses mocks must have an explicit `vi.mockReset()` (or `.mockClear()` if preserving implementation) in `beforeEach`
- Never rely on mock state from a previous test — tests must be hermetic
- Pattern: `beforeEach(() => { vi.resetAllMocks(); })`

## Supertest pattern
- Import from `app.ts`, not `server.ts`
- `app.ts` exports the Express app without starting the server
- `server.ts` imports app and calls `app.listen()` — never import server.ts in tests
- This prevents port-in-use errors and allows parallel test runs

## SSE / streaming mocks
- Use `vi.stubGlobal('EventSource', MockEventSource)` pattern for tests that involve SSE streaming
- Never leave EventSource unmocked in unit tests — it will attempt real connections
- Mock cleanup: `vi.unstubAllGlobals()` in `afterEach`

## Viewports
- All E2E tests run at two viewports: **375px × 812px** (mobile) and **1280px × 800px** (desktop)
- A test that only passes at desktop is not a passing test
- Playwright config must define both viewport contexts and run all specs against both
- Touch target test: interactive elements must be clickable at 375px (no overflow, no overlap)

## Coverage
- Target: 80% line coverage on `server/` — enforced in CI
- No coverage requirement on Angular components in early phases — E2E covers the happy paths
- Agent logic gets unit-tested with mock LLM responses (fixture files, not live API calls)

## Fixtures
- LLM response fixtures live in `tests/fixtures/llm/`
- NASA API response fixtures live in `tests/fixtures/nasa/`
- Never make live external API calls in unit or integration tests
- Live API calls are permitted only in scripts labeled `scripts/validate-*.ts`
