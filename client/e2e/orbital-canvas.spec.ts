import { test, expect, type Page } from '@playwright/test';

/**
 * Phase 8 E2E — Orbital Canvas (/orbital-canvas)
 *
 * The canvas renders in Canvas 2D mode in the WSL2 dev environment (no GPU/WebGL).
 * Tests verify:
 *   1. Page structure, heading, asteroid count
 *   2. Canvas container renders and reaches "ready" state
 *   3. Selecting an asteroid shows the dossier button, which navigates correctly
 *   4. Mobile layout — no overflow, touch targets
 *   5. Error state when API fails
 *
 * "Select asteroid" is triggered via Angular's `ng.getComponent()` dev-mode API,
 * which is reliable without depending on canvas pixel coordinates.
 *
 * Tests run at both mobile (375px) and desktop (1280px) viewports.
 */

// ── Fixtures ───────────────────────────────────────────────────────────────────

const MOCK_ORBITAL_ASTEROIDS = {
  data: [
    {
      nasa_id: '2162173',
      name: '162173 Ryugu',
      designation: '1999 JU3',
      full_name: '162173 Ryugu (1999 JU3)',
      absolute_magnitude_h: 18.82,
      diameter_min_km: 0.85,
      diameter_max_km: 0.93,
      is_potentially_hazardous_asteroid: false,
      next_approach_date: '2033-12-21',
      semi_major_axis_au: 1.1896,
      eccentricity: 0.1902,
      inclination_deg: 5.8836,
      mean_anomaly_deg: 180.0,
      longitude_asc_node_deg: 251.6,
      argument_perihelion_deg: 211.4,
      nhats_accessible: true,
      nhats_min_delta_v_kms: 4.66,
    },
    {
      nasa_id: '2101955',
      name: '101955 Bennu',
      designation: '1999 RQ36',
      full_name: '101955 Bennu (1999 RQ36)',
      absolute_magnitude_h: 20.18,
      diameter_min_km: 0.47,
      diameter_max_km: 0.51,
      is_potentially_hazardous_asteroid: false,
      next_approach_date: '2135-09-25',
      semi_major_axis_au: 1.1264,
      eccentricity: 0.2037,
      inclination_deg: 6.0349,
      mean_anomaly_deg: 90.0,
      longitude_asc_node_deg: 2.06,
      argument_perihelion_deg: 66.22,
      nhats_accessible: true,
      nhats_min_delta_v_kms: 5.32,
    },
  ],
  total: 2,
  page: 1,
  per_page: 20,
};

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Mock the asteroids endpoint used by the orbital canvas page. */
async function mockOrbitalAsteroids(page: Page): Promise<void> {
  await page.route('**/api/asteroids**', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_ORBITAL_ASTEROIDS),
    });
  });
}

/**
 * Programmatically trigger asteroid selection on OrbitalCanvasPageComponent
 * using Angular's dev-mode `ng.getComponent()` API.
 * Returns true if the component was found and the method was called.
 */
async function triggerAsteroidSelection(page: Page, asteroidId: string): Promise<boolean> {
  return page.evaluate((id: string) => {
    const el = document.querySelector('app-orbital-canvas-page');
    if (!el) return false;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ng = (window as any).ng;
    if (!ng?.getComponent) return false;

    const comp = ng.getComponent(el) as
      | { onAsteroidSelected(id: string): void }
      | null;
    if (!comp) return false;

    comp.onAsteroidSelected(id);
    ng.applyChanges(comp);
    return true;
  }, asteroidId);
}

// ── Page structure ─────────────────────────────────────────────────────────────

