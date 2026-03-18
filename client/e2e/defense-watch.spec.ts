import { test, expect } from '@playwright/test';

/**
 * Phase 8 E2E — Defense Watch & Apophis Feature Page
 *
 * Covers:
 *   /defense          — Planetary Defense Watch (PHA list + upcoming approaches)
 *   /defense/apophis  — Apophis 2029 featured case study
 *
 * Defense-watch API calls use route interception for reliability.
 * Apophis editorial content renders statically; only the physical-profile and
 * risk sections require API data (mocked separately).
 *
 * Tests run at both mobile (375px) and desktop (1280px) viewports.
 */

// ── Fixtures ───────────────────────────────────────────────────────────────────

const MOCK_PHA_LIST = [
  {
    nasa_id: '2099942',
    name: '99942 Apophis',
    full_name: '99942 Apophis (2004 MN4)',
    next_approach_date: '2029-04-13',
    next_approach_miss_km: 38017,
    diameter_min_km: 0.31,
    diameter_max_km: 0.37,
    min_orbit_intersection_au: 0.00021,
    is_pha: true,
    is_sentry_object: false,
    hazard_rating: 'negligible',
  },
  {
    nasa_id: '2101955',
    name: '101955 Bennu',
    full_name: null,
    next_approach_date: '2135-09-25',
    next_approach_miss_km: 750_000,
    diameter_min_km: 0.47,
    diameter_max_km: 0.51,
    min_orbit_intersection_au: 0.00203,
    is_pha: true,
    is_sentry_object: false,
    hazard_rating: 'low',
  },
  {
    nasa_id: '2000433',
    name: '433 Eros',
    full_name: '433 Eros (A898 PA)',
    next_approach_date: '2056-01-22',
    next_approach_miss_km: 12_500_000,
    diameter_min_km: 7.9,
    diameter_max_km: 8.5,
    min_orbit_intersection_au: 0.14,
    is_pha: true,
    is_sentry_object: false,
    hazard_rating: 'none',
  },
];

const MOCK_UPCOMING = [
  {
    nasa_id: '2162173',
    name: '162173 Ryugu',
    full_name: '162173 Ryugu (1999 JU3)',
    next_approach_date: '2026-05-12',
    next_approach_miss_km: 9_200_000,
    diameter_min_km: 0.85,
    diameter_max_km: 0.93,
    is_pha: false,
    is_sentry_object: false,
  },
  {
    nasa_id: '2000433',
    name: '433 Eros',
    full_name: '433 Eros (A898 PA)',
    next_approach_date: '2026-06-02',
    next_approach_miss_km: 32_500_000,
    diameter_min_km: 7.9,
    diameter_max_km: 8.5,
    is_pha: false,
    is_sentry_object: false,
  },
];

const MOCK_APOPHIS_DETAIL = {
  nasa_id: '2099942',
  name: '99942 Apophis',
  full_name: '99942 Apophis (2004 MN4)',
  semi_major_axis_au: 0.9224383,
  eccentricity: 0.1914891,
  inclination_deg: 3.3382,
  orbital_period_yr: 0.8864,
  absolute_magnitude_h: 19.7,
  diameter_min_km: 0.31,
  diameter_max_km: 0.37,
  spectral_type_smass: 'Sq',
  nhats_accessible: true,
  nhats_min_delta_v_kms: 5.76,
  min_orbit_intersection_au: 0.00021,
  next_approach_date: '2029-04-13',
  next_approach_miss_km: 38017,
  closest_approach_date: '2029-04-13',
  closest_approach_au: 0.0002543,
};

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Mock the PHA list endpoint. */
async function mockPhaList(page: import('@playwright/test').Page): Promise<void> {
  await page.route('**/api/defense/pha', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: MOCK_PHA_LIST }),
    });
  });
}

/** Mock the upcoming approaches endpoint (any ?days= value). */
async function mockUpcoming(page: import('@playwright/test').Page): Promise<void> {
  await page.route('**/api/defense/upcoming**', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: MOCK_UPCOMING }),
    });
  });
}

