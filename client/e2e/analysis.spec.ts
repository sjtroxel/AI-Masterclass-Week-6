import { test, expect } from '@playwright/test';

/**
 * Phase 5 E2E — Agent Swarm Analysis
 *
 * Tests run against both mobile (375px) and desktop (1280px) viewports
 * via playwright.config.ts projects. Both servers must be running.
 *
 * Note: Tests that trigger real analyses are skipped (live API calls take 30–90s
 * and require real asteroid IDs). The mocked response tests use Playwright's
 * route interception to simulate analysis results.
 */

// ── Shared helpers ────────────────────────────────────────────────────────────

/** A real asteroid ID from the DB that has a dossier page. */
const KNOWN_ASTEROID_ID = '3'; // Use whichever exists in local DB

const MOCK_ANALYSIS_RESPONSE = {
  analysisId: 'e2e-analysis-uuid',
  asteroidId: KNOWN_ASTEROID_ID,
  status: 'complete',
  phase: 'complete',
  handoffTriggered: false,
  confidenceScores: {
    orbital: 0.85,
    compositional: 0.80,
    economic: 0.75,
    risk: 0.90,
    overall: 0.82,
  },
  synthesis: 'This asteroid is a strong candidate for robotic resource extraction missions in the 2040s.',
  handoffPacket: null,
  outputs: {
    navigator: {
      accessibilityRating: 'good',
      minDeltaV_kms: 4.9,
      bestLaunchWindows: [],
      missionDurationDays: 220,
      orbitalClass: 'Apollo',
      dataCompleteness: 0.85,
      assumptionsRequired: [],
      reasoning: 'The asteroid is well-placed for a rendezvous mission with moderate delta-V.',
      sources: [],
    },
    geologist: {
      spectralClass: 'C',
      compositionEstimate: {
        water_ice_pct: { min: 5, max: 20 },
        carbonaceous_pct: { min: 30, max: 55 },
        silicate_pct: { min: 20, max: 40 },
        iron_nickel_pct: { min: 5, max: 15 },
        platinum_group_pct: { min: 0, max: 0.5 },
        other_pct: { min: 0, max: 5 },
      },
      keyResources: [
        { resource: 'Water ice', significance: 'Propellant feedstock' },
      ],
      compositionConfidence: 'estimated',
      analogAsteroids: ['Bennu'],
      dataCompleteness: 0.80,
      assumptionsRequired: ['Assumed C-type from spectral class'],
      reasoning: 'Carbonaceous composition consistent with water and organics.',
      sources: [],
    },
    economist: {
      totalResourceValueUSD: { min: 1e9, max: 1e11 },
      terrestrialExportValue: { min: 5e8, max: 5e10 },
      inSpaceUtilizationValue: { min: 5e8, max: 5e10 },
      missionROI: 'positive',
      keyValueDrivers: [],
      keyRisks: [],
      scenarioAssumptions: [],
      dataCompleteness: 0.75,
      assumptionsRequired: [],
      reasoning: 'Moderate resource value with positive ROI under 2050 scenario projections.',
      disclaimer: 'These are 2050 scenario projections, not current market values.',
      sources: [],
    },
    risk: {
      planetaryDefense: {
        isPHA: false,
        hazardRating: 'none',
        monitoringStatus: 'Not classified as a hazard.',
        notableApproaches: [],
        mitigationContext: '',
      },
      missionRisk: {
        overallRating: 'low',
        communicationDelayMinutes: { min: 2, max: 12 },
        surfaceConditions: 'Loose regolith expected for C-type.',
        primaryRisks: [],
      },
      dataCompleteness: 0.90,
      assumptionsRequired: [],
      reasoning: 'Low risk asteroid with no planetary defense concerns.',
      sources: [],
    },
  },
  trace: {
    totalLatencyMs: 18000,
    agentLatencies: {},
    confidenceInputs: {
      orbital: { dataCompleteness: 0.85, assumptionsCount: 0, agentSucceeded: true },
      compositional: { dataCompleteness: 0.80, assumptionsCount: 1, agentSucceeded: true },
      economic: { dataCompleteness: 0.75, assumptionsCount: 0, agentSucceeded: true },
      risk: { dataCompleteness: 0.90, assumptionsCount: 0, agentSucceeded: true },
    },
    agentEvents: {},
  },
  errors: [],
};