test.describe('Orbital Canvas — page structure', () => {
  test('page loads with "Orbital Canvas" heading', async ({ page }) => {
    await mockOrbitalAsteroids(page);
    await page.goto('/orbital-canvas');

    await expect(page.getByRole('heading', { name: 'Orbital Canvas' })).toBeVisible();
  });

  test('asteroid count shown in subtitle matches mock data', async ({ page }) => {
    await mockOrbitalAsteroids(page);
    await page.goto('/orbital-canvas');

    // "N asteroids plotted" — our fixture has 2 asteroids with valid orbital elements
    await expect(page.getByText(/2 asteroids plotted/i)).toBeVisible({ timeout: 8_000 });
  });

  test('canvas container (app-orbital-canvas) renders in the DOM', async ({ page }) => {
    await mockOrbitalAsteroids(page);
    await page.goto('/orbital-canvas');

    await expect(page.locator('app-orbital-canvas')).toBeVisible({ timeout: 8_000 });
  });

  test('canvas <canvas> element is present inside the orbital canvas component', async ({ page }) => {
    await mockOrbitalAsteroids(page);
    await page.goto('/orbital-canvas');

    // Canvas 2D (WSL2) or Three.js — either way a <canvas> element should be mounted
    await expect(page.locator('canvas').first()).toBeAttached({ timeout: 10_000 });
  });

  test('orbit legend hint text appears once scene is ready', async ({ page }) => {
    await mockOrbitalAsteroids(page);
    await page.goto('/orbital-canvas');

    // Hint text appears in the legend area once rendering completes
    await expect(
      page.getByText(/Orbit colors/i),
    ).toBeVisible({ timeout: 10_000 });
  });
});

// ── Asteroid selection → dossier navigation ────────────────────────────────────

test.describe('Orbital Canvas — asteroid selection and dossier navigation', () => {
  test('selecting asteroid shows "Selected asteroid" card with asteroid ID', async ({ page }) => {
    await mockOrbitalAsteroids(page);
    await page.goto('/orbital-canvas');

    // Wait for asteroids to load
    await expect(page.getByText(/asteroids plotted/i)).toBeVisible({ timeout: 8_000 });

    const triggered = await triggerAsteroidSelection(page, '2162173');
    if (!triggered) {
      // ng.getComponent() not available (production build or unsupported environment)
      test.skip();
      return;
    }

    // "Selected asteroid" card should appear
    await expect(page.getByText('Selected asteroid')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('2162173')).toBeVisible();
  });

  test('"View Dossier" button appears after selection (mobile)', async ({ page, viewport }) => {
    if (!viewport || viewport.width > 400) return;

    await mockOrbitalAsteroids(page);
    await page.goto('/orbital-canvas');

    await expect(page.getByText(/asteroids plotted/i)).toBeVisible({ timeout: 8_000 });

    const triggered = await triggerAsteroidSelection(page, '2162173');
    if (!triggered) { test.skip(); return; }

    await expect(
      page.getByRole('button', { name: 'View Dossier' }),
    ).toBeVisible({ timeout: 5_000 });
  });

  test('"View Dossier" button appears after selection (desktop)', async ({ page, viewport }) => {
    if (!viewport || viewport.width < 768) return;

    await mockOrbitalAsteroids(page);
    await page.goto('/orbital-canvas');

    await expect(page.getByText(/asteroids plotted/i)).toBeVisible({ timeout: 8_000 });

    const triggered = await triggerAsteroidSelection(page, '2101955');
    if (!triggered) { test.skip(); return; }

    await expect(
      page.getByRole('button', { name: 'View Dossier' }),
    ).toBeVisible({ timeout: 5_000 });
  });

  test('clicking "View Dossier" navigates to /dossier/:id (mobile)', async ({ page, viewport }) => {
    if (!viewport || viewport.width > 400) return;

    await mockOrbitalAsteroids(page);
    await page.goto('/orbital-canvas');

    await expect(page.getByText(/asteroids plotted/i)).toBeVisible({ timeout: 8_000 });

    const triggered = await triggerAsteroidSelection(page, '2162173');
    if (!triggered) { test.skip(); return; }

    const btn = page.getByRole('button', { name: 'View Dossier' });
    await expect(btn).toBeVisible({ timeout: 5_000 });
    await btn.click();

    // Should navigate to /dossier/2162173
    await expect(page).toHaveURL(/\/dossier\/2162173/, { timeout: 8_000 });
  });

  test('clicking "View Dossier" navigates to /dossier/:id (desktop)', async ({ page, viewport }) => {
    if (!viewport || viewport.width < 768) return;

    await mockOrbitalAsteroids(page);
    await page.goto('/orbital-canvas');

    await expect(page.getByText(/asteroids plotted/i)).toBeVisible({ timeout: 8_000 });

    const triggered = await triggerAsteroidSelection(page, '2101955');
    if (!triggered) { test.skip(); return; }

    const btn = page.getByRole('button', { name: 'View Dossier' });
    await expect(btn).toBeVisible({ timeout: 5_000 });
    await btn.click();

    await expect(page).toHaveURL(/\/dossier\/2101955/, { timeout: 8_000 });
  });
});