/** Mock the Apophis detail endpoint. */
async function mockApophis(page: import('@playwright/test').Page): Promise<void> {
  await page.route('**/api/defense/apophis', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_APOPHIS_DETAIL),
    });
  });
}

/** Mock the risk assessment endpoint for Apophis (404 = no analysis yet). */
async function mockRiskNotFound(page: import('@playwright/test').Page): Promise<void> {
  await page.route('**/api/defense/risk/**', (route) => {
    route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({ error: { code: 'NOT_FOUND', message: 'No analysis' } }),
    });
  });
}

// ── Defense Watch main page (/defense) ────────────────────────────────────────

test.describe('Defense Watch — page structure', () => {
  test('page loads with "Planetary Defense Watch" heading', async ({ page }) => {
    await mockPhaList(page);
    await mockUpcoming(page);
    await page.goto('/defense');

    await expect(
      page.getByRole('heading', { name: 'Planetary Defense Watch' }),
    ).toBeVisible();
  });

  test('Apophis 2029 featured link is visible and links to /defense/apophis', async ({ page }) => {
    await mockPhaList(page);
    await mockUpcoming(page);
    await page.goto('/defense');

    const apophisLink = page.getByRole('link', { name: /Apophis 2029 — Featured Case Study/i });
    await expect(apophisLink).toBeVisible();
    await expect(apophisLink).toHaveAttribute('href', /\/defense\/apophis/);
  });

  test('PHAs tab and Upcoming Approaches tab buttons are visible', async ({ page }) => {
    await mockPhaList(page);
    await mockUpcoming(page);
    await page.goto('/defense');

    await expect(page.getByRole('button', { name: /PHAs/i })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Upcoming Approaches' })).toBeVisible();
  });
});

// ── PHA tab ────────────────────────────────────────────────────────────────────

test.describe('Defense Watch — PHA list', () => {
  test('PHA cards render with asteroid names', async ({ page }) => {
    await mockPhaList(page);
    await mockUpcoming(page);
    await page.goto('/defense');

    // Wait for PHA cards to load
    await expect(page.getByText('99942 Apophis')).toBeVisible({ timeout: 8_000 });
    await expect(page.getByText('101955 Bennu')).toBeVisible();
  });

  test('PHA count badge in tab shows total count', async ({ page }) => {
    await mockPhaList(page);
    await mockUpcoming(page);
    await page.goto('/defense');

    // The badge shows phas().length — our fixture has 3
    await expect(page.getByText('3').first()).toBeVisible({ timeout: 8_000 });
  });

  test('PHA card has Dossier and Analysis links', async ({ page }) => {
    await mockPhaList(page);
    await mockUpcoming(page);
    await page.goto('/defense');

    await expect(page.getByText('99942 Apophis')).toBeVisible({ timeout: 8_000 });

    // Dossier and Analysis links in the PHA card
    const dossierLinks = page.locator('a[href^="/dossier/"]');
    await expect(dossierLinks.first()).toBeVisible();

    const analysisLinks = page.locator('a[href^="/analysis/"]');
    await expect(analysisLinks.first()).toBeVisible();
  });

  test('PHA card shows Next Approach and Miss Distance labels', async ({ page }) => {
    await mockPhaList(page);
    await mockUpcoming(page);
    await page.goto('/defense');

    await expect(page.getByText('99942 Apophis')).toBeVisible({ timeout: 8_000 });

    await expect(page.getByText('Next Approach').first()).toBeVisible();
    await expect(page.getByText('Miss Distance').first()).toBeVisible();
  });

  test('PHA API error shows error message', async ({ page }) => {
    // PHA fails, upcoming succeeds
    await page.route('**/api/defense/pha', (route) => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: { code: 'SERVER_ERROR', message: 'DB error' } }),
      });
    });
    await mockUpcoming(page);
    await page.goto('/defense');

    await expect(
      page.getByText('Failed to load PHA list. Please try again.'),
    ).toBeVisible({ timeout: 8_000 });
  });
});