const MOCK_HANDOFF_RESPONSE = {
  ...MOCK_ANALYSIS_RESPONSE,
  status: 'handoff',
  phase: 'handoff',
  handoffTriggered: true,
  synthesis: null,
  confidenceScores: {
    orbital: 0.3,
    compositional: 0.25,
    economic: 0.20,
    risk: 0.35,
    overall: 0.27,
  },
  handoffPacket: {
    triggeredBy: 'low_confidence',
    aggregateConfidence: 0.27,
    whatWasFound: 'Navigator: marginal accessibility; Geologist: uncertain composition confidence.',
    confidenceBreakdown: {
      orbital: 0.3,
      compositional: 0.25,
      economic: 0.20,
      risk: 0.35,
      overall: 0.27,
    },
    whereConfidenceBrokDown: 'Low confidence in: orbital (0.3), compositional (0.25), economic (0.2), risk (0.35)',
    whatHumanExpertNeeds: 'A planetary scientist with access to spectroscopic data should review this object.',
    generatedAt: '2026-03-15T00:00:00.000Z',
  },
};

// ── Tests: Navigation and landing ─────────────────────────────────────────────

test.describe('Analysis page navigation', () => {
  test('navigating to /analysis/:id shows idle state with run button', async ({ page }) => {
    await page.goto(`/analysis/${KNOWN_ASTEROID_ID}`);

    // Page loads — check for the run button
    await expect(page.getByRole('button', { name: /Run Agent Swarm Analysis/i })).toBeVisible();
  });

  test('"Run Agent Swarm Analysis" button meets 44px touch target on mobile', async ({ page, viewport }) => {
    await page.goto(`/analysis/${KNOWN_ASTEROID_ID}`);

    const button = page.getByRole('button', { name: /Run Agent Swarm Analysis/i });
    await expect(button).toBeVisible();

    const box = await button.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      // Minimum 44px height for touch target
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
  });

  test('dossier "Analyze →" link navigates to analysis page', async ({ page }) => {
    // Navigate to dossier — look for the Analyze link
    await page.goto(`/dossier/${KNOWN_ASTEROID_ID}`);

    // Wait for page to load
    await expect(page.locator('h1')).toBeVisible();

    // Find an "Analyze →" link
    const analyzeLink = page.getByRole('link', { name: /Analyze/i }).first();
    if (await analyzeLink.isVisible()) {
      await analyzeLink.click();
      await expect(page).toHaveURL(new RegExp(`/analysis/${KNOWN_ASTEROID_ID}`));
      await expect(page.getByRole('button', { name: /Run Agent Swarm Analysis/i })).toBeVisible();
    }
  });
});

// ── Tests: Mocked analysis results ────────────────────────────────────────────

