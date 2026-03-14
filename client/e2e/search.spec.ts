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

    // Composition and Economics show pending placeholder
    await expect(page.getByText('Pending analysis').first()).toBeVisible();
  });
});

test.describe('Semantic search', () => {
  test('semantic search returns results', async ({ page }) => {
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
    for (const label of ['Search', 'Dossier', 'Analysis', 'Analyst', 'Defense']) {
      await expect(nav.getByText(label)).toBeVisible();
    }
  });

  test('sidebar visible on desktop (1280px)', async ({ page, viewport }) => {
    // Only assert on desktop viewport
    if (!viewport || viewport.width < 768) return;

    await page.goto('/search');
    const sidebar = page.locator('aside');
    await expect(sidebar).toBeVisible();
    await expect(sidebar.getByText('Asteroid Bonanza')).toBeVisible();
  });
});