// ── Upcoming Approaches tab ────────────────────────────────────────────────────

test.describe('Defense Watch — Upcoming Approaches tab', () => {
  test('switching to Upcoming tab shows approach items', async ({ page }) => {
    await mockPhaList(page);
    await mockUpcoming(page);
    await page.goto('/defense');

    // Click the Upcoming Approaches tab
    await page.getByRole('button', { name: 'Upcoming Approaches' }).click();

    // Approach rows for our fixture data
    await expect(page.getByText('162173 Ryugu')).toBeVisible({ timeout: 8_000 });
    await expect(page.getByText('433 Eros')).toBeVisible();
  });

  test('upcoming tab shows approach count text', async ({ page }) => {
    await mockPhaList(page);
    await mockUpcoming(page);
    await page.goto('/defense');

    await page.getByRole('button', { name: 'Upcoming Approaches' }).click();

    // "N approaches in the next N days"
    await expect(page.getByText(/approaches in the next/i)).toBeVisible({ timeout: 8_000 });
  });

  test('days filter pills are shown (30d, 90d, 365d)', async ({ page }) => {
    await mockPhaList(page);
    await mockUpcoming(page);
    await page.goto('/defense');

    await page.getByRole('button', { name: 'Upcoming Approaches' }).click();

    await expect(page.getByRole('button', { name: '30d' })).toBeVisible({ timeout: 8_000 });
    await expect(page.getByRole('button', { name: '90d' })).toBeVisible();
    await expect(page.getByRole('button', { name: '365d' })).toBeVisible();
  });

  test('clicking 30d filter re-fetches with 30-day window', async ({ page }) => {
    await mockPhaList(page);

    // Track which days param is requested
    const requestedDays: string[] = [];
    await page.route('**/api/defense/upcoming**', (route) => {
      const url = new URL(route.request().url());
      requestedDays.push(url.searchParams.get('days') ?? 'none');
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [] }),
      });
    });

    await page.goto('/defense');
    await page.getByRole('button', { name: 'Upcoming Approaches' }).click();
    await page.getByRole('button', { name: '30d' }).click();

    // Should have made two requests — initial 365 + filtered 30
    expect(requestedDays).toContain('30');
  });

  test('empty state shown when no approaches in selected window', async ({ page }) => {
    await mockPhaList(page);
    await page.route('**/api/defense/upcoming**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [] }),
      });
    });

    await page.goto('/defense');
    await page.getByRole('button', { name: 'Upcoming Approaches' }).click();

    await expect(
      page.getByText(/No close approaches in the next/i),
    ).toBeVisible({ timeout: 8_000 });
  });

  test('upcoming approach rows link to dossier', async ({ page }) => {
    await mockPhaList(page);
    await mockUpcoming(page);
    await page.goto('/defense');

    await page.getByRole('button', { name: 'Upcoming Approaches' }).click();
    await expect(page.getByText('162173 Ryugu')).toBeVisible({ timeout: 8_000 });

    // Each approach row is an <a> tag linking to /dossier/:id
    const approachLinks = page.locator('a[href^="/dossier/"]');
    await expect(approachLinks.first()).toBeVisible();
  });
});

// ── Apophis feature page (/defense/apophis) ───────────────────────────────────

