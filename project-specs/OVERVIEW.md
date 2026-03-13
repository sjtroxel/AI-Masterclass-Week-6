# Asteroid Bonanza — Project Overview

*Project identity, technology choices, and repository structure.*

---

## Project Identity

**Name**: Asteroid Bonanza
**Domain**: Space resource intelligence and asteroid economy analysis
**Temporal Frame**: 2050 scenario grounded in real 2026 NASA data
**Tagline**: *The intelligence layer for the space resource revolution.*

### What it is

An AI-powered command center for analyzing near-Earth asteroids across four dimensions simultaneously: orbital accessibility, mineral composition, resource economics, and planetary defense risk. It ingests real data from NASA and JPL APIs, maintains a semantic search database of catalogued objects, runs a swarm of four specialized AI agents to produce multi-dimensional analyses with explicit confidence scoring, and provides a grounded RAG-powered Analyst for open-ended research questions.

### What it is not

- A physics simulation or orbital mechanics solver (we consume NASA's pre-computed data; we do not derive it)
- A real-time trading or investment platform
- A game or entertainment application
- A fictional or speculative dataset (all asteroid data is sourced from real NASA/JPL catalogs)

---

## Technology Stack

Every choice here is made deliberately. The rationale is documented so that future decisions can be made in context.

### Frontend

| Technology | Version | Rationale |
|---|---|---|
| Angular | 21 | Signals-based reactivity is ideal for a live data dashboard. Service architecture maps naturally to the agent pipeline. Chosen over React to maintain framework breadth. |
| TypeScript | 5.x (strict) | End-to-end type safety. `strict: true` in all `tsconfig.json` files. |
| Tailwind CSS | v4 (CSS-first) | `@theme {}` token system for consistent design. `.postcssrc.json` required (not `postcss.config.js`) for Angular's esbuild pipeline. |
| Angular Signals | Built-in (v17+) | Replaces RxJS Subjects for most local state. `signal()`, `computed()`, `effect()`. No NgRx for this project — signals are sufficient. |
| Vitest | Latest | Unit and component testing. Angular 21 supports Vitest natively with `@analogjs/vitest-angular`. |
| Playwright | Latest | E2E testing. Will require WSL2 system library setup (`libnspr4`, `libnss3`, etc.). |

### Backend

| Technology | Version | Rationale |
|---|---|---|
| Node.js | 22 LTS | Current LTS with native `--watch` mode. |
| Express | 5.x | Async error handling built in (no need to manually call `next(err)`). |
| TypeScript | 5.x (strict) | `"module": "NodeNext"`, `"moduleResolution": "NodeNext"`. All imports use `.js` extensions pointing to compiled output. |
| tsx | Latest | TypeScript execution for development (`tsx watch`). |
| Vitest | Latest | Server unit and integration tests. |
| Supertest | Latest | HTTP integration testing against the Express app (app/server split pattern — see `04-backend-architecture.md`). |

### AI & Embeddings

| Technology | Purpose | Rationale |
|---|---|---|
| Anthropic SDK (`@anthropic-ai/sdk`) | LLM calls for all agents and the Analyst | Direct SDK usage — no LangChain abstraction. We build the orchestration ourselves, which is more instructive and more impressive than wrapping a framework. The patterns we implement are LangGraph-analogous (nodes, edges, state, conditional routing) — we simply own them. |
| Claude Sonnet 4.6 (`claude-sonnet-4-6`) | Lead Orchestrator, Analyst, complex agent reasoning | Highest-capability model for synthesis and nuanced reasoning. |
| Claude Haiku 4.5 (`claude-haiku-4-5-20251001`) | Classification, simple extraction, high-volume subtasks | Cost management. When an agent needs to extract a structured field or classify a spectral type, Haiku is sufficient and far cheaper. |
| Voyage AI (`voyage-large-2-instruct`) | Text embeddings for RAG | Anthropic's recommended embedding partner. 1024 dimensions. Excellent retrieval quality for scientific and technical text. Consistent embedding space required — the same model used for indexing must be used for querying. |

### Data & Storage

| Technology | Purpose | Rationale |
|---|---|---|
| Supabase | PostgreSQL host, pgvector, auth (if needed), storage | All-in-one. pgvector extension enables vector similarity search directly in Postgres — no separate vector database infrastructure required. Proven in Poster Pilot. |
| pgvector | Vector similarity search | `match_asteroids`, `match_science_chunks`, `match_scenario_chunks` RPC functions. Cosine similarity (`<=>` operator). |

### External Data Sources

| Source | Data Provided | API Type |
|---|---|---|
| NASA NeoWs | Near-Earth object catalog, close approaches, hazard flags | REST, free, no auth |
| JPL Small Body Database (SBDB) | Orbital elements, spectral types, physical parameters, taxonomy | REST, free, no auth |
| JPL NHATS | Human-accessible asteroid targets with pre-computed delta-V budgets | REST, free, no auth |
| JPL Close Approach Data (CAD) | Future close approach predictions, miss distances | REST, free, no auth |

> **Critical**: We do not compute orbital mechanics. We consume NASA and JPL pre-computed values. The Navigator Agent reasons about these values; it does not derive them. This is architecturally appropriate — tool calls that return external data (Factor 4: Tools Are Structured Outputs) rather than LLM-hallucinated physics.

### Infrastructure & Tooling

| Tool | Purpose |
|---|---|
| npm workspaces | Monorepo management (client, server, shared, scripts) |
| Husky | Pre-commit hooks (lint, type-check, fast unit tests) |
| gitleaks | Secret scanning — prevents API keys from reaching git history |
| GitHub Actions | CI/CD — runs full test suite on every push/PR |
| Railway | Backend deployment (Node.js/Express) |
| Vercel | Frontend deployment (Angular static build) |

---

## Repository Structure

```
asteroid-bonanza/
├── client/                          # Angular 21 frontend
│   ├── src/
│   │   ├── app/
│   │   │   ├── core/                # Singleton services, interceptors, guards
│   │   │   ├── features/            # Feature-slice architecture
│   │   │   │   ├── asteroid-search/ # Browse & search
│   │   │   │   ├── asteroid-detail/ # Individual asteroid dossier
│   │   │   │   ├── analysis/        # Swarm analysis interface
│   │   │   │   ├── analyst-chat/    # RAG analyst sidebar
│   │   │   │   └── defense-watch/   # Planetary defense dashboard
│   │   │   ├── shared/              # Shared components, pipes, directives
│   │   │   └── app.config.ts
│   │   ├── styles/
│   │   │   └── globals.css          # Tailwind v4 @theme tokens
│   │   └── environments/
│   ├── .postcssrc.json              # Required for Tailwind v4 + Angular esbuild
│   └── package.json
│
├── server/                          # Express 5 backend
│   ├── src/
│   │   ├── app.ts                   # Express app, NO listen() call
│   │   ├── server.ts                # Calls app.listen() — never imported in tests
│   │   ├── routes/
│   │   │   ├── asteroids.ts         # /api/asteroids/*
│   │   │   ├── analysis.ts          # /api/analysis/*
│   │   │   ├── analyst.ts           # /api/analyst/* (SSE streaming)
│   │   │   └── defense.ts           # /api/defense/*
│   │   ├── services/
│   │   │   ├── asteroidService.ts   # Database queries, NASA API calls
│   │   │   ├── searchService.ts     # Vector similarity search
│   │   │   ├── ragService.ts        # Retrieval from both knowledge indices
│   │   │   ├── analystService.ts    # Streaming RAG chatbot
│   │   │   └── orchestrator/        # The agent swarm (see 03-ai-architecture.md)
│   │   │       ├── orchestrator.ts  # Lead Orchestrator — state machine
│   │   │       ├── navigatorAgent.ts
│   │   │       ├── geologistAgent.ts
│   │   │       ├── economistAgent.ts
│   │   │       └── riskAgent.ts
│   │   ├── db/
│   │   │   ├── supabase.ts          # Supabase client
│   │   │   └── migrations/          # SQL migration files with rollbacks
│   │   ├── errors/                  # Typed error classes
│   │   └── middleware/              # Auth, rate limit, error handler
│   └── package.json
│
├── shared/                          # Shared TypeScript types
│   └── types.d.ts                   # .d.ts not .ts — prevents rootDir expansion
│
├── scripts/                         # Offline data pipeline
│   ├── ingestNasa.ts                # Pull from NASA APIs → Supabase
│   ├── ingestDocuments.ts           # PDF → chunks → embeddings → Supabase
│   └── seedAsteroids.ts             # Seed initial asteroid set
│
├── project-specs/                   # Planning documents (this directory)
│
├── CLAUDE.md                        # AI context — written in Phase 0
├── .claude/
│   ├── settings.json                # Deny rules for secrets
│   └── rules/                       # Path-specific AI behavioral rules
├── .github/
│   └── workflows/
│       ├── ci.yml                   # Test suite on push/PR
│       └── deploy.yml               # Deploy triggers
├── .husky/
│   └── pre-commit                   # Lint + type-check + fast tests
├── package.json                     # npm workspaces root
└── railway.toml                     # Railway deployment config
```

---

*Document created: 2026-03-13*
