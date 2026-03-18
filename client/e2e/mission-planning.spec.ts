import { test, expect } from '@playwright/test';

/**
 * Phase 6 E2E — Mission Planning & Orbital Canvas
 *
 * Tests run at both mobile (375px) and desktop (1280px) via playwright.config.ts.
 * API calls are intercepted to avoid real backend dependency.
 */

// ── Fixtures ──────────────────────────────────────────────────────────────────

const MOCK_CANDIDATE = {
  asteroidId: '2000433',
  asteroidName: '433 Eros',
  rank: 1,
  accessibilityRating: 'good',
  minDeltaV_kms: 4.9,
  missionDurationDays: 220,
  orbitalClass: 'Amor',
  score: 0.82,
  scoreBreakdown: { accessibility: 0.85, economics: 0.75, constraintSatisfaction: 1.0 },
  rationale: 'Well-characterized S-type with low delta-V and good launch windows in 2032.',
  navigatorOutput: {
    accessibilityRating: 'good',
    minDeltaV_kms: 4.9,
    bestLaunchWindows: [],
    missionDurationDays: 220,
    orbitalClass: 'Amor',
    dataCompleteness: 0.9,
    assumptionsRequired: [],
    reasoning: 'NHATS confirms accessibility.',
    sources: [],
  },
  passesConstraints: true,
  constraintViolations: [],
};

const MOCK_SCENARIO_RESPONSE = {
  recommendations: [
    MOCK_CANDIDATE,
    { ...MOCK_CANDIDATE, asteroidId: '2101955', asteroidName: '101955 Bennu', rank: 2, score: 0.71 },
  ],
  constraints: { maxDeltaV_kms: 10 },
  topPick: MOCK_CANDIDATE,
  feasibleCount: 2,
  rankedAt: new Date().toISOString(),
};

const MOCK_PORTFOLIO_RESPONSE = {
  optimalPortfolio: [MOCK_CANDIDATE],
  portfolioScore: 0.82,
  allCandidates: [MOCK_CANDIDATE],
  constraints: { maxDeltaV_kms: 10 },
  portfolioRationale: 'Single-asteroid portfolio selected for maximum score efficiency.',
  rankedAt: new Date().toISOString(),
};

const MOCK_COMPARISON_RESPONSE = {
  candidates: [MOCK_CANDIDATE],
  missionParams: { maxDeltaV_kms: 10 },
  rankedAt: new Date().toISOString(),
};

// ── Mission Planning page ──────────────────────────────────────────────────────

test.describe('Mission Planning page', () => {
  test('page loads with mode selector and form', async ({ page }) => {
    await page.goto('/mission-planning');

    await expect(page.getByRole('heading', { name: 'Mission Planning' })).toBeVisible();

    // Mode selector buttons
    for (const label of ['Scenario', 'Compare', 'Portfolio']) {
      await expect(page.getByRole('button', { name: label, exact: true })).toBeVisible();
    }

    // Asteroid IDs textarea
    await expect(page.locator('textarea#asteroid-ids')).toBeVisible();

    // Submit button — "Build Scenario (0 asteroids)" is the initial disabled state
    await expect(page.getByRole('button', { name: 'Build Scenario (0 asteroids)' })).toBeVisible();
  });

  test('submit button is disabled with no asteroid IDs entered', async ({ page }) => {
    await page.goto('/mission-planning');
    const submit = page.getByRole('button', { name: /Build Scenario/i });
    // Button is disabled (cursor-not-allowed applied when canSubmit() is false)
    const cls = await submit.getAttribute('class');
    expect(cls).toContain('cursor-not-allowed');
  });

  test('entering asteroid IDs updates the counter', async ({ page }) => {
    await page.goto('/mission-planning');
    await page.fill('textarea#asteroid-ids', '2000433\n2101955\n2162173');
    await expect(page.getByText('3 asteroids entered')).toBeVisible();
  });

  test('switching to Portfolio mode shows portfolio size slider', async ({ page }) => {
    await page.goto('/mission-planning');
    await page.getByRole('button', { name: 'Portfolio' }).click();
    await expect(page.locator('#portfolio-size')).toBeVisible();
  });

  test('scenario mode: submitting shows ranked results (mocked)', async ({ page }) => {
    await page.route('**/api/planning/scenario', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_SCENARIO_RESPONSE),
      });
    });

    await page.goto('/mission-planning');
    await page.fill('textarea#asteroid-ids', '2000433\n2101955');

    // Set priorities to sum to 100 (default is already 50+30+20=100)
    const submit = page.getByRole('button', { name: /Build Scenario/i });
    await expect(submit).not.toHaveClass(/cursor-not-allowed/);
    await submit.click();

    // Top pick banner
    await expect(page.getByText('Top pick')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('433 Eros').first()).toBeVisible();

    // Ranked card
    await expect(page.getByText('Well-characterized S-type').first()).toBeVisible();
  });

  test('portfolio mode: submitting shows portfolio summary (mocked)', async ({ page }) => {
    await page.route('**/api/planning/portfolio', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_PORTFOLIO_RESPONSE),
      });
    });

    await page.goto('/mission-planning');
    await page.fill('textarea#asteroid-ids', '2000433');
    await page.getByRole('button', { name: 'Portfolio' }).click();

    await page.getByRole('button', { name: /Build Portfolio/i }).click();

    await expect(page.getByText('Optimal Portfolio')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Single-asteroid portfolio')).toBeVisible();
  });

  test('comparison mode: submitting shows comparison results (mocked)', async ({ page }) => {
    await page.route('**/api/planning/compare', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_COMPARISON_RESPONSE),
      });
    });

    await page.goto('/mission-planning');
    await page.fill('textarea#asteroid-ids', '2000433');
    await page.getByRole('button', { name: 'Compare' }).click();
    await page.getByRole('button', { name: /Compare \(1/i }).click();

    await expect(page.getByText('Comparison')).toBeVisible({ timeout: 5000 });
  });

  test('API error shows error message', async ({ page }) => {
    await page.route('**/api/planning/scenario', (route) => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: { code: 'SERVER_ERROR', message: 'Planning service unavailable' } }),
      });
    });

    await page.goto('/mission-planning');
    await page.fill('textarea#asteroid-ids', '2000433');
    await page.getByRole('button', { name: /Build Scenario/i }).click();

    await expect(page.getByText('Request failed')).toBeVisible({ timeout: 5000 });
  });

  test('result has dossier link for top candidate', async ({ page }) => {
    await page.route('**/api/planning/scenario', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_SCENARIO_RESPONSE),
      });
    });

    await page.goto('/mission-planning');
    await page.fill('textarea#asteroid-ids', '2000433');
    await page.getByRole('button', { name: /Build Scenario/i }).click();

    await expect(page.getByText('Top pick')).toBeVisible({ timeout: 5000 });

    // Dossier links should point to /dossier/:id
    const dossierLinks = page.locator('a[href^="/dossier/"]');
    await expect(dossierLinks.first()).toBeVisible();
  });
});

