# Skill: agent-review

Review an agent implementation against the Asteroid Bonanza AI architecture specification.

## Steps

1. Read the agent file(s) provided (or ask which agent to review if not specified).
2. Read `.claude/rules/agents.md` and `project-specs/AI_ARCHITECTURE.md`.
3. Check each item in the checklist below and report pass / fail / needs-inspection for each.

## Checklist

**Output interface**
- [ ] Agent has a typed output interface defined in or imported from `shared/types.d.ts`
- [ ] Output includes `status: 'success' | 'partial' | 'failed'`
- [ ] Output includes `confidence: ConfidenceScore` with sub-fields
- [ ] Output includes `sources: string[]` listing RAG chunk source IDs used
- [ ] No `any` types in the output interface or return value

**Confidence scoring**
- [ ] Confidence is computed from observable data fields (completeness, source quality, uncertainty ranges)
- [ ] Agent does NOT self-report confidence ("I am X% confident" in prompt language)
- [ ] Confidence computation logic is explicit and auditable, not a black box

**State discipline**
- [ ] Agent only writes to its designated slice of `SwarmState`
- [ ] Agent does not read another agent's state slice directly
- [ ] Agent does not call another agent function directly

**Grounding**
- [ ] All asteroid facts (orbital data, spectral type, physical measurements) are sourced from the database, not model weights
- [ ] Any 2050 projection is sourced from `scenario_chunks` RAG index with explicit `source_id`
- [ ] Agent prompt includes instructions to say "I don't know" rather than invent data

**Model selection**
- [ ] Model string is imported from `shared/models.ts`, not hardcoded
- [ ] Model choice matches the task complexity (Sonnet for analysis, Haiku for classification)

**Human handoff**
- [ ] Agent correctly emits `status: 'partial'` or `'failed'` when data is insufficient
- [ ] Orchestrator's handoff path produces a `HandoffPackage` (not a silent failure)

## Output format

For each checklist item: **PASS**, **FAIL** (with explanation), or **INSPECT**.

End with: **Agent compliant** (no fails) or **Needs work** (any fail), and list the specific fixes required.