test.describe('Apophis Feature Page — static editorial content', () => {
  test('page loads with "Apophis 2029" heading', async ({ page }) => {
    await mockApophis(page);
    await mockRiskNotFound(page);
    await page.goto('/defense/apophis');

    await expect(page.getByRole('heading', { name: 'Apophis 2029' })).toBeVisible();
  });

  test('"Featured Case Study" badge is visible', async ({ page }) => {
    await mockApophis(page);
    await mockRiskNotFound(page);
    await page.goto('/defense/apophis');

    await expect(page.getByText('Featured Case Study')).toBeVisible();
  });

  test('intro paragraph mentions 38,017 km miss distance', async ({ page }) => {
    await mockApophis(page);
    await mockRiskNotFound(page);
    await page.goto('/defense/apophis');

    await expect(page.getByText(/38,017 km/i).first()).toBeVisible();
  });

  test('countdown to April 13, 2029 is visible with time unit labels', async ({ page }) => {
    await mockApophis(page);
    await mockRiskNotFound(page);
    await page.goto('/defense/apophis');

    // Countdown header text
    await expect(page.getByText(/Countdown to April 13, 2029/i)).toBeVisible();

    // Unit labels — Days, Hours, Minutes, Seconds
    await expect(page.getByText('Days', { exact: true })).toBeVisible();
    await expect(page.getByText('Hours', { exact: true })).toBeVisible();
    await expect(page.getByText('Minutes', { exact: true })).toBeVisible();
    await expect(page.getByText('Seconds', { exact: true })).toBeVisible();
  });

  test('"The closest pass" subtitle is present', async ({ page }) => {
    await mockApophis(page);
    await mockRiskNotFound(page);
    await page.goto('/defense/apophis');

    await expect(
      page.getByText(/closest pass of a large asteroid in recorded history/i),
    ).toBeVisible();
  });

  test('"Discovery and the First Scare" history section is present', async ({ page }) => {
    await mockApophis(page);
    await mockRiskNotFound(page);
    await page.goto('/defense/apophis');

    await expect(
      page.getByRole('heading', { name: 'Discovery and the First Scare' }),
    ).toBeVisible();
  });

  test('key facts strip shows Miss Distance and Flyby Date', async ({ page }) => {
    await mockApophis(page);
    await mockRiskNotFound(page);
    await page.goto('/defense/apophis');

    // Static facts rendered from keyFacts() computed
    await expect(page.getByText('Miss Distance').first()).toBeVisible();
    await expect(page.getByText('Flyby Date')).toBeVisible();
    await expect(page.getByText('Apr 13, 2029').first()).toBeVisible();
  });

  test('Dossier CTA link points to /dossier/2099942', async ({ page }) => {
    await mockApophis(page);
    await mockRiskNotFound(page);
    await page.goto('/defense/apophis');

    const dossierLink = page.getByRole('link', { name: /Raw Dossier/i });
    await expect(dossierLink).toBeVisible();
    await expect(dossierLink).toHaveAttribute('href', '/dossier/2099942');
  });

  test('AI Analysis CTA link points to /analysis/2099942', async ({ page }) => {
    await mockApophis(page);
    await mockRiskNotFound(page);
    await page.goto('/defense/apophis');

    // There are multiple "Run AI Analysis" / "AI Analysis" links — check the first hero CTA
    const analysisLink = page.getByRole('link', { name: 'AI Analysis' }).first();
    await expect(analysisLink).toBeVisible();
    await expect(analysisLink).toHaveAttribute('href', '/analysis/2099942');
  });

  test('"← Defense Watch" back link is present', async ({ page }) => {
    await mockApophis(page);
    await mockRiskNotFound(page);
    await page.goto('/defense/apophis');

    await expect(page.getByRole('link', { name: /← Defense Watch/i })).toBeVisible();
  });
});

test.describe('Apophis Feature Page — physical profile (data loaded)', () => {
  test('Physical Profile section shows NASA ID and spectral type when data loads', async ({ page }) => {
    await mockApophis(page);
    await mockRiskNotFound(page);
    await page.goto('/defense/apophis');

    // Section heading — only rendered when data() is not null
    await expect(
      page.getByRole('heading', { name: 'Physical Profile' }),
    ).toBeVisible({ timeout: 8_000 });

    await expect(page.getByText('2099942')).toBeVisible();
    await expect(page.getByText('Sq').first()).toBeVisible();
  });
});

