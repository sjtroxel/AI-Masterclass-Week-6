# Phase 0 — Foundation

**Goal**: A working, deployable, mobile-first skeleton with no AI features, plus all research and sourcing decisions locked down before code begins.

**Status**: Not started

---

## Pre-Code Research Tasks

Complete these before writing a single line of application code.

- [x] Register NASA API key at api.nasa.gov (free — takes minutes; needed for Phase 1)
- [x] Register Voyage AI account and obtain API key at voyageai.com (needed for Phase 2 embeddings; register now so it's ready)
- [ ] Compile and verify RAG document source list (see RAG Document Sourcing section below; must be locked before Phase 3)
- [ ] Confirm mobile navigation pattern: **bottom nav bar on mobile, sidebar on desktop** (decided)

---

## Code Deliverables

### 1. Claude Code configuration (do this first)
- [x] `.claude/rules/typescript.md` — NodeNext `.js` import extensions, `strict: true`, no `any`, `.d.ts` for shared types
- [x] `.claude/rules/angular.md` — signals over RxJS, no NgRx, feature slice structure, `api.service.ts` only for HTTP, mobile template written first
- [x] `.claude/rules/agents.md` — agents mutate SwarmState only, confidence computed from fields never self-reported, Sonnet for orchestration Haiku for classification
- [x] `.claude/rules/testing.md` — explicit `.mockReset()` in every `beforeEach`, `app.ts` not `server.ts` in Supertest, `vi.stubGlobal('EventSource')` pattern, E2E at 375px and 1280px
- [x] `.claude/rules/database.md` — every migration has a rollback, AI fields nullable until Phase 5, no hardcoded credentials
- [x] `.claude/skills/phase-check.md` — reads current phase file, lists open vs. done deliverables, evaluates exit condition
- [x] `.claude/skills/mobile-review.md` — checks component against mobile-first spec: 375px baseline, breakpoint direction, touch targets ≥ 44px
- [x] `.claude/skills/agent-review.md` — checks agent against AI_ARCHITECTURE.md: output interface, uncertainty fields, no self-reported confidence, no agent-to-agent calls

### 2. Monorepo & scaffolds
- [ ] Monorepo initialized with npm workspaces (`client`, `server`, `shared`, `scripts`)
- [ ] Angular 21 scaffold — blank app, Tailwind v4 configured, `.postcssrc.json` in place
- [ ] **Mobile-first baseline**: bottom nav bar component, base Tailwind styles written at 375px, responsive breakpoints documented in `FRONTEND_ARCHITECTURE.md`
- [ ] Express 5 scaffold — `app.ts` / `server.ts` split, middleware stack, typed error classes in place
- [ ] Supabase project created, pgvector extension enabled
- [ ] `shared/types.d.ts` with initial type stubs (`.d.ts` not `.ts` — prevents rootDir expansion)

### 3. Project config & CI
- [x] `CLAUDE.md` written — project overview, tech stack, dev commands, guardrails, mobile-first rule explicitly stated, git commit rule explicitly stated
- [x] `.claude/settings.json` deny rules (`.env*`, `*.key`, `*.pem`, `.aws/`, `.ssh/`)
- [ ] Husky pre-commit hooks (lint + type-check)
- [ ] gitleaks configured (pre-commit + GitHub Actions step)
- [ ] GitHub Actions CI — install, type-check, lint, build (no tests yet — nothing to test)
- [ ] `railway.toml` and Vercel config stubs (written and ready — deployment itself is Phase 8)

**Exit condition**: The skeleton runs locally. `GET /api/health` returns 200 locally. The Angular app loads on mobile (Chrome DevTools or real device). CI passes on push. No AI features, no NASA data.

---

## RAG Document Sourcing

Compile and verify this list before Phase 3 begins. For each document confirm: (1) freely downloadable, (2) machine-readable PDF or plain text — not a scanned image, (3) publicly licensed or U.S. government public domain.

### Free source repositories

| Repository | URL | Notes |
|---|---|---|
| NASA Technical Reports Server (NTRS) | ntrs.nasa.gov | NASA-funded reports, U.S. government public domain |
| arXiv.org | arxiv.org | Free preprints of nearly all planetary science papers |
| NASA Science Mission Directorate | science.nasa.gov | Mission overviews, press kits, fact sheets |
| ESA Open Access | esa.int/Enabling_Support/Publications | Most ESA mission documentation |
| JPL Technical Publications | jpl.nasa.gov/resources | NHATS methodology, SBDB documentation |

### Target document list (verify each before Phase 3)

**Science index** (hard facts):
- [ ] OSIRIS-REx final sample analysis reports — NTRS
- [ ] NASA Psyche mission science overview — NTRS or NASA Science
- [ ] Bus-DeMeo (2009) spectral taxonomy paper — find arXiv preprint (original is paywalled)
- [ ] ESA HERA mission documentation — ESA Open Access
- [ ] JPL NHATS methodology document — JPL Technical Publications

**Scenario index** (2050 projections):
- [ ] NASA Planetary Science Vision 2050 workshop report — NTRS (confirmed public)
- [ ] NASA ISRU technology roadmap — NTRS
- [ ] ESA Space Resources Strategy — ESA Open Access
- [ ] Asteroid mining economics papers — find arXiv preprints specifically

**Rule**: If a document is paywalled, find an equivalent open-access source. Do not ingest anything that is not clearly free to use.

---

*Phase document created: 2026-03-13*
