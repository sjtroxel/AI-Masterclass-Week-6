# Four Weeks of Building: A Learning Journey

*A comprehensive retrospective across the Codefi AI Masterclass projects — Week 2 through Week 5.*

---

## Table of Contents

1. [Week 2 — Mighty Mileage Meetup (Angular + Tailwind v4 Meetup App)](#week-2--mighty-maps-angular--tailwind-v4-meetup-app)
2. [Week 3 — Strawberry Star Travel App (React + Express Full-Stack)](#week-3--strawberry-star-travel-app-react--express-full-stack)
3. [Week 4 — ChronoQuizzr (AI-Powered History Geography Game)](#week-4--chronoquizzr-ai-powered-history-geography-game)
4. [Week 5 — Poster Pilot (Multimodal RAG Platform)](#week-5--poster-pilot-multimodal-rag-platform)
5. [The Bigger Picture: Four Weeks of Cumulative Growth](#the-bigger-picture-four-weeks-of-cumulative-growth)

---

## Week 2 — Mighty Mileage Meetup (Angular + Tailwind v4 Meetup App)

### What Was Built

A full-stack meetup platform with an Angular 19 frontend and a Rails backend, centered around a custom-built interactive mapping feature called **Mighty Mileage Meetup**. The app allowed users to register, create meetups with geographic locations, join/leave meetups, and post comments — with the map serving as both a display and an input mechanism.

### Technical Stack

- **Frontend**: Angular 19 (signals-based), TypeScript, Tailwind CSS v4
- **Backend**: Ruby on Rails (API mode)
- **Maps**: Leaflet.js via `@asymmetrik/ngx-leaflet`
- **Testing**: Vitest (unit), Playwright (E2E, 7 happy-path tests)
- **Auth**: JWT, injected globally via `authTokenInterceptor`

### The Four Phases of Mighty Maps

**Phase 1 — GeocodingService**: A service wrapping the Nominatim API (OpenStreetMap) to convert addresses to latitude/longitude coordinates. Established the pattern of wrapping external APIs behind a typed Angular service returning `Observable<Location>`.

**Phase 2 — View-Only MapComponent**: A Leaflet-based map component that accepted a `location` input and rendered a pin at the given coordinates. Introduced the challenge of integrating a DOM-heavy library (Leaflet) into Angular's change detection model.

**Phase 3 — Interactive Map + ReverseGeocodingService**: The map became a two-way input — users could click to drop a pin, and the app would reverse-geocode the coordinates back to a human-readable address via `ReverseGeocodingService`. The `MeetupFormComponent` gained a live spinner during geocoding, showing intermediate loading state driven by an `isReverseGeocoding` Angular signal.

**Phase 4 — UX Polish + E2E**: Final polish pass, then a full Playwright E2E suite covering the entire user journey: registration, login/logout, meetup creation with ZIP auto-lookup, join/leave, and comment posting.

### Key Technical Discoveries

**The Tailwind v4 + Angular PostCSS Problem**: This was one of the most instructive lessons of Week 2. Angular's `@angular/build:application` (esbuild-based) does *not* read `postcss.config.js` — it only reads `postcss.config.json` or `.postcssrc.json`. Without this, `@import "tailwindcss"` resolves to the static CSS file in `node_modules`, giving you the `@layer`/`@theme` structure but generating zero utility classes. The fix was to use `.postcssrc.json` with `{"plugins":{"@tailwindcss/postcss":{}}}`. This took significant debugging to uncover.

**Angular Signals and Side Effects**: The `isReverseGeocoding` signal pattern showed how Angular 19's signals model streamlines reactivity — state changes propagate cleanly through the component tree without manual change detection calls.

**Testing a DOM Library (Leaflet) in Happy-DOM**: Leaflet initializes by manipulating the DOM directly on mount, which breaks in testing environments. The solution was `overrideComponent(MapComponent, { set: { imports: [], schemas: [NO_ERRORS_SCHEMA] } })` to prevent Leaflet from initializing in tests at all. For Geolocation API testing, the pattern `vi.stubGlobal('navigator', ...)` + `afterEach(() => vi.unstubAllGlobals())` became a reusable template.

**JWT Architecture**: Rather than having each service set `Authorization` headers manually, a global `authTokenInterceptor` handles JWT injection for all HTTP calls. The `SKIP_AUTH = new HttpContextToken<boolean>(() => false)` mechanism lets services like `GeocodingService` opt out of JWT forwarding to external APIs — a clean pattern for mixed-origin API calls.

**WSL2 and Playwright**: Running Playwright in WSL2 required manual installation of system libraries (`libnspr4`, `libnss3`, and others) for Chromium. A practical lesson about the gap between "npm install" and "actually running a headless browser."

### What This Week Established

Week 2 established several foundations that carried through every subsequent project: Tailwind v4 CSS-first configuration, the value of a spec-first approach before writing code, explicit TypeScript typing across all layers, and the habit of writing a comprehensive test suite as a first-class deliverable rather than an afterthought.

---

## Week 3 — Strawberry Star Travel App (React + Express Full-Stack)

### What Was Built

A visually ambitious travel application with a **3D star map** (galactic-map feature), user authentication, and a favorites system. The project was structured as a monorepo with a React 19 + Vite frontend (`strawberry-star-travel-app`) and a Node.js/Express 4 backend (`strawberry-star-server`). A **Demo Mode** system allowed guests to use the app without registering.

### Technical Stack

- **Frontend**: React 19, TypeScript 5.9, Vite 7, Tailwind CSS v4
- **Backend**: Express 4.x, TypeScript 5.9 (ESM/NodeNext), Vitest + supertest
- **Auth**: JWT-based, routed through Express (Supabase retained only for avatar storage)
- **Architecture**: Feature-slice frontend (`src/features/<feature>/`), layered backend

### Core Features

**Authentication System**: Full JWT-based auth flow through the Express API. `AuthContext.tsx` manages auth state globally; the `useUser()` hook exposes it to components. A deliberate decision was made to retire Supabase as the auth provider and route auth and favorites entirely through the Express server — giving full control over auth logic and reducing third-party dependencies.

**Demo Mode (Hotel Key)**: A synthetic guest user system where `startDemo()` in `AuthContext.tsx` creates a demo session stored in `localStorage` with a 48-hour TTL. The `isDemoMode: boolean` flag is exposed everywhere auth state is consumed, and `useFavorites` handles both real and demo paths. The critical rule: `token` is `null` in demo mode — `Authorization` headers must never be sent. This was a UX-first design decision that made the app immediately usable for anyone without friction.

**Galactic Map**: A fully functional 3D star map with camera controls and path-plotting between destinations — the most visually complex component in the project.

**Favorites System**: Favorites work through the Express API for authenticated users, and through `localStorage` for demo users. The `useFavorites` hook abstracts this dual path transparently.

### Key Technical Discoveries

**NodeNext Module Resolution**: The backend used `"module": "NodeNext"` and `"moduleResolution": "NodeNext"` in `tsconfig.json` — the correct configuration for Node.js native ESM. This enforces an important rule: all TypeScript import paths must use `.js` extensions (referring to the *output* file extension, not the source). Forgetting this caused runtime module-not-found errors that were confusing to diagnose at first.

**App/Server Split Pattern**: `app.ts` exports the Express app with no `listen()` call. `server.ts` imports `app` and calls `listen()`. This split is critical for testing — supertest imports `app` directly and makes requests without starting a real server. Tests that call `listen()` create port conflicts and flaky behavior.

**ESM Error Handler Middleware**: Express error handler middleware must have exactly four parameters — `(err, req, res, _next)` — even if `next` is unused. ESM/ESLint's `no-unused-vars` rule conflicts with this requirement. The fix: `argsIgnorePattern: "^_"` in the ESLint config to honor underscore-prefix convention.

**Spec-First Workflow Formalized**: Week 3 formalized a workflow that became a permanent standard: enter Plan Mode → explore the codebase → write a spec document in `project-specs/` → get explicit approval from the user → then and only then write code. This prevented rework caused by misaligned expectations and created a paper trail of every architectural decision.

### What This Week Added

Week 3 deepened full-stack TypeScript expertise — particularly the subtleties of ESM on Node.js. The demo mode pattern, the app/server testing split, and the feature-slice frontend architecture all became tools carried forward. The explicit spec-first workflow became a non-negotiable working standard.

---

## Week 4 — ChronoQuizzr (AI-Powered History Geography Game)

### What Was Built

**ChronoQuizzr** is a GeoGuessr-style historical geography game — think "Where in the world did this historical event happen?" Players are given clue cards generated by an AI system called **The Chronicler** and must drop a pin on a Leaflet map to guess the location of the historical event. Points are awarded based on distance from the true coordinates using a Haversine + exponential decay scoring formula.

The most technically ambitious feature: a **two-agent LLM pipeline** where Claude Haiku generates historical event clues, an adversarial second agent critiques them for location-name leakage, and the generator rewrites clues until they pass the adversary's scrutiny.

### Technical Stack

- **Frontend**: React 19, Vite 7, TypeScript, Tailwind CSS v4, Leaflet + react-leaflet
- **Backend**: Node.js/Express, TypeScript (CommonJS output), Vitest (39 server tests), Playwright (2 E2E tests)
- **AI**: Anthropic `claude-haiku-4-5-20251001` (primary), LLMProvider interface with inactive GeminiProvider
- **Deployment**: Railway (backend) + Vercel (frontend) — with a hard-won deployment story

### Game Mechanics

- **The Chronicler Pipeline**: `chroniclerEngine.ts` implements a Generate→Adversary→Rewrite loop. The first agent generates clue text for a historical event. The second agent (adversary) checks whether the clues contain any place names, city names, or geographic identifiers that would make guessing trivial. If leakage is detected, the generator rewrites. This loop runs until the adversary approves or a maximum iteration count is reached.
- **Clue Obfuscation Rule**: Clues must NEVER contain place names. This is "The Chronicler's obfuscation protocol" — a hard constraint enforced both by the system prompt and the adversary agent.
- **Coordinates Withheld**: True coordinates are never sent to the client until after the player submits their guess. The `GameEvent` shared type uses `Omit<HistoricalEvent, 'hiddenCoords'>` to enforce this at the TypeScript layer.
- **Scoring**: `Math.round(5000 * Math.exp(-distance_km / 2000))` — at 500 km: 3,894 points; at 1,000 km: 3,033; at 2,000 km: 1,839; at 10,000 km: 34.
- **Event Pool**: 10 hand-authored seed events + 10 Claude Haiku-generated events = 20 total. The `generateBatch.ts` script runs offline to populate `generated_events.json`.

### Key Technical Discoveries

**LLM Provider Architecture**: The `LLMProvider` interface + `FatalProviderError` pattern (defined in `geminiProvider.ts` as a shared location) allows swapping providers without changing calling code. `FatalProviderError` is thrown on 401/403/404/429/529 — errors that mean retrying won't help — and stops the batch generator immediately rather than burning API credits. The pivot from Gemini to Claude is documented in `project-specs/ADR_ANTHROPIC_PIVOT.md`.

**The `shared/types.d.ts` Lesson**: Originally `shared/types.ts` — a `.ts` file shared between client and server via path aliases. This caused a subtle TypeScript compilation disaster: when `tsc` sees a `.ts` file imported from outside its `rootDir`, it implicitly expands `rootDir` to the common ancestor. This shifted all compiled output from `dist/` to `dist/server/`, making `dist/index.js` not exist. The fix: rename to `shared/types.d.ts` — a declaration file. TypeScript reads it for types but never emits it and never factors it into `rootDir` calculation.

**Railway Deployment — Three Failure Modes**:
1. *Root Directory = "server"* → build container only contains `server/`, so `../shared/` doesn't exist at build time. Fix: Root Directory = blank.
2. *NODE_ENV=production* → `npm ci` skips devDependencies → TypeScript not installed → `tsc` fails → `dist/` never created. Fix: `npm ci --include=dev` in the build command.
3. *Shared .ts file in compilation* → rootDir expansion → wrong output paths (described above). Fix: rename to `.d.ts`.

**Leaflet in React Testing**: The same Leaflet + test environment problem from Week 2 resurfaced, but this time in a React/Vitest context. Solution: `vi.mock('react-leaflet', ...)` per test file with data-testid stubs replacing the real map components.

**Theme System Without JSX dark: Prefixes**: The dark/light theme is implemented entirely via a `html.theme-light` CSS class toggling `@theme` custom properties — no `dark:` prefixes in any JSX. `ThemeContext.tsx` reads `localStorage` and `prefers-color-scheme` synchronously on init. Leaflet tiles get a CSS filter inversion for the dark theme.

**GameBoard State Machine**: The game state is an explicit `'loading' | 'playing' | 'submitting' | 'result' | 'finished' | 'error'` union — no ambiguous booleans. The distinction between the `'error'` phase (full-screen, unrecoverable session failure) and `submitError` inline state (recoverable POST failure, pin preserved) is a good example of using the type system to encode UI states precisely.

**Final Test Count**: 39/39 Vitest server tests + 30/30 Vitest client tests + 2/2 Playwright E2E = **71 tests, all green**.

### What This Week Added

Week 4 introduced the most AI-forward work so far — multi-agent LLM pipelines, provider abstraction, and the economics of AI API calls (FatalProviderError pattern). It also produced the most battle-tested deployment story: three Railway failure modes diagnosed and resolved, each producing a durable lesson about how Railway, NODE_ENV, TypeScript compilation, and module systems interact. The `shared/types.d.ts` lesson is directly applicable to any TypeScript monorepo.

---

## Week 5 — Poster Pilot (Multimodal RAG Platform)

### What Was Built

**Poster Pilot** is a professional-grade, multimodal Retrieval-Augmented Generation (RAG) platform for indexing and exploring historical poster collections — WPA art, NASA mission posters, 19th-century patent medicine advertisements, WWII propaganda, and more. It is a **Discovery Engine for visual history**, drawing from 5,000+ posters ingested from the Digital Public Library of America (DPLA), which aggregates holdings from NARA, the Library of Congress, and the Smithsonian.

The app is live in production at **https://poster-pilot.vercel.app** (frontend) and **https://poster-pilot.up.railway.app** (backend).

### Technical Stack

- **Frontend**: React 19, TypeScript (strict), Tailwind CSS v4 (CSS-first)
- **Backend**: Node.js + Express 5.x
- **Database**: Supabase (PostgreSQL + pgvector extension)
- **Embeddings**: CLIP (`openai/clip-vit-large-patch14`, 768 dimensions) via Replicate API
- **LLM**: Claude Sonnet 4.6 via Anthropic SDK
- **Testing**: Vitest (253 tests, 18 test files) + Playwright E2E (31 tests)
- **Deployment**: Railway (backend) + Vercel (frontend)

### The Ten Phases

**Phase 0 — Foundation**: Monorepo scaffolding with npm workspaces (`/client`, `/server`, `/shared`), TypeScript strict mode, Vite, tsx, Vitest, Husky pre-commit hooks, gitleaks secret scanning.

**Phase 1 — Database**: Four Supabase tables (`series`, `posters`, `poster_search_events`, `archivist_sessions`), seven migrations with rollbacks, Row Level Security policies, and two RPC functions (`match_posters` for vector similarity, `get_visual_siblings` for related poster discovery).

**Phase 2 — Server Skeleton**: Express 5 with the full security baseline — `helmet()`, `cors()` with allowlist, `express.json({ limit: '1mb' })`, `express-rate-limit`. Typed error classes (`NotFoundError`, `ValidationError`, `DatabaseError`, `AIServiceError`, `SessionExpiredError`) feeding a global error handler.

**Phase 3 — Ingestion Pipeline**: A CLI ingest worker that calls the DPLA API, preprocesses text for CLIP's 77-token limit, generates 768-dimension vector embeddings via Replicate, computes metadata completeness scores, and upserts records into Supabase with centroid tracking per series. The NARA API was discovered to be down during this phase, necessitating a pivot to DPLA as the primary data source.

**Phase 4 — Search API**: Four distinct search modes — text (CLIP text embeddings), image (CLIP image embeddings), hybrid (both), and vibe (expansive semantic search with query expansion). Results from multiple search paths are merged with Reciprocal Rank Fusion (`rankFusion.ts`). A `queryAnalyzer` service classifies incoming queries and dispatches to the appropriate search strategy.

**Phase 5 — The Archivist (RAG API)**: A grounded RAG chatbot powered by Claude Sonnet 4.6. The Archivist answers questions about posters using only retrieved NARA/DPLA metadata as context — it cannot fabricate historical facts. Server-Sent Events (SSE) stream responses in real time. Session history is stored in Supabase (`archivist_sessions`) with a 24-hour TTL.

**Phase 6 — Frontend Shell**: Tailwind v4 `@theme` token system with full dark mode support, React Router 6 SPA routing, typed API client (`api.ts`), debug utility, and stub pages.

**Phases 7–9 — Full UI**: Search interface with debounced text input, image dropzone, mode tabs; `PosterCard` with confidence indicators; CSS masonry grid; `HandoffBanner` (human escalation prompt); poster detail page; series browse pages; the `ArchivistSidebar` with streaming chat, `react-markdown` rendering, citation links, and session management.

**Phase 10 — Hardening, Testing & Deployment**: Full unit test coverage (253 tests, 99.54% statement / 92.48% branch coverage on services), Playwright E2E suite (31 tests across 6 spec files), and production deployment to Railway + Vercel.

### Key Technical Discoveries

**CLIP — Both Encoders in One Model**: The original CLIP model reference (`cjwbw/clip-vit-large-patch14`) only exposes the *image* encoder. Sending text returns a 422 error. The correct model is `openai/clip@fd95fe35...`, which accepts both text and image inputs and returns 768-dimension vectors in the same embedding space — enabling true cross-modal similarity search where a text query and an image query are directly comparable.

**pgvector Strings**: Supabase PostgREST returns `vector` columns as the *text representation* `"[v1,v2,v3,...]"` rather than a parsed `number[]`. Any code that tries to do arithmetic on the raw response will fail silently or explode. The fix is a `parseEmbedding()` utility called every time a vector is read from the database.

**Confidence Score Architecture**: Three layered scores per poster: `embedding_confidence` (CLIP cosine similarity, 0–1), `metadata_completeness` (ratio of non-null NARA fields), and `overall_confidence` (weighted average: `embedding * 0.7 + metadata * 0.3`). These are computed at ingest time and stored — never recomputed at query time. The Human Handoff threshold (`similarity_score < 0.72`) is enforced centrally in the `match_posters` RPC function so it can't be bypassed by any code path.

**HandoffBanner Calibration**: The initial threshold (`overall_confidence < 0.65`) fired constantly because DPLA metadata is sparse — almost every poster had low metadata completeness. The solution was to change the trigger condition to `similarity_score < 0.20` (a genuine CLIP miss) so the banner only fires when search results are truly irrelevant, not merely when metadata fields are empty.

**Archivist Confidence Bug — Two-Layer Fix**: The Archivist was always reporting 85% confidence regardless of actual search quality. Root cause had two parts: (1) `archivistService.ts` hardcoded a binary `0.85/0.60` output — fixed to compute the actual average of `posterSimilarityScores`. (2) `poster_similarity_scores` was never being sent in `api.chat()` calls — the server always received an empty object and fell back to 0.85. Fix required adding `scores` to `PosterContext` and threading it all the way through `setPosterContext` → `sendMessage` → `useArchivist.doSend` → `api.chat`.

**Railway nixpacks vs. Railpack**: Week 4 used Railpack (Railway's new builder). Poster Pilot used nixpacks — the distinction matters because build behavior, environment handling, and available build configuration differ. The `railway.toml` format and the EBUSY error (caused by running `npm ci` twice — once by Railway automatically, once in the build command) were hard-won lessons specific to nixpacks.

**SSE and React Streaming**: The Archivist streams responses via Server-Sent Events. The frontend uses an `EventSource` connection managed by the `useArchivist` hook, assembling streamed tokens into the growing message string as they arrive. This required careful state management to avoid rendering partial updates that look broken.

**Accessibility — `inert` Attribute**: An axe accessibility scan flagged an `aria-hidden-focus` violation on the `ArchivistSidebar` — focusable elements inside an `aria-hidden` container. The modern fix is `inert={!isOpen || undefined}` on the `<aside>` element. When `inert` is set, the browser natively prevents focus, pointer events, and AT traversal of the subtree, making explicit `tabIndex=-1` management on every child unnecessary.

**Test Architecture**: Mock isolation required `vi.resetAllMocks()` + explicit per-mock `.mockReset()` in `beforeEach` for any test block using `mockReturnValueOnce` queues. Without this, queued return values bleed between tests in unpredictable ways. Discovering this took significant debugging.

### What This Week Represented

Poster Pilot was the capstone project — the most architecturally complete, most feature-rich, and most production-ready application of the four weeks. It combined everything: full-stack TypeScript, database design, vector search, multimodal AI, RAG patterns, streaming APIs, comprehensive testing, and production deployment. It's the project that makes the journey feel complete.

---

## The Bigger Picture: Four Weeks of Cumulative Growth

### The Arc of Complexity

Looking at the four weeks as a sequence, there's a clear progression in both technical ambition and engineering discipline:

| Week | Project | Core Challenge | AI Involvement |
|------|---------|---------------|----------------|
| 2 | Mighty Mileage Meetup | Full-stack maps, Angular toolchain | None |
| 3 | Strawberry Star | Full-stack TypeScript, ESM, demo mode | None |
| 4 | ChronoQuizzr | Multi-agent LLM pipelines, game mechanics | Claude Haiku (content generation) |
| 5 | Poster Pilot | Vector search, RAG, multimodal AI, production scale | Claude Sonnet (conversational RAG) + CLIP |

Weeks 2 and 3 built the engineering foundations. Weeks 4 and 5 applied those foundations to genuinely novel AI-powered products. By Week 5, the work wasn't just "use an API" — it was designing a system where AI is the core value proposition, with all the rigor that requires: grounding constraints, confidence scoring, hallucination prevention, and human escalation paths.

### Technologies Mastered Across All Four Projects

**TypeScript (Strict Mode)**
Every project used TypeScript with `strict: true`. Over four weeks, strict TypeScript went from a constraint to a communication tool — types became the primary way of expressing intent, encoding state machines, and catching bugs before runtime. The `Omit<HistoricalEvent, 'hiddenCoords'>` pattern in ChronoQuizzr and the `PosterResult` type hierarchy in Poster Pilot are examples of types doing real architectural work.

**Tailwind CSS v4 (CSS-First)**
All four projects used Tailwind v4's CSS-first `@theme {}` system. The Angular PostCSS discovery in Week 2 (`.postcssrc.json` vs `postcss.config.js`) and the `--color-trim` vs `--color-border` collision workaround in ChronoQuizzr are examples of hard-won v4-specific knowledge that accumulated across the weeks.

**Full-Stack Architecture with Separation of Concerns**
Every project maintained strict separation: UI components don't call APIs directly, routes don't contain business logic, business logic doesn't reach into routes. This pattern was first established in Week 2 (Angular services), reinforced in Week 3 (Express layered architecture), and became a non-negotiable convention by Weeks 4 and 5.

**Testing as a First-Class Deliverable**
The test suites grew in sophistication week over week:
- Week 2: 226 unit tests, 7 E2E tests
- Week 3: Vitest unit + supertest integration tests
- Week 4: 71 Vitest tests + 2 Playwright E2E
- Week 5: 253 Vitest unit/integration tests + 31 Playwright E2E, 99.54% service coverage

By Week 5, tests weren't written after the fact — they were written alongside implementation, with mock isolation, coverage thresholds, and CI enforcement.

**Railway + Vercel Deployment**
Both ChronoQuizzr and Poster Pilot were deployed to Railway (backend) + Vercel (frontend). Each deployment surfaced different failure modes — the Railpack vs. nixpacks distinction, `NODE_ENV=production` skipping devDependencies, rootDir expansion from shared TypeScript files, the EBUSY error from double-running `npm ci` — building a comprehensive mental model of how these platforms work at the build and runtime layer.

**Leaflet Maps**
Leaflet appeared in three of the four projects (Meetup app, ChronoQuizzr, and indirectly in Poster Pilot's map considerations). Testing Leaflet — which manipulates the DOM directly on initialization — required different solutions in Angular (`NO_ERRORS_SCHEMA`) vs. React (full `vi.mock`), but the underlying challenge was the same. This recurring problem built genuine expertise in the boundary between DOM-heavy libraries and test environments.

### AI Engineering Principles That Emerged

The most significant professional growth across these four weeks is in **AI engineering** — not just "call an API," but designing AI systems responsibly:

**Grounding and Anti-Hallucination**: The Archivist in Poster Pilot cannot fabricate facts. Its system prompt explicitly instructs it to say "I don't know" when context is insufficient. The Chronicler in ChronoQuizzr cannot leak location names. In both cases, the constraint is architectural — enforced by the system prompt, the retrieval pipeline, and confidence thresholds — not just hoped for.

**Confidence Scoring**: Both AI-powered projects (ChronoQuizzr and Poster Pilot) quantify uncertainty explicitly. The Haversine scoring formula in ChronoQuizzr is a direct measure of distance from truth. The three-layer confidence system in Poster Pilot (`embedding_confidence`, `metadata_completeness`, `overall_confidence`) provides nuanced quality signals at every level.

**Human Escalation Paths**: When the AI isn't confident enough, both projects have explicit escalation paths — ChronoQuizzr's difficulty tiers signal to the player, and Poster Pilot's Human Handoff (`similarity_score < 0.72`) surfaces "The Red Button" and routes the user to a human archivist. This is a professional AI engineering pattern: never pretend the model is more capable than it is.

**Multi-Agent Pipelines**: ChronoQuizzr's Generate→Adversary→Rewrite loop is a genuine multi-agent pattern — separate agents with adversarial roles collaborating to produce better output than either could alone. This is a technique that scales to much larger AI systems.

**Provider Abstraction**: The `LLMProvider` interface pattern in ChronoQuizzr, and the `FatalProviderError` pattern for non-retryable failures, showed how to build AI features that are provider-agnostic. The pivot from Gemini to Claude (documented in an ADR) demonstrated this abstraction working in practice.

### The Spec-First Philosophy

One meta-pattern that ran through all four weeks was the **spec-first workflow**: write a specification document, get explicit approval, then write code. This created several benefits:
- Alignment on scope before any implementation investment
- A written record of every architectural decision and its rationale
- A forcing function to think through edge cases before they became bugs
- A natural checkpoint to reconsider approach before committing to it

By Week 5, this was formalized into a full project-specs directory with detailed phase documents, an ADR for the CLIP model selection, and path-specific Claude rule files (`.claude/rules/`) that encode the decisions as constraints on future work.

### What Four Weeks Produced

Across these four projects, the work produced:

- **4 deployed, production-quality applications**
- **3 different frontend frameworks** (Angular, React twice, React+3D)
- **2 different backend languages** (Rails, Node.js/TypeScript x3)
- **5,000+ historical posters** indexed in a semantic vector database
- **Multi-agent AI pipelines** with adversarial critique and rewriting
- **Grounded RAG chatbots** with confidence scoring and human handoff
- **Multimodal search** combining text and image in the same embedding space
- **420+ passing tests** across unit, integration, and E2E layers
- **Extensive deployment experience** with Railway, Vercel, Supabase, and Replicate

More than the code, though, what four weeks produced is a **professional engineering mindset** — one that plans before building, tests as a first-class concern, quantifies AI uncertainty, provides human escalation paths, and writes code that is explicit, typed, and legible rather than clever and magical.

That's a meaningful arc. Each week built on the last, each bug taught a durable lesson, and by Week 5 the work looked less like coursework and more like production software engineering.

---

*Generated 2026-03-12 from session memory across all four Masterclass projects.*
