# CLAUDE.md — Asteroid Bonanza

*AI context file for Claude Code. Read this before touching anything.*

---

## What This Project Is

**Asteroid Bonanza** is an AI-powered intelligence platform for analyzing near-Earth asteroids across four dimensions: orbital accessibility, mineral composition, resource economics, and planetary defense risk. It ingests real data from NASA and JPL APIs, runs a swarm of four specialized AI agents with explicit confidence scoring, and provides a grounded RAG-powered Analyst for open-ended research questions.

**Tagline**: *The intelligence layer for the space resource revolution.*

This is a portfolio project demonstrating multi-agent AI systems, RAG with dual knowledge indices, confidence scoring, human handoff patterns, and production deployment. Every architectural decision should showcase AI engineering competence. No shortcuts on agent patterns or RAG grounding.

---

## Critical Rules — Read These First

### Git commits
**All git commits must be made by the user only. Claude Code must never run `git commit`, never suggest adding Claude/Anthropic as co-author, and never push to any remote.** When a block of work is complete, summarize what was done and prompt the user to commit. This rule has no exceptions.

### Secrets
Never read, write, or print `.env` files, `*.key` files, `*.pem` files, or anything under `.aws/` or `.ssh/`. Credentials come from environment variables only.

### Mobile-first
Every component is built at 375px first. Desktop is layered on with `md:` and `lg:` breakpoints. Mobile is never "addressed later." The bottom nav bar is the primary nav on mobile; the sidebar is desktop-only. See `.claude/rules/angular.md`.

### No AI feature drift
Do not implement AI features (agents, RAG, embeddings) outside their designated phases. AI fields in the database are nullable until Phase 5. The agent swarm ships in Phase 5. RAG knowledge base ships in Phase 3–4. Phase 0 has zero AI features.

---

## Technology Stack

### Frontend
- **Angular 21** — signals-first (`signal()`, `computed()`, `effect()`). No NgRx. No RxJS for component state.
- **Tailwind CSS v4** — CSS-first with `@theme {}` tokens. Requires `.postcssrc.json` (not `postcss.config.js`) for Angular's esbuild pipeline.
- **TypeScript 5.x strict** — `strict: true`, no `any`, NodeNext module resolution.

### Backend
- **Node.js 22 LTS** / **Express 5** — async error handling built in.
- **TypeScript 5.x** — NodeNext module resolution, `.js` extensions on all relative imports.
- `app.ts` exports the Express app (no `listen()`). `server.ts` calls `listen()`. Tests import `app.ts` only via Supertest.

### AI & Embeddings
- **Anthropic SDK** (`@anthropic-ai/sdk`) — direct SDK, no LangChain
- **Claude Sonnet 4.6** (`claude-sonnet-4-6`) — Lead Orchestrator, Analyst, complex agent reasoning
- **Claude Haiku 4.5** (`claude-haiku-4-5-20251001`) — classification, simple extraction, high-volume subtasks
- **Voyage AI** (`voyage-large-2-instruct`) — 1024-dimension embeddings, cosine similarity

### Data & Storage
- **Supabase** — PostgreSQL host + pgvector extension
- **pgvector** — cosine distance (`<=>`) for all similarity search
- Two RAG tables: `science_chunks` (hard facts) and `scenario_chunks` (2050 projections)

### External Data (consumed, not computed)
- NASA NeoWs — NEO catalog, close approaches, hazard flags
- JPL SBDB — orbital elements, spectral types, physical parameters
- JPL NHATS — pre-computed delta-V budgets for human-accessible targets
- JPL CAD — close approach predictions

### Infrastructure
- npm workspaces monorepo: `client`, `server`, `shared`, `scripts`
- Husky pre-commit: lint + type-check
- gitleaks: secret scanning
- GitHub Actions CI: type-check, lint, build, test
- Railway (backend) + Vercel (frontend) — deployment is Phase 8 only

---

## Repository Structure

