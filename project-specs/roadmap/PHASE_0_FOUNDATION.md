# Phase 0 — Foundation

**Goal**: A working, deployable, mobile-first skeleton with no AI features, plus all research and sourcing decisions locked down before code begins.

**Status**: Complete — exit condition met

---

## Pre-Code Research Tasks

Complete these before writing a single line of application code.

- [x] Register NASA API key at api.nasa.gov (free — takes minutes; needed for Phase 1)
- [x] Register Voyage AI account and obtain API key at voyageai.com (needed for Phase 2 embeddings; register now so it's ready)
- [x] Compile and verify RAG document source list (see RAG Document Sourcing section below; must be locked before Phase 3)
- [x] Confirm mobile navigation pattern: **bottom nav bar on mobile, sidebar on desktop** (decided)

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
- [x] Monorepo initialized with npm workspaces (`client`, `server`, `shared`, `scripts`)
- [x] Angular 21 scaffold — blank app, Tailwind v4 configured, `.postcssrc.json` in place
- [x] **Mobile-first baseline**: bottom nav bar component, base Tailwind styles written at 375px, responsive breakpoints documented in `FRONTEND_ARCHITECTURE.md`
- [x] Express 5 scaffold — `app.ts` / `server.ts` split, middleware stack, typed error classes in place
- [x] Supabase project created, pgvector extension enabled
- [x] `shared/types.d.ts` with initial type stubs (`.d.ts` not `.ts` — prevents rootDir expansion)

### 3. Project config & CI
- [x] `CLAUDE.md` written — project overview, tech stack, dev commands, guardrails, mobile-first rule explicitly stated, git commit rule explicitly stated
- [x] `.claude/settings.json` deny rules (`.env*`, `*.key`, `*.pem`, `.aws/`, `.ssh/`)
- [x] Husky pre-commit hooks (lint + type-check)
- [x] gitleaks configured (pre-commit + GitHub Actions step)
- [x] GitHub Actions CI — install, type-check, lint, build (no tests yet — nothing to test)
- [x] `railway.toml` and Vercel config stubs (written and ready — deployment itself is Phase 8)

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

### Target document list (verified 2026-03-14)

**Science index** (hard facts):
- [x] **OSIRIS-REx Bennu sample mineralogy** — Hamilton et al. (2024) — NASA public domain
  - https://ntrs.nasa.gov/api/citations/20240000430/downloads/Hamilton-SSAWG_LPSC55_20240103_1366.pdf
  - Note: The Lauretta et al. (2024) definitive paper in *Meteoritics & Planetary Science* (DOI 10.1111/maps.14227) may be paywalled; use the NTRS PDF above as primary source.
- [x] **Psyche Mission Overview** — Elkins-Tanton et al. (2022) — arXiv open access
  - https://arxiv.org/pdf/2108.07402
  - Note: 2025 Polanskey et al. paper (Space Science Reviews) blocked by Cloudflare; replaced with this open-access arXiv preprint
- [x] **DART Mission Overview** — Rivkin et al. (2021) — arXiv open access
  - https://arxiv.org/pdf/2110.11414
  - Added: planetary defense relevance; complements ESA Hera entry
- [x] **Bus-DeMeo asteroid spectral taxonomy** — DeMeo, Binzel, Slivan, Bus (2009) — HAL open archive (no arXiv preprint exists)
  - https://hal.science/hal-00545286v1/file/PEER_stage2_10.1016%252Fj.icarus.2009.02.005.pdf
  - Companion dataset: https://sbn.psi.edu/pds/resource/busdemeotax.html
- [x] **ESA Hera Mission** — Michel et al. (2022) — HAL open archive, *Planetary Science Journal*
  - https://hal.science/hal-03733008v1/file/psj_3_7_160.pdf
- [x] **JPL NHATS methodology and target list** — Abell et al. (2012) — NASA public domain
  - https://ntrs.nasa.gov/api/citations/20120001818/downloads/20120001818.pdf

**Scenario index** (2050 projections):
- [x] **NASA Planetary Science Vision 2050** — Lakew, Amato et al. (2017) — NASA public domain
  - https://ntrs.nasa.gov/api/citations/20170008907/downloads/20170008907.pdf
- [x] **NASA ISRU Plans** — Sanders, Kleinhenz, Linne (2022) — NASA public domain
  - https://ntrs.nasa.gov/api/citations/20220008799/downloads/NASA%20ISRU%20Plans_Sanders_COSPAR-Final.pdf
- [x] **ESA Space Resources Strategy** — ESA (2019) — ESA public release
  - https://sci.esa.int/documents/34161/35992/1567260390250-ESA_Space_Resources_Strategy.pdf
- [x] **Asteroid mining economics — two arXiv preprints:**
  - Hein, Matheson, Fries (2018) — "A Techno-Economic Analysis of Asteroid Mining" — https://arxiv.org/pdf/1810.03836
  - Calla, Fries, Welch (2018) — "Asteroid mining with small spacecraft and its economic feasibility" — https://arxiv.org/pdf/1808.05099

**Rule**: If a document is paywalled, find an equivalent open-access source. Do not ingest anything that is not clearly free to use.

---

*Phase document created: 2026-03-13*