test.describe('Apophis Feature Page — risk assessment section', () => {
  test('shows "No risk assessment yet" CTA when 404 from risk endpoint', async ({ page }) => {
    await mockApophis(page);
    await mockRiskNotFound(page);
    await page.goto('/defense/apophis');

    await expect(
      page.getByText('No risk assessment yet'),
    ).toBeVisible({ timeout: 8_000 });

    await expect(
      page.getByRole('link', { name: 'Run AI Analysis' }).first(),
    ).toBeVisible();
  });
});

// ── Navigation ─────────────────────────────────────────────────────────────────

test.describe('Defense Watch — navigation', () => {
  test('Apophis featured link navigates to /defense/apophis', async ({ page }) => {
    await mockPhaList(page);
    await mockUpcoming(page);
    await mockApophis(page);
    await mockRiskNotFound(page);

    await page.goto('/defense');
    await page.getByRole('link', { name: /Apophis 2029 — Featured Case Study/i }).click();

    await expect(page).toHaveURL(/\/defense\/apophis/);
    await expect(page.getByRole('heading', { name: 'Apophis 2029' })).toBeVisible();
  });

  test('Defense link in sidebar navigates to /defense (desktop)', async ({ page, viewport }) => {
    if (!viewport || viewport.width < 768) return;

    await mockPhaList(page);
    await mockUpcoming(page);
    await page.goto('/search');
    await page.locator('aside').first().getByText('Defense').click();

    await expect(page).toHaveURL(/\/defense/);
    await expect(
      page.getByRole('heading', { name: 'Planetary Defense Watch' }),
    ).toBeVisible({ timeout: 8_000 });
  });
});

// ── Mobile layout ──────────────────────────────────────────────────────────────

test.describe('Defense Watch — mobile layout', () => {
  test('no horizontal overflow on /defense at 375px', async ({ page, viewport }) => {
    if (!viewport || viewport.width > 400) { test.skip(); return; }

    await mockPhaList(page);
    await mockUpcoming(page);
    await page.goto('/defense');

    const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(viewport.width + 1);
  });

  test('Apophis featured link meets 44px touch target', async ({ page, viewport }) => {
    if (!viewport || viewport.width > 400) { test.skip(); return; }

    await mockPhaList(page);
    await mockUpcoming(page);
    await page.goto('/defense');

    const link = page.getByRole('link', { name: /Apophis 2029/i });
    await expect(link).toBeVisible();
    const box = await link.boundingBox();
    if (box) expect(box.height).toBeGreaterThanOrEqual(44);
  });

  test('PHAs and Upcoming tab buttons meet 44px touch target', async ({ page, viewport }) => {
    if (!viewport || viewport.width > 400) { test.skip(); return; }

    await mockPhaList(page);
    await mockUpcoming(page);
    await page.goto('/defense');

    for (const name of ['PHAs', 'Upcoming Approaches']) {
      const btn = page.getByRole('button', { name });
      const box = await btn.boundingBox();
      if (box) expect(box.height).toBeGreaterThanOrEqual(44);
    }
  });

  test('no horizontal overflow on /defense/apophis at 375px', async ({ page, viewport }) => {
    if (!viewport || viewport.width > 400) { test.skip(); return; }

    await mockApophis(page);
    await mockRiskNotFound(page);
    await page.goto('/defense/apophis');

    const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(viewport.width + 1);
  });

  test('Apophis CTA buttons meet 44px touch target', async ({ page, viewport }) => {
    if (!viewport || viewport.width > 400) { test.skip(); return; }

    await mockApophis(page);
    await mockRiskNotFound(page);
    await page.goto('/defense/apophis');

    const rawDossierLink = page.getByRole('link', { name: /Raw Dossier/i });
    await expect(rawDossierLink).toBeVisible();
    const box = await rawDossierLink.boundingBox();
    if (box) expect(box.height).toBeGreaterThanOrEqual(44);
  });
});
