# Agent Rules — Asteroid Bonanza

## Architecture overview
- Four domain agents (Navigator, Geologist, Economist, Risk Assessor) + one Lead Orchestrator
- Agents are TypeScript functions, not classes, not LangChain chains
- The Lead Orchestrator calls agents; agents never call other agents directly
- All inter-agent communication flows through `SwarmState`

## SwarmState discipline
- Agents may only mutate their designated slice of `SwarmState`
- Navigator writes to `SwarmState.orbital`
- Geologist writes to `SwarmState.composition`
- Economist writes to `SwarmState.economics`
- Risk Assessor writes to `SwarmState.risk`
- The Orchestrator writes to `SwarmState.synthesis` and `SwarmState.handoff`
- No agent reads another agent's state slice directly — the Orchestrator reads all and passes summaries

## Confidence scoring
- Confidence scores are computed from observable fields (data completeness, source quality, uncertainty ranges)
- Agents never self-report confidence ("I am 80% confident") — confidence is derived, not declared
- Every agent output interface must include `confidence: ConfidenceScore` with sub-fields for each dimension
- `ConfidenceScore` shape lives in `shared/types.d.ts`

## Model selection
- Lead Orchestrator: `claude-sonnet-4-6` (complex reasoning, synthesis)
- Navigator, Geologist, Economist, Risk Assessor: `claude-sonnet-4-6` for analysis tasks
- Classification / triage / routing sub-tasks: `claude-haiku-4-5-20251001` (fast, cheap)
- Never hardcode model strings in agent files — import from `shared/models.ts`

## Human handoff
- `HANDOFF_THRESHOLD` starts at 0.55 — calibrate in Phase 5 after real outputs
- When aggregate confidence falls below threshold, the Orchestrator produces a `HandoffPackage` instead of a synthesis
- `HandoffPackage` must include: what was found, where confidence broke down, what a human expert would need to assess
- Handoff is a first-class feature, not an error state — treat it with the same care as a successful synthesis

## Grounding
- Agents must not invent asteroid data — all orbital parameters, spectral types, and physical measurements come from the database (NASA source)
- 2050 projections must be sourced from the scenario_chunks RAG index, not from model weights
- When an agent cites a RAG chunk, it must include `source_id` in its output

## Output interfaces
- Every agent has a typed output interface defined in `shared/types.d.ts`
- Output interfaces must include: `status: 'success' | 'partial' | 'failed'`, `confidence: ConfidenceScore`, `sources: string[]`, and the domain-specific payload
- No agent may return `any` or an untyped object
