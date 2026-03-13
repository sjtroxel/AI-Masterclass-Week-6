# Phase 4 — The Analyst

**Goal**: Streaming RAG chatbot with grounding constraints, source distinction, and full frontend integration.

**Status**: Not started

---

## Deliverables

### Backend
- [ ] `analystService.ts` — full streaming RAG chatbot using Claude Sonnet 4.6 + SSE
- [ ] `POST /api/analyst/start` — creates anonymous session, returns `session_token`
- [ ] `POST /api/analyst/message` — sends user message, streams SSE response
- [ ] `DELETE /api/analyst/session` — explicit session cleanup
- [ ] Session expiry: 24-hour TTL enforced; expired sessions return `SessionExpiredError (410)`
- [ ] Grounding constraints enforced in system prompt:
  - Only cite retrieved content from `science_chunks` or `scenario_chunks`
  - Clearly distinguish science (factual) from scenario (2050 projection) in every response
  - Say "I don't have enough information" when context is insufficient — never fabricate
  - Never invent statistics, paper citations, or mission data
- [ ] Optional asteroid context anchoring: when called with a `context_asteroid_id`, the Analyst receives that asteroid's data as additional context

### Frontend
- [ ] Analyst sidebar component:
  - Mobile: full-screen overlay, slide-up drawer
  - Desktop: slide-in sidebar panel
- [ ] Streaming token assembly — messages appear word by word as Claude responds
- [ ] Source labels displayed on cited content (science vs. scenario clearly marked)
- [ ] Session lifecycle: create on first message, restore from `session_token` on return, handle expiry gracefully
- [ ] Context anchoring: when viewing a dossier, the Analyst sidebar receives that asteroid's ID

### Tests
- [ ] Server unit tests for `analystService.ts` (Anthropic SDK mocked)
- [ ] `EventSource` stubbed for client tests: `vi.stubGlobal('EventSource', MockEventSource)` + `afterEach(() => vi.unstubAllGlobals())`
- [ ] E2E: open Analyst → ask a science question → receive streamed answer with science label
- [ ] E2E: ask a 2050 scenario question → answer labeled as projection
- [ ] E2E: session expiry handled gracefully in the UI

**Exit condition**: The Analyst streams grounded, source-labeled answers. Science and scenario content is visually distinguished. Works correctly on mobile and desktop.

---

*Phase document created: 2026-03-13*
