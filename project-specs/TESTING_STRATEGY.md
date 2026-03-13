# Asteroid Bonanza — Testing Strategy

*Server tests, client tests, E2E scenarios, and CI configuration.*

---

## Philosophy

Tests are written alongside implementation — not after. Every service has a corresponding test file. Coverage thresholds are enforced in CI.

The circular validation problem (Class 4) applies here: agents cannot be validated solely by having the AI write tests for the AI's output. The test suite for agent behavior must be anchored to expected structured outputs for known inputs — not just "does it return something?"

---

## Server Tests (Vitest + Supertest)

**Target**: 90%+ statement coverage on all services.

**Test categories**:
- **Unit tests**: Each service method in isolation. External dependencies (Supabase, Claude, NASA APIs) are mocked.
- **Integration tests**: Route-level tests using Supertest against the Express app (not `server.ts`). Supabase mocked.
- **Agent output tests**: For each agent, a set of known asteroid inputs with expected output structure validation (not content validation — content varies). Validates that the output conforms to the TypeScript interface and that confidence fields are within bounds.

**Mock isolation pattern** (learned in Poster Pilot — critical):
```typescript
beforeEach(() => {
  vi.resetAllMocks();
  mockSupabase.mockReset();     // Explicit reset for queued return values
  mockAnthropic.mockReset();
});
```

Without explicit `.mockReset()` on each mock, `mockReturnValueOnce` queues bleed between tests in unpredictable ways.

---

## Client Tests (Vitest + Angular Testing Library)

**Target**: 80%+ statement coverage on services and complex components.

**Angular-specific considerations**:
- Signal-based components test reactivity by triggering signal changes and asserting DOM updates
- `TestBed` for component tests, service injection via `TestBed.inject()`
- SSE/EventSource in `analyst.service.ts` — stub `EventSource` globally: `vi.stubGlobal('EventSource', MockEventSource)` + `afterEach(() => vi.unstubAllGlobals())`

---

## E2E Tests (Playwright)

**Target**: Happy-path coverage for all primary user journeys.

**Key E2E scenarios**:
1. Search for an asteroid by name → view dossier → read composition and orbital data
2. Search semantically ("metallic asteroid accessible before 2035") → results appear
3. Request swarm analysis on an asteroid → watch agent progress → read final synthesis
4. Human handoff triggers when confidence is low → handoff packet visible
5. Open Analyst chat → ask a science question → receive streamed, sourced answer
6. Open Analyst chat → ask a scenario question → answer clearly labeled as 2050 projection
7. View Planetary Defense Watch → Apophis 2029 close approach visible

**WSL2 note**: Playwright requires system libraries on WSL2. Install: `libnspr4`, `libnss3`, and related dependencies before E2E tests will run.

---

## CI Configuration

GitHub Actions runs on every push and PR:

1. Install dependencies (all workspaces)
2. Type-check (client + server + shared)
3. Lint (ESLint)
4. Unit tests + coverage threshold check
5. Build (both client and server)
6. E2E tests (Playwright, headless)

---

*Document created: 2026-03-13*
