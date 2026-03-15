# Phase 4 — The Analyst

**Goal**: Streaming RAG chatbot with grounding constraints, source distinction, and full frontend integration.

**Status**: Complete ✓

---

## Deliverables

### Backend
- [x] `analystService.ts` — full streaming RAG chatbot using Claude Sonnet 4.6 + SSE
- [x] `POST /api/analyst/start` — creates anonymous session, returns `session_token`
- [x] `POST /api/analyst/message` — sends user message, streams SSE response
- [x] `DELETE /api/analyst/session` — explicit session cleanup
- [x] Session expiry: 24-hour TTL enforced; expired sessions return `SessionExpiredError (410)`
- [x] Grounding constraints enforced in system prompt
- [x] Optional asteroid context anchoring via `context_asteroid_id`
- [x] `AnalystTrace` SSE event emitted before tokens — full observability payload

### Frontend
- [x] `AnalystChatComponent` at `/analyst` — full-screen on mobile, max-width panel on desktop
- [x] Streaming token assembly — messages appear word by word as Claude responds
- [x] Collapsible RAG trace panel per response: chunks retrieved, source type, similarity %, content preview
- [x] Source-type footnotes: [Science fact] / [2050 Projection] on each completed response
- [x] Session lifecycle: auto-start on first visit, expiry banner, "New chat" reset
- [x] Context anchoring: "Ask Analyst" button on dossier navigates to `/analyst?asteroid=<id>`
- [x] 4 suggested prompts on welcome screen
- [x] SSE consumed via `fetch()` + `ReadableStream` (POST endpoint — EventSource not applicable)

### Tests
- [x] 14 server unit tests for `analystService.ts` (Anthropic SDK mocked) — all passing
- [x] 9 server integration tests for analyst routes — all passing
- [ ] E2E tests — deferred to Phase 8 hardening pass

**Exit condition**: The Analyst streams grounded, source-labeled answers. Science and scenario content is visually distinguished. Works correctly on mobile and desktop.

---

*Phase document created: 2026-03-13*
