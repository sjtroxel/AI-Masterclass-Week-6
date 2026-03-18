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
- [ ] Client tests: ≥ 80% statement coverage
- [ ] All Playwright E2E scenarios passing — at both mobile (375px) and desktop (1280px) viewports
- [ ] E2E scenario list (verify all pass):
  - Search by name → dossier → read composition and orbital data
  - Semantic search → results appear
  - Request swarm analysis → agent progress → final synthesis
  - Low-confidence result triggers handoff banner
  - Analyst chat → science question → sourced, streamed answer
  - Analyst chat → scenario question → answer labeled as 2050 projection
  - Defense Watch → Apophis 2029 visible with countdown
  - Three.js canvas → orbit renders → asteroid tap navigates to dossier (mobile)
  - Three.js canvas → orbit renders → asteroid click navigates to dossier (desktop)

### Error States & Resilience
- [ ] Loading states on all async operations (skeleton screens, not spinners where possible)
- [ ] Error messages when API calls fail — user-facing language, not raw error objects
- [ ] Retry prompts where appropriate (analysis failure, Analyst connection drop)
- [ ] Graceful degradation if NASA APIs are temporarily unavailable

### Accessibility
- [ ] Axe audit run — fix all critical and serious violations
- [ ] `inert` attribute handling on sidebars and modals (known Angular issue — must be explicitly tested)
- [ ] All interactive elements keyboard-accessible
- [ ] Touch targets ≥ 44px verified across the app (especially Three.js canvas)
- [ ] Color contrast passes WCAG AA for all text

### Performance
- [ ] Angular routes lazy-loaded (all feature modules)
- [ ] API response caching headers set appropriately
- [ ] Three.js canvas: confirm acceptable frame rate on mid-range mobile (target: 30fps minimum)
- [ ] Lighthouse mobile performance score reviewed — address any major regressions

### Security
- [ ] Final review of all endpoints — validate inputs, confirm rate limiting is tuned
- [ ] gitleaks clean run on full git history
- [ ] No secrets in client-side code or build artifacts

### Calibration
- [ ] `HANDOFF_THRESHOLD` reviewed against real outputs (should have been done in Phase 5 — confirm and document final value here)

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