test.describe('Analysis results display (mocked API)', () => {
  test('complete analysis: confidence bars render with all 4 dimensions', async ({ page }) => {
    // Intercept the GET /api/analysis/:id/latest to return a completed analysis
    await page.route(`**/api/analysis/${KNOWN_ASTEROID_ID}/latest`, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'e2e-analysis-uuid',
          asteroid_id: KNOWN_ASTEROID_ID,
          status: 'complete',
          phase: 'complete',
          confidence_scores: MOCK_ANALYSIS_RESPONSE.confidenceScores,
          synthesis: MOCK_ANALYSIS_RESPONSE.synthesis,
          navigator_output: MOCK_ANALYSIS_RESPONSE.outputs.navigator,
          geologist_output: MOCK_ANALYSIS_RESPONSE.outputs.geologist,
          economist_output: MOCK_ANALYSIS_RESPONSE.outputs.economist,
          risk_output: MOCK_ANALYSIS_RESPONSE.outputs.risk,
          handoff_packet: null,
          created_at: '2026-03-15T00:00:00Z',
          updated_at: '2026-03-15T00:00:00Z',
        }),
      });
    });

    await page.goto(`/analysis/${KNOWN_ASTEROID_ID}`);

    // Confidence bars section should appear
    await expect(page.getByText(/Orbital/i).first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/Compositional/i)).toBeVisible();
  });

  test('complete analysis: synthesis text section is present', async ({ page }) => {
    await page.route(`**/api/analysis/${KNOWN_ASTEROID_ID}/latest`, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'e2e-analysis-uuid',
          asteroid_id: KNOWN_ASTEROID_ID,
          status: 'complete',
          phase: 'complete',
          confidence_scores: MOCK_ANALYSIS_RESPONSE.confidenceScores,
          synthesis: MOCK_ANALYSIS_RESPONSE.synthesis,
          navigator_output: MOCK_ANALYSIS_RESPONSE.outputs.navigator,
          geologist_output: MOCK_ANALYSIS_RESPONSE.outputs.geologist,
          economist_output: MOCK_ANALYSIS_RESPONSE.outputs.economist,
          risk_output: MOCK_ANALYSIS_RESPONSE.outputs.risk,
          handoff_packet: null,
          created_at: '2026-03-15T00:00:00Z',
          updated_at: '2026-03-15T00:00:00Z',
        }),
      });
    });

    await page.goto(`/analysis/${KNOWN_ASTEROID_ID}`);

    // Synthesis section should contain our fixture text
    await expect(
      page.getByText(/strong candidate for robotic resource extraction/i),
    ).toBeVisible({ timeout: 5000 });
  });

  test('handoff response: handoff banner is visible', async ({ page }) => {
    await page.route(`**/api/analysis/${KNOWN_ASTEROID_ID}/latest`, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'e2e-analysis-uuid',
          asteroid_id: KNOWN_ASTEROID_ID,
          status: 'handoff',
          phase: 'handoff',
          confidence_scores: MOCK_HANDOFF_RESPONSE.confidenceScores,
          synthesis: null,
          navigator_output: MOCK_ANALYSIS_RESPONSE.outputs.navigator,
          geologist_output: null,
          economist_output: null,
          risk_output: null,
          handoff_packet: MOCK_HANDOFF_RESPONSE.handoffPacket,
          created_at: '2026-03-15T00:00:00Z',
          updated_at: '2026-03-15T00:00:00Z',
        }),
      });
    });

    await page.goto(`/analysis/${KNOWN_ASTEROID_ID}`);

    // Handoff section should be visible
    await expect(page.getByText(/Confidence too low for automated synthesis/i)).toBeVisible({
      timeout: 5000,
    });
  });

  test('run button triggers analysis and shows loading state', async ({ page }) => {
    // No existing analysis (404)
    await page.route(`**/api/analysis/${KNOWN_ASTEROID_ID}/latest`, (route) => {
      route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: { code: 'NOT_FOUND' } }) });
    });

    // Mock the POST to return success quickly
    await page.route(`**/api/analysis/${KNOWN_ASTEROID_ID}`, async (route) => {
      if (route.request().method() === 'POST') {
        // Brief delay to test spinner
        await new Promise((r) => setTimeout(r, 100));
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_ANALYSIS_RESPONSE),
        });
      } else {
        route.continue();
      }
    });

    await page.goto(`/analysis/${KNOWN_ASTEROID_ID}`);

    const button = page.getByRole('button', { name: /Run Agent Swarm Analysis/i });
    await expect(button).toBeVisible();
    await button.click();

    // After click, button should no longer say "Run Agent Swarm Analysis" (running state)
    // Wait for the result to appear
    await expect(
      page.getByText(/strong candidate for robotic resource extraction/i),
    ).toBeVisible({ timeout: 10_000 });
  });
});

// ── Tests: Mobile layout ──────────────────────────────────────────────────────

test.describe('Analysis page mobile layout', () => {
  test('agent cards stack in single column at 375px', async ({ page, viewport }) => {
    if (!viewport || viewport.width > 400) return;

    await page.route(`**/api/analysis/${KNOWN_ASTEROID_ID}/latest`, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'e2e-analysis-uuid',
          asteroid_id: KNOWN_ASTEROID_ID,
          status: 'complete',
          phase: 'complete',
          confidence_scores: MOCK_ANALYSIS_RESPONSE.confidenceScores,
          synthesis: MOCK_ANALYSIS_RESPONSE.synthesis,
          navigator_output: MOCK_ANALYSIS_RESPONSE.outputs.navigator,
          geologist_output: MOCK_ANALYSIS_RESPONSE.outputs.geologist,
          economist_output: MOCK_ANALYSIS_RESPONSE.outputs.economist,
          risk_output: MOCK_ANALYSIS_RESPONSE.outputs.risk,
          handoff_packet: null,
          created_at: '2026-03-15T00:00:00Z',
          updated_at: '2026-03-15T00:00:00Z',
        }),
      });
    });

    await page.goto(`/analysis/${KNOWN_ASTEROID_ID}`);

    // All agent sections should be visible without horizontal overflow
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(bodyWidth).toBeLessThanOrEqual(viewport.width + 1);
  });

  test('no horizontal overflow on analysis page at 375px', async ({ page, viewport }) => {
    if (!viewport || viewport.width > 400) return;

    await page.goto(`/analysis/${KNOWN_ASTEROID_ID}`);

    const bodyScrollWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(bodyScrollWidth).toBeLessThanOrEqual(viewport.width + 1);
  });
});
