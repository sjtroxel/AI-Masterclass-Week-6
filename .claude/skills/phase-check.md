# Skill: phase-check

Check the current phase's status and evaluate whether the exit condition has been met.

## Steps

1. Read `project-specs/ROADMAP.md` to identify the current active phase.
2. Read the corresponding `project-specs/roadmap/PHASE_N_*.md` file.
3. List all deliverables with their checkbox status — clearly separate **done** (checked) from **open** (unchecked).
4. State the exit condition from the phase file verbatim.
5. Evaluate whether the exit condition has been met based on the checked deliverables.
6. If the exit condition is not met, identify which open deliverables are blocking it.
7. Output a short summary in this format:

---
**Phase N — <Name>**
Status: [In Progress / Exit Condition Met / Blocked]

Done (N items): ...
Open (N items): ...

Exit condition: "<verbatim text from phase file>"
Assessment: <met / not met — and why>

Blockers (if any): <list the specific open items preventing exit>
---

Do not suggest work to do. Just report the current state accurately.
