import { test, expect } from '@playwright/test';

/**
 * Phase 2 E2E — Search & Browse
 *
 * Tests run against both mobile (375px) and desktop (1280px) viewports
 * via playwright.config.ts projects. Both servers must be running.
 */

test.describe('Browse and dossier', () => {
  test('search page loads with asteroid results', async ({ page }) => {
    await page.goto('/search');

    // Page header visible
    await expect(page.getByRole('heading', { name: 'Asteroid Search' })).toBeVisible();

    // Cards render — wait for at least one card link (each card is an <a> to /dossier/:id)
    await expect(page.locator('a[href^="/dossier/"]').first()).toBeVisible();
  });

  test('browse → dossier → orbital data present', async ({ page }) => {
    await page.goto('/search');

    // Wait for results to load
    const firstCard = page.locator('a[href^="/dossier/"]').first();
    await expect(firstCard).toBeVisible();

    // Click the first result card
    await firstCard.click();

    // Should navigate to /dossier/:id
    await expect(page).toHaveURL(/\/dossier\/.+/);

    // Dossier page header shows an asteroid name
    await expect(page.locator('h1')).toBeVisible();

    // Orbital Elements section must be present
    await expect(page.getByRole('heading', { name: 'Orbital Elements' })).toBeVisible();

    // At least one orbital value is rendered (not all dashes)
    const orbitalSection = page.locator('section').filter({ hasText: 'Orbital Elements' });
    await expect(orbitalSection.locator('dd').first()).toBeVisible();

    // Close Approaches section present
    await expect(page.getByRole('heading', { name: 'Close Approaches' })).toBeVisible();

    // Composition section is always present regardless of analysis state
    await expect(page.locator('h2').filter({ hasText: 'Composition' }).first()).toBeVisible();
  });
});

test.describe('Semantic search', () => {
  const MOCK_SEMANTIC_RESULT = {
    data: [
      {
        id: 'test-uuid-eros',
        nasa_id: '2000433',
        name: '433 Eros',
        designation: 'A898 PA',
        full_name: '433 Eros (A898 PA)',
        is_pha: false,
        is_sentry_object: false,
        absolute_magnitude_h: 11.16,
        diameter_min_km: 7.9,
        diameter_max_km: 8.5,
        spectral_type_smass: 'S',
        spectral_type_tholen: null,
        min_orbit_intersection_au: null,
        nhats_accessible: true,
        nhats_min_delta_v_kms: 4.9,
        next_approach_date: '2056-01-22',
        next_approach_au: null,
        economic_tier: null,
        has_real_name: true,
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-01T00:00:00.000Z',
        similarity: 0.95,
      },
    ],
    total: 1,
  };

  test('semantic search returns results', async ({ page }) => {
    await page.route('**/api/asteroids/search**', (route) => {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_SEMANTIC_RESULT) });
    });

    await page.goto('/search');

    // Type a semantic query
    const input = page.getByPlaceholder(/metallic asteroid/i);
    await input.fill('metallic asteroid accessible before 2035');

    // Submit
    await page.getByRole('button', { name: 'Search' }).click();

    // Semantic search badge appears
    await expect(page.getByText('Semantic search')).toBeVisible();

    // Results render
    await expect(page.locator('a[href^="/dossier/"]').first()).toBeVisible({ timeout: 15_000 });
  });

  test('semantic search result links to dossier', async ({ page }) => {
    await page.route('**/api/asteroids/search**', (route) => {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_SEMANTIC_RESULT) });
    });
    // Mock the dossier page's asteroid API call so the page can render
    await page.route('**/api/asteroids/2000433', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ...MOCK_SEMANTIC_RESULT.data[0], spkid: null, diameter_sigma_km: null,
          orbit_epoch_jd: null, semi_major_axis_au: 1.458, eccentricity: 0.223, inclination_deg: 10.83,
          longitude_asc_node_deg: null, argument_perihelion_deg: null, mean_anomaly_deg: null,
          perihelion_distance_au: 1.133, aphelion_distance_au: 1.783, orbital_period_yr: 1.76,
          nhats_min_duration_days: null, next_approach_miss_km: null, closest_approach_date: null,
          closest_approach_au: null, composition_summary: null, resource_profile: null }),
      });
    });
    await page.route('**/api/defense/risk/2000433', (route) => {
      route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'Not found' }) });
    });
    await page.route('**/api/analysis/2000433/latest', (route) => {
      route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'Not found' }) });
    });

    await page.goto('/search');

    const input = page.getByPlaceholder(/metallic asteroid/i);
    await input.fill('large potentially hazardous asteroid');
    await page.getByRole('button', { name: 'Search' }).click();

    // Wait for results
    const firstResult = page.locator('a[href^="/dossier/"]').first();
    await expect(firstResult).toBeVisible({ timeout: 15_000 });

    // Click through to dossier
    await firstResult.click();
    await expect(page).toHaveURL(/\/dossier\/.+/);
    await expect(page.locator('h1')).toBeVisible();
  });
});

test.describe('Dossier direct access', () => {
  test('dossier page without id shows empty state', async ({ page }) => {
    await page.goto('/dossier');

    await expect(page.getByRole('heading', { name: 'No asteroid selected' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Go to Search' })).toBeVisible();
  });
});

test.describe('Navigation', () => {
  test('bottom nav visible on mobile (375px)', async ({ page, viewport }) => {
    // Only assert on mobile viewport
    if (!viewport || viewport.width > 400) return;

    await page.goto('/search');
    const nav = page.locator('nav').filter({ hasText: 'Search' }).last();
    await expect(nav).toBeVisible();

    // All 5 nav items present
    for (const label of ['Search', 'Dossier', 'Analysis', 'Analyst', 'Plan']) {
      await expect(nav.getByText(label)).toBeVisible();
    }
  });

  test('sidebar visible on desktop (1280px)', async ({ page, viewport }) => {
    // Only assert on desktop viewport
    if (!viewport || viewport.width < 768) return;

    await page.goto('/search');
    const sidebar = page.locator('aside').first();
    await expect(sidebar).toBeVisible();
    await expect(sidebar.locator('img[alt="Asteroid Bonanza"]')).toBeVisible();
  });
});
