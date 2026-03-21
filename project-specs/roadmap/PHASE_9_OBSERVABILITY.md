# Phase 9 — Deep Agent Observability Streaming

**Goal**: Stream individual agent reasoning events (tool calls, RAG lookups, LLM token chunks) to the frontend in real time, so users can watch what each agent is actually thinking as it works — not just see a dot turn green when it finishes.

**Status**: Complete ✓ — shipped 2026-03-21.

---

## Context

Phase 8 added `GET /api/analysis/:asteroidId/stream`, which streams four coarse events per analysis run:
- `agent_start` — when a phase begins (navigating, geologizing, etc.)
- `agent_complete` — when an agent finishes (success or failed)
- `analysis_complete` — the full result payload
- `done` / `error` — stream lifecycle

This gives the frontend live dot-status per agent. The richer observability data (tool calls, RAG lookups, LLM reasoning steps) already exists in each agent's `AgentTrace` but only surfaces after the full run completes, in the collapsible Observability Trace section.

Phase 9 makes that trace live.

---

## Deliverables

### Backend

- [x] Thread `onProgress` callback down into each agent runner (`runNavigator`, `runGeologist`, etc.)
- [x] Call `onProgress` with a new `agent_event` SSE event type from `agentLogger.logEvent()` as each event is recorded — covering:
  - `tool_call` — agent invokes a NASA/JPL tool (name + input)
  - `tool_result` — tool returns data (name + result summary)
  - `rag_lookup` — agent queries science or scenario index (query + chunk count)
  - `output` — agent finishes and emits its typed output
  - `error` — agent-level error
- [x] For synthesis: stream LLM token chunks via Anthropic's streaming API (`messages.stream()`) so the synthesis text appears word-by-word
- [x] New SSE event types added to the stream: `agent_event`, `synthesis_token`

### Frontend

- [x] Analysis running state: expandable per-agent panel showing live event feed as events arrive
- [x] Each event rendered with the same badge style as the post-run Observability Trace (`tool_call`, `rag_lookup`, etc.)
- [x] Synthesis section: renders tokens as they stream in (same pattern as Analyst Chat)
- [x] Mobile: event panels collapsed by default, tap to expand; desktop: side-by-side panels

### Architecture note

The `onProgress` callback currently has a union type `ProgressEvent` in `orchestrator.ts`. Phase 9 extends this union with:
```ts
| { type: 'agent_event'; agent: AgentType; event: AgentTrace['events'][number] }
| { type: 'synthesis_token'; text: string }
```

Agents receive the callback as an additional parameter and call it inside their tool dispatch loops. No direct agent-to-agent communication; all events flow through the orchestrator's callback chain.

---

## Exit condition

A live analysis shows — in real time — each agent's tool calls and RAG lookups as they happen, followed by the synthesis text streaming token-by-token. The post-run Observability Trace section becomes redundant (but can remain as a structured summary).

---

*Phase document created: 2026-03-19*