```
asteroid-bonanza/
├── client/                  # Angular 21 frontend
│   └── src/app/
│       ├── core/            # Singleton services, HttpClient wrapper
│       ├── features/        # Feature slices (search, detail, analysis, analyst-chat, defense-watch)
│       └── shared/          # Shared dumb components
├── server/                  # Express 5 backend
│   └── src/
│       ├── app.ts           # Express app — no listen()
│       ├── server.ts        # Calls listen() — never imported in tests
│       ├── routes/
│       ├── services/
│       │   └── orchestrator/ # Lead Orchestrator + 4 domain agents
│       ├── db/              # Supabase client + migrations
│       └── errors/          # Typed error classes
├── shared/
│   └── types.d.ts           # Cross-workspace types (.d.ts not .ts)
├── scripts/                 # Offline data pipeline (ingest, seed)
├── project-specs/           # Planning documents (read-only during development)
├── CLAUDE.md                # This file
└── .claude/
    ├── settings.json        # Deny rules for secrets
    ├── rules/               # Behavioral rules by domain
    └── skills/              # Slash-command skills
```

---

## Dev Commands

```bash
# Install all workspaces
npm install

# Run everything (development)
npm run dev                  # starts both client and server in watch mode

# Individual workspaces
npm run dev --workspace=server
npm run dev --workspace=client

# Type-check all workspaces
npm run typecheck

# Lint
npm run lint

# Test
npm run test                 # all unit + integration tests (Vitest)
npm run test:e2e             # Playwright E2E (375px + 1280px viewports)

# Data pipeline (run after DB is set up)
npm run script ingestNasa
npm run script ingestDocuments
```

---

## Agent Architecture Summary

Four domain agents, one Lead Orchestrator. Agents communicate only through `SwarmState` — no direct agent-to-agent calls. Confidence scores are computed from observable fields, never self-reported. When aggregate confidence falls below `HANDOFF_THRESHOLD` (0.55, calibrated in Phase 5), the Orchestrator produces a `HandoffPackage` instead of a synthesis.

| Agent | Domain | Model |
|---|---|---|
| Lead Orchestrator | Synthesis, routing, handoff | Sonnet 4.6 |
| Navigator | Orbital mechanics, delta-V, mission windows | Sonnet 4.6 |
| Geologist | Spectral analysis, mineral composition | Sonnet 4.6 |
| Economist | Resource value modeling, 2050 economics | Sonnet 4.6 |
| Risk Assessor | Planetary defense + mission risk | Sonnet 4.6 |

See `project-specs/AI_ARCHITECTURE.md` for full agent topology and `.claude/rules/agents.md` for behavioral rules.

---

## RAG Architecture

Two separate Supabase vector tables:
- `science_chunks` — hard facts: NASA reports, mission data, peer-reviewed papers
- `scenario_chunks` — 2050 projections: NASA Vision 2050, ISRU roadmaps, economic analyses

The AI Analyst is architecturally constrained to these indices. It cannot use model weights for asteroid facts — all data must be sourced and cited with `source_id`.

---

## Phase Status

| Phase | Name | Status |
|---|---|---|
| 0 | Foundation | Complete ✓ |
| 1 | Data Layer | Complete ✓ |
| 2 | Search & Browse | Complete ✓ |
| 3 | RAG Knowledge Base | Complete ✓ |
| 4 | AI Analyst | Complete ✓ |
| 5 | Agent Swarm | Complete ✓ |
| 6 | Mission Planning | **In progress** — backend complete |
| 7 | Planetary Defense | Not started |
| 8 | Hardening & Deployment | Not started |

Full roadmap: `project-specs/ROADMAP.md`
Current phase details: `project-specs/roadmap/PHASE_6_MISSION_PLANNING.md`

---

## Skills Available

- `/phase-check` — lists open vs. done deliverables for current phase, evaluates exit condition
- `/mobile-review` — checks a component against the mobile-first spec
- `/agent-review` — checks an agent against the AI architecture spec

---

## Key Decisions (do not re-litigate)

- Public app — no authentication, no session persistence
- No NgRx — Angular signals are sufficient
- No LangChain — direct Anthropic SDK + hand-rolled orchestration
- Deployment is Phase 8 only — no skeleton deploys
- Three.js orbital viz is Phase 6 scope, not earlier
- Apophis 2029 is a hand-crafted featured case study in Phase 7

*Last updated: 2026-03-16 — Phase 6 backend complete (partial); 132 tests passing; mission planning service + 3 endpoints (`/api/planning/compare`, `/api/planning/scenario`, `/api/planning/portfolio`) + 35 new tests; new shared types: `MissionConstraints`, `CandidateScore`, `ComparisonResponse`, `ScenarioResponse`, `PortfolioResponse`. Frontend (mission builder UI, orbital canvas) still to do.*