// ── Canvas 2D popup link (via canvas click) ────────────────────────────────────

test.describe('Orbital Canvas — canvas popup (Canvas 2D mode)', () => {
  test('canvas popup "View dossier →" link navigates on click', async ({ page }) => {
    await mockOrbitalAsteroids(page);
    await page.goto('/orbital-canvas');

    // Wait for the canvas to be ready (2D hint visible in WSL2 / Canvas 2D fallback)
    await expect(page.locator('canvas').first()).toBeAttached({ timeout: 10_000 });

    // Trigger selection programmatically, then check the popup inside the canvas component
    const triggered = await page.evaluate((id: string) => {
      const el = document.querySelector('app-orbital-canvas');
      if (!el) return false;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ng = (window as any).ng;
      if (!ng?.getComponent) return false;
      const comp = ng.getComponent(el) as {
        selectedPopup: { set(v: unknown): void };
      } | null;
      if (!comp) return false;
      // Set the selectedPopup signal directly to simulate a canvas click
      comp.selectedPopup.set({
        id,
        name: '162173 Ryugu',
        left: 80,
        top: 80,
        hasDossier: true,
      });
      ng.applyChanges(comp);
      return true;
    }, '2162173');

    if (!triggered) { test.skip(); return; }

    // The popup "View dossier →" link should appear inside the canvas
    const dossierLink = page.getByRole('link', { name: /View dossier →/i });
    await expect(dossierLink).toBeVisible({ timeout: 5_000 });

    // Clicking it should navigate to /dossier/2162173
    await dossierLink.click();
    await expect(page).toHaveURL(/\/dossier\/2162173/, { timeout: 8_000 });
  });
});

// ── Error state ────────────────────────────────────────────────────────────────

test.describe('Orbital Canvas — error state', () => {
  test('API error shows "Failed to load asteroid data" message', async ({ page }) => {
    await page.route('**/api/asteroids**', (route) => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: { code: 'SERVER_ERROR', message: 'Database error' } }),
      });
    });

    await page.goto('/orbital-canvas');

    await expect(
      page.getByText('Failed to load asteroid data.'),
    ).toBeVisible({ timeout: 8_000 });
  });
});

// ── Empty state ────────────────────────────────────────────────────────────────

test.describe('Orbital Canvas — empty state', () => {
  test('zero asteroids returned shows "0 asteroids plotted"', async ({ page }) => {
    await page.route('**/api/asteroids**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [], total: 0, page: 1, per_page: 20 }),
      });
    });

    await page.goto('/orbital-canvas');

    await expect(page.getByText(/0 asteroids plotted/i)).toBeVisible({ timeout: 8_000 });
  });
});

// ── Mobile layout ──────────────────────────────────────────────────────────────

test.describe('Orbital Canvas — mobile layout', () => {
  test('no horizontal overflow at 375px', async ({ page, viewport }) => {
    if (!viewport || viewport.width > 400) return;

    await mockOrbitalAsteroids(page);
    await page.goto('/orbital-canvas');

    const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(viewport.width + 1);
  });

  test('"View Dossier" button meets 44px touch target after selection', async ({ page, viewport }) => {
    if (!viewport || viewport.width > 400) return;

    await mockOrbitalAsteroids(page);
    await page.goto('/orbital-canvas');

    await expect(page.getByText(/asteroids plotted/i)).toBeVisible({ timeout: 8_000 });

    const triggered = await triggerAsteroidSelection(page, '2162173');
    if (!triggered) { test.skip(); return; }

    const btn = page.getByRole('button', { name: 'View Dossier' });
    await expect(btn).toBeVisible({ timeout: 5_000 });
    const box = await btn.boundingBox();
    if (box) expect(box.height).toBeGreaterThanOrEqual(44);
  });

  test('no horizontal overflow with selection card visible', async ({ page, viewport }) => {
    if (!viewport || viewport.width > 400) return;

    await mockOrbitalAsteroids(page);
    await page.goto('/orbital-canvas');

    await expect(page.getByText(/asteroids plotted/i)).toBeVisible({ timeout: 8_000 });

    const triggered = await triggerAsteroidSelection(page, '2162173');
    if (!triggered) { test.skip(); return; }

    await expect(page.getByText('Selected asteroid')).toBeVisible({ timeout: 5_000 });

    const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(viewport.width + 1);
  });
});