// ── Mobile layout ──────────────────────────────────────────────────────────────

test.describe('Mission planning mobile layout', () => {
  test('no horizontal overflow at 375px', async ({ page, viewport }) => {
    if (!viewport || viewport.width > 400) { test.skip(); return; }
    await page.goto('/mission-planning');
    const bodyScrollWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(bodyScrollWidth).toBeLessThanOrEqual(viewport.width + 1);
  });

  test('all interactive elements meet 44px touch target', async ({ page, viewport }) => {
    if (!viewport || viewport.width > 400) { test.skip(); return; }
    await page.goto('/mission-planning');

    for (const label of ['Scenario', 'Compare', 'Portfolio']) {
      const btn = page.getByRole('button', { name: label, exact: true });
      const box = await btn.boundingBox();
      if (box) expect(box.height).toBeGreaterThanOrEqual(44);
    }
  });
});

// ── Orbital Canvas page ────────────────────────────────────────────────────────

test.describe('Orbital Canvas page', () => {
  test('page loads with header', async ({ page }) => {
    // Mock asteroid list so page can load quickly without real DB
    await page.route('**/api/asteroids*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [],
          total: 0,
          page: 1,
          per_page: 30,
        }),
      });
    });

    await page.goto('/orbital-canvas');

    await expect(page.getByRole('heading', { name: 'Orbital Canvas' })).toBeVisible();
  });

  test('no horizontal overflow at 375px', async ({ page, viewport }) => {
    if (!viewport || viewport.width > 400) { test.skip(); return; }

    await page.route('**/api/asteroids*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [], total: 0, page: 1, per_page: 30 }),
      });
    });

    await page.goto('/orbital-canvas');
    const bodyScrollWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(bodyScrollWidth).toBeLessThanOrEqual(viewport.width + 1);
  });
});

// ── Nav links ─────────────────────────────────────────────────────────────────

test.describe('Phase 6 nav links', () => {
  test('Plan link in bottom nav navigates to mission-planning (mobile)', async ({ page, viewport }) => {
    if (!viewport || viewport.width > 400) { test.skip(); return; }

    await page.goto('/search');
    const nav = page.locator('nav').filter({ hasText: 'Plan' }).last();
    await expect(nav).toBeVisible();
    await nav.getByText('Plan').click();
    await expect(page).toHaveURL(/\/mission-planning/);
  });

  test('Plan link in sidebar navigates to mission-planning (desktop)', async ({ page, viewport }) => {
    if (!viewport || viewport.width < 768) return;

    await page.goto('/search');
    await page.locator('aside').getByText('Plan').click();
    await expect(page).toHaveURL(/\/mission-planning/);
  });

  test('Orbital Map link in sidebar navigates to orbital-canvas (desktop)', async ({ page, viewport }) => {
    if (!viewport || viewport.width < 768) return;

    await page.route('**/api/asteroids*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [], total: 0, page: 1, per_page: 30 }),
      });
    });

    await page.goto('/search');
    await page.locator('aside').getByText('Orbital Map').click();
    await expect(page).toHaveURL(/\/orbital-canvas/);
  });
});
