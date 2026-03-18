# Phase 8 — Hardening, Polish & Production

**Goal**: Full test coverage, accessibility, performance tuning, and final production deployment.

**Status**: In progress

---

## Deliverables

### Test Coverage
- [x] Server unit + integration tests: ≥ 90% statement coverage — **93.95% achieved** (2026-03-18)
  - Installed `@vitest/coverage-v8@3.2.4`
  - Added `searchService.test.ts` → 100% coverage on `searchService` and `voyageService`
  - Added `tools.test.ts` → 100% coverage on all four agent tool functions
  - Added `search.test.ts` integration → covers `/api/asteroids/search`, all filter branches, errorHandler non-AppError path
  - Extended `defense.test.ts` → covers `DatabaseError` on analyses query and missing `planetaryDefense` path
  - 18 test files, 194 tests, all passing
- [x] Server unit + integration tests: agent error branches fully covered — **96.61% overall** (2026-03-18)
  - Extended `navigator.test.ts` → covers `fetch_close_approaches` dispatch, unknown tool catch, no-nextApproach branch
  - Extended `riskAssessor.test.ts` → covers `query_science_index` dispatch, unknown tool catch, tool throw recovery
  - Extended `economist.test.ts` → covers `query_science_index` dispatch, unknown tool catch, tool throw recovery, missing navigatorOutput message
  - Extended `geologist.test.ts` → covers tool throw recovery
  - Extended `orchestrator.test.ts` → covers riskAssessor failure catch, partial agent set (lines 147/150), synthesis no-text-block fallback, economist failure catch
  - 18 test files, 209 tests, all passing
  - Remaining uncovered lines are genuinely unreachable defensive branches (navigator `summarizeToolResult` fallback, db client config)
- [x] Client unit tests cover all pure functions/pipes (orbit-math, defense utilities); component coverage provided by E2E — no separate component unit test threshold (per Phase 8 spec)
- [x] All Playwright E2E scenarios written — specs cover both mobile (375px) and desktop (1280px) viewports (2026-03-18)
  - Existing: `search.spec.ts`, `analysis.spec.ts`, `mission-planning.spec.ts`
  - New: `analyst-chat.spec.ts` (21 tests), `defense-watch.spec.ts` (33 tests), `orbital-canvas.spec.ts` (17 tests)
  - 204 total E2E test cases registered; run with `npm run test:e2e` against live dev servers
  - `@axe-core/playwright` installed for accessibility testing
- [x] All Playwright E2E scenarios passing — **226 passed, 32 skipped, 0 failed** (2026-03-18)
  - E2E spec fixes applied 2026-03-18 (post-first live run):
    - `analysis.spec.ts`: snake_case mock bodies replaced with camelCase `MOCK_ANALYSIS_RESPONSE`/`MOCK_HANDOFF_RESPONSE`; `button.click({ force: true })` for host-element intercept; unused `viewport` param removed
    - `analyst-chat.spec.ts`: `.first()` on ambiguous multi-match locators (`/hydrated silicates/`, `/2101955/`)
    - `defense-watch.spec.ts`: `{ exact: true }` on time-unit labels (Days/Hours/Minutes/Seconds); `.first()` on ambiguous date and spectral type text; `aside.first()` for sidebar nav
    - `mission-planning.spec.ts`: `{ exact: true }` on mode selector buttons to avoid partial match with submit button; `.first()` on asteroid name text
    - `search.spec.ts`: 'Pending analysis' → 'Run agent analysis' (matches actual dossier label); route intercept mocks added to semantic search tests (avoids live Voyage AI); `aside.first()` in sidebar test
    - `accessibility.spec.ts`: `page.locator('aside').first()` throughout; `aside.first().locator('img')` for logo; all `return` viewport guards → `test.skip()` for proper Playwright skip semantics
    - `analyst-chat.component.ts`: added `aria-label="Chat message input"` to textarea (fixes critical axe violation)
    - `search.component.ts`: `<main>` → `<div>` inside search component (app shell already owns `<main>`)
  - E2E spec fixes applied 2026-03-18 (post-second live run — webkit→chromium migration + remaining failures):
    - `playwright.config.ts`: replaced `devices['iPhone SE']` (WebKit, not installed in WSL2) with `{ browserName: 'chromium', viewport: 375×812, isMobile: true, hasTouch: true }` — fixed all ~120 mobile webkit failures
    - `search.spec.ts`: fixed `MOCK_SEMANTIC_RESULT` to include all `AsteroidListItem` + `AsteroidSearchResult` fields (`id`, `is_pha`, `similarity`, etc.); 'Run agent analysis' check → h2 'Composition' heading (some asteroids have existing analysis data); sidebar logo check → `img[alt="Asteroid Bonanza"]` (logo is an `<img>` not text); added dossier API mocks in semantic search navigation test
    - `analysis.spec.ts`: added `MOCK_DOSSIER_ASTEROID` fixture + route mocks for dossier navigation test (asteroid ID '3' not in DB); scoped `/Orbital/i` confidence bar check to `section.filter({ hasText: 'Confidence Scores' })` (hidden sidebar "Orbital Map" link matched first)
    - `mission-planning.spec.ts`: changed submit button regex → exact `'Build Scenario (0 asteroids)'`; added `.first()` on `getByText('Well-characterized S-type')`
    - `accessibility.spec.ts`: added `exact: true` to mode selector button lookup (prevented strict mode violation with submit button)
    - `bottom-nav.ts`: replaced "Defense" nav item with "Plan" (→ /mission-planning) to match Phase 6 spec — tests expected Plan in mobile bottom nav
- [x] E2E scenario list — all passing (2026-03-18):
  - Search by name → dossier → read composition and orbital data ✓
  - Semantic search → results appear ✓
  - Request swarm analysis → agent progress → final synthesis ✓
  - Low-confidence result triggers handoff banner ✓
  - Analyst chat → science question → sourced, streamed answer ✓ `analyst-chat.spec.ts`
  - Analyst chat → scenario question → answer labeled as 2050 projection ✓ `analyst-chat.spec.ts`
  - Defense Watch → Apophis 2029 visible with countdown ✓ `defense-watch.spec.ts`
  - Three.js canvas → orbit renders → asteroid tap navigates to dossier (mobile) ✓ `orbital-canvas.spec.ts`
  - Three.js canvas → orbit renders → asteroid click navigates to dossier (desktop) ✓ `orbital-canvas.spec.ts`

### Error States & Resilience
- [ ] Loading states on all async operations (skeleton screens, not spinners where possible)
- [ ] Error messages when API calls fail — user-facing language, not raw error objects
- [ ] Retry prompts where appropriate (analysis failure, Analyst connection drop)
- [ ] Graceful degradation if NASA APIs are temporarily unavailable

### Accessibility
- [x] Accessibility E2E spec written — `accessibility.spec.ts` (30 tests, 2026-03-18)
  - axe-core scans on 5 key pages: zero critical/serious violations required (`color-contrast` excluded for intentionally muted secondary text)
  - ARIA attribute checks: `aria-label`, `aria-hidden`, `aria-expanded` on all interactive elements
  - Hidden element tab-order: sidebar (`hidden md:flex`) and bottom nav (`block md:hidden`) verified to be excluded from tab order when not visible
  - Keyboard navigation: Tab through sidebar, bottom nav, analyst textarea, mission planning submit
  - Touch targets ≥ 44px: bottom nav, sidebar, Apophis link, defense tabs, mission planning mode buttons
  - Landmark regions: `<main>`, `<aside>`, `<nav>`, heading hierarchy
  - Image alt text: logo `alt="Asteroid Bonanza"` verified
- [x] Axe audit spec written and violations patched — 2026-03-18:
  - `analyst-chat.component.ts` textarea: `aria-label="Chat message input"` added (critical: label-content-name-mismatch)
  - `search.component.ts`: `<main>` → `<div>` to prevent duplicate landmark (critical: landmark-unique)
- [x] `inert` attribute: sidebar uses `display:none` via Tailwind `hidden` — verified out of tab order automatically; no explicit `inert` needed (confirmed by `accessibility.spec.ts` passing)
- [x] All interactive elements keyboard-accessible (verified via `accessibility.spec.ts` passing)
- [x] Touch targets ≥ 44px verified across the app (covered in `accessibility.spec.ts` + feature specs, all passing)
- [ ] Color contrast: primary text (white / space-100 / space-200 / space-300) passes WCAG AA on space-950 background; secondary text (space-400) intentionally muted — excluded from automated gate, review manually

### Performance
- [x] Angular routes lazy-loaded (all feature modules) — all routes use `loadComponent` (verified in `app.routes.ts`)
- [ ] API response caching headers set appropriately
- [ ] Three.js canvas: confirm acceptable frame rate on mid-range mobile (target: 30fps minimum)
- [ ] Lighthouse mobile performance score reviewed — address any major regressions

### Security
- [ ] Final review of all endpoints — validate inputs, confirm rate limiting is tuned
- [ ] gitleaks clean run on full git history
- [ ] No secrets in client-side code or build artifacts

### Calibration
- [x] `HANDOFF_THRESHOLD` reviewed and calibrated — **final value: 0.30** (calibrated in Phase 5 from initial 0.55 after live runs on Apophis, Bennu, Ryugu; documented in `CLAUDE.md` and `.claude/rules/agents.md`)

### Production Deployment
- [ ] All migrations applied to production Supabase
- [ ] Railway backend deployed and healthy
- [ ] Vercel frontend deployed and healthy
- [ ] `GET /api/health` returns 200 in production
- [ ] Smoke test the full user journey on production (not staging)

### Documentation
- [ ] `CLAUDE.md` updated to reflect final project state
- [ ] Each roadmap phase file status updated to "Complete"

**Exit condition**: App is live in production, all E2E tests pass, Lighthouse mobile score is acceptable, and there are no open accessibility violations.

---

*Phase document created: 2026-03-13*
