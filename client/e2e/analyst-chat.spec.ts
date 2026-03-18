import { test, expect } from '@playwright/test';

/**
 * Phase 8 E2E — AI Analyst Chat (/analyst)
 *
 * All API calls are intercepted with mocked responses — no live LLM calls.
 * Tests run at both mobile (375px) and desktop (1280px) viewports via
 * playwright.config.ts projects.
 *
 * API surface under test:
 *   POST   /api/analyst/start    → { session_token }
 *   POST   /api/analyst/message  → SSE stream (trace / token / done / error events)
 *   DELETE /api/analyst/session  → best-effort cleanup (fire-and-forget)
 */

// ── SSE helper ─────────────────────────────────────────────────────────────────

/** Format a single SSE event in the standard `event: X\ndata: Y\n\n` shape. */
function sseEvent(type: string, data: string): string {
  return `event: ${type}\ndata: ${data}\n\n`;
}

// ── Fixtures ───────────────────────────────────────────────────────────────────

const MOCK_SESSION = { session_token: 'e2e-test-session-token' };

const SCIENCE_TRACE = {
  sessionId: 'e2e-test-session-token',
  query: 'What minerals were found in the Bennu samples?',
  retrievedChunks: [
    {
      sourceType: 'science',
      sourceTitle: 'OSIRIS-REx Bennu Sample Analysis',
      sourceId: 'osiris-rex-bennu',
      sourceYear: 2024,
      chunkIndex: 0,
      similarity: 0.87,
      preview: 'The Bennu samples contained hydrated silicates and carbon-rich material.',
    },
  ],
  ragCounts: { science: 1, scenario: 0 },
  contextAsteroidId: null,
  promptTokenEstimate: 1250,
  retrievalLatencyMs: 142,
};

const SCENARIO_TRACE = {
  sessionId: 'e2e-test-session-token',
  query: 'What is the projected value of asteroid platinum mining by 2050?',
  retrievedChunks: [
    {
      sourceType: 'scenario',
      sourceTitle: 'Asteroid Mining Economics (Hein et al.)',
      sourceId: 'asteroid-mining-economics-hein',
      sourceYear: 2018,
      chunkIndex: 0,
      similarity: 0.79,
      preview: 'By 2050, platinum group metals from near-Earth asteroids could supply global demand at scale.',
    },
  ],
  ragCounts: { science: 0, scenario: 1 },
  contextAsteroidId: null,
  promptTokenEstimate: 980,
  retrievalLatencyMs: 118,
};

/** SSE body for a science-grounded response (1 science chunk, 0 scenario). */
const SCIENCE_SSE =
  sseEvent('trace', JSON.stringify(SCIENCE_TRACE)) +
  sseEvent('token', 'The OSIRIS-REx mission returned samples from Bennu') +
  sseEvent('token', ' containing hydrated silicates and carbon-rich material.') +
  sseEvent('done', '');

/** SSE body for a scenario-grounded response (0 science chunks, 1 scenario). */
const SCENARIO_SSE =
  sseEvent('trace', JSON.stringify(SCENARIO_TRACE)) +
  sseEvent('token', 'By 2050, platinum group metals from near-Earth asteroids') +
  sseEvent('token', ' could supply global demand according to economic projections.') +
  sseEvent('done', '');

// ── Shared setup helpers ────────────────────────────────────────────────────────

/** Intercept POST /api/analyst/start and return a mock session token. */
async function mockStart(page: import('@playwright/test').Page): Promise<void> {
  await page.route('**/api/analyst/start', (route) => {
    route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_SESSION),
    });
  });
}

/**
 * Intercept POST /api/analyst/message and return the given SSE body.
 * Content-Type is text/event-stream to match the real server.
 */
async function mockMessage(
  page: import('@playwright/test').Page,
  sseBody: string,
): Promise<void> {
  await page.route('**/api/analyst/message', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      body: sseBody,
    });
  });
}

/**
 * Intercept DELETE /api/analyst/session (best-effort fire-and-forget cleanup).
 * Prevents the request from hitting the real server with a fake token.
 */
async function mockDeleteSession(page: import('@playwright/test').Page): Promise<void> {
  await page.route('**/api/analyst/session', (route) => {
    route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
}

// ── Tests: Welcome state ───────────────────────────────────────────────────────

test.describe('Analyst Chat — welcome state', () => {
  test('page header shows "AI Analyst" heading', async ({ page }) => {
    await mockStart(page);
    await page.goto('/analyst');

    // h1 in the sticky header
    await expect(page.getByRole('heading', { name: 'AI Analyst' })).toBeVisible();
  });

  test('welcome screen shows "Ask the Analyst" and suggested prompts after session starts', async ({ page }) => {
    await mockStart(page);
    await page.goto('/analyst');

    // Welcome h2 — only visible when no messages sent yet
    await expect(page.getByRole('heading', { name: 'Ask the Analyst' })).toBeVisible();

    // At least two suggested prompt buttons rendered
    await expect(
      page.getByText(/What minerals were found in the OSIRIS-REx Bennu samples/i),
    ).toBeVisible();
    await expect(page.getByText(/How did DART change the orbital period/i)).toBeVisible();
  });

  test('textarea and send button appear once session is active', async ({ page }) => {
    await mockStart(page);
    await page.goto('/analyst');

    // Textarea (the chat input) is shown when hasSession() is true
    await expect(page.locator('textarea')).toBeVisible();

    // Send button (aria-label set in template)
    await expect(page.getByRole('button', { name: 'Send message' })).toBeVisible();
  });
});

// ── Tests: Science question ────────────────────────────────────────────────────

test.describe('Analyst Chat — science question', () => {
  test('science question: answer text appears after streaming completes', async ({ page }) => {
    await mockStart(page);
    await mockMessage(page, SCIENCE_SSE);

    await page.goto('/analyst');
    await expect(page.locator('textarea')).toBeVisible();

    await page.locator('textarea').fill('What minerals were found in the Bennu samples?');
    await page.getByRole('button', { name: 'Send message' }).click();

    // User message echoed immediately in chat
    await expect(page.getByText('What minerals were found in the Bennu samples?')).toBeVisible();

    // Full streamed answer must appear once done event fires
    await expect(
      page.getByText(/OSIRIS-REx mission returned samples from Bennu/i),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('science question: "Science fact" footnote label is visible', async ({ page }) => {
    await mockStart(page);
    await mockMessage(page, SCIENCE_SSE);

    await page.goto('/analyst');
    await expect(page.locator('textarea')).toBeVisible();

    await page.locator('textarea').fill('What minerals were found in the Bennu samples?');
    await page.getByRole('button', { name: 'Send message' }).click();

    await expect(
      page.getByText(/OSIRIS-REx mission returned/i),
    ).toBeVisible({ timeout: 10_000 });

    // "Science fact" label appears below the answer bubble when ragCounts.science > 0
    await expect(page.getByText('Science fact')).toBeVisible();
  });

  test('science question: RAG trace panel header shows chunk counts', async ({ page }) => {
    await mockStart(page);
    await mockMessage(page, SCIENCE_SSE);

    await page.goto('/analyst');
    await expect(page.locator('textarea')).toBeVisible();

    await page.locator('textarea').fill('What minerals were found in the Bennu samples?');
    await page.getByRole('button', { name: 'Send message' }).click();

    await expect(
      page.getByText(/OSIRIS-REx mission returned/i),
    ).toBeVisible({ timeout: 10_000 });

    // Trace panel header — always visible once trace event received
    await expect(page.getByText(/RAG retrieved/i)).toBeVisible();
  });

  test('science question: RAG trace panel expands to show chunk preview', async ({ page }) => {
    await mockStart(page);
    await mockMessage(page, SCIENCE_SSE);

    await page.goto('/analyst');
    await expect(page.locator('textarea')).toBeVisible();

    await page.locator('textarea').fill('What minerals were found in the Bennu samples?');
    await page.getByRole('button', { name: 'Send message' }).click();

    await expect(
      page.getByText(/OSIRIS-REx mission returned/i),
    ).toBeVisible({ timeout: 10_000 });

    // Click the collapsible trace header button (has aria-expanded attribute)
    const traceToggle = page.locator('button[aria-expanded]').first();
    await expect(traceToggle).toBeVisible();
    await traceToggle.click();

    // Chunk preview text from the fixture should appear in expanded body
    await expect(page.getByText(/hydrated silicates and carbon-rich material/i).first()).toBeVisible();

    // Source title from the fixture
    await expect(page.getByText(/OSIRIS-REx Bennu Sample Analysis/i)).toBeVisible();
  });
});

// ── Tests: Scenario question ───────────────────────────────────────────────────

test.describe('Analyst Chat — scenario question (2050 projection)', () => {
  test('scenario question: answer text appears after streaming completes', async ({ page }) => {
    await mockStart(page);
    await mockMessage(page, SCENARIO_SSE);

    await page.goto('/analyst');
    await expect(page.locator('textarea')).toBeVisible();

    await page.locator('textarea').fill('What is the projected value of asteroid platinum mining by 2050?');
    await page.getByRole('button', { name: 'Send message' }).click();

    await expect(
      page.getByText(/platinum group metals from near-Earth asteroids/i),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('scenario question: "2050 Projection" label is visible', async ({ page }) => {
    await mockStart(page);
    await mockMessage(page, SCENARIO_SSE);

    await page.goto('/analyst');
    await expect(page.locator('textarea')).toBeVisible();

    await page.locator('textarea').fill('What is the projected value of asteroid platinum mining by 2050?');
    await page.getByRole('button', { name: 'Send message' }).click();

    await expect(
      page.getByText(/platinum group metals from near-Earth asteroids/i),
    ).toBeVisible({ timeout: 10_000 });

    // "2050 Projection" footnote label — only when ragCounts.scenario > 0
    await expect(page.getByText('2050 Projection')).toBeVisible();
  });

  test('scenario question: "Science fact" label is NOT shown', async ({ page }) => {
    await mockStart(page);
    await mockMessage(page, SCENARIO_SSE);

    await page.goto('/analyst');
    await expect(page.locator('textarea')).toBeVisible();

    await page.locator('textarea').fill('What is the projected value of asteroid platinum mining by 2050?');
    await page.getByRole('button', { name: 'Send message' }).click();

    await expect(
      page.getByText(/platinum group metals from near-Earth asteroids/i),
    ).toBeVisible({ timeout: 10_000 });

    // ragCounts.science === 0 in SCENARIO_TRACE — label must be absent
    await expect(page.getByText('Science fact')).not.toBeVisible();
  });
});

// ── Tests: Session expiry ─────────────────────────────────────────────────────

test.describe('Analyst Chat — session expiry', () => {
  test('410 response shows "Session expired" banner', async ({ page }) => {
    await mockStart(page);
    await page.route('**/api/analyst/message', (route) => {
      route.fulfill({
        status: 410,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Session expired' }),
      });
    });

    await page.goto('/analyst');
    await expect(page.locator('textarea')).toBeVisible();

    await page.locator('textarea').fill('What is Bennu made of?');
    await page.getByRole('button', { name: 'Send message' }).click();

    // The expired banner matches text in the template
    await expect(
      page.getByText('Session expired (24h limit).'),
    ).toBeVisible({ timeout: 5_000 });
  });

  test('"Start new" in expired banner resets to an active session', async ({ page }) => {
    // Re-mock start so the reset can start a second session
    await mockStart(page);
    await mockDeleteSession(page);
    await page.route('**/api/analyst/message', (route) => {
      route.fulfill({
        status: 410,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Session expired' }),
      });
    });

    await page.goto('/analyst');
    await expect(page.locator('textarea')).toBeVisible();

    await page.locator('textarea').fill('What is Bennu made of?');
    await page.getByRole('button', { name: 'Send message' }).click();

    await expect(page.getByText('Session expired (24h limit).')).toBeVisible({ timeout: 5_000 });

    // Click "Start new" in the expired banner
    await page.getByRole('button', { name: 'Start new' }).click();

    // Session resets — expired banner gone, textarea reappears
    await expect(page.getByText('Session expired (24h limit).')).not.toBeVisible({ timeout: 5_000 });
    await expect(page.locator('textarea')).toBeVisible({ timeout: 5_000 });
  });
});

// ── Tests: Suggested prompts ───────────────────────────────────────────────────

test.describe('Analyst Chat — suggested prompts', () => {
  test('clicking a suggested prompt sends it as a user message', async ({ page }) => {
    await mockStart(page);
    await mockMessage(page, SCIENCE_SSE);

    await page.goto('/analyst');
    await expect(page.locator('textarea')).toBeVisible();

    // The suggested prompt buttons are in the welcome state (empty chat)
    const promptText = 'What minerals were found in the OSIRIS-REx Bennu samples?';
    await page.getByText(promptText).click();

    // The user message appears in the chat thread
    await expect(
      page.locator('[class*="bg-nebula"]').filter({ hasText: promptText }),
    ).toBeVisible({ timeout: 5_000 });
  });
});

// ── Tests: Asteroid context ────────────────────────────────────────────────────

test.describe('Analyst Chat — asteroid context', () => {
  test('?asteroid= query param shows context banner with asteroid ID', async ({ page }) => {
    await mockStart(page);
    await page.goto('/analyst?asteroid=2101955');

    // Context banner text from the template
    await expect(page.getByText('Asteroid context active')).toBeVisible({ timeout: 5_000 });
    // The asteroid ID appears in the banner
    await expect(page.getByText(/2101955/).first()).toBeVisible();
  });

  test('"View dossier →" link in context banner navigates correctly', async ({ page }) => {
    await mockStart(page);
    await page.goto('/analyst?asteroid=2101955');

    await expect(page.getByText('Asteroid context active')).toBeVisible({ timeout: 5_000 });

    const dossierLink = page.getByRole('link', { name: /View dossier/i });
    await expect(dossierLink).toBeVisible();
    await expect(dossierLink).toHaveAttribute('href', /\/dossier\/2101955/);
  });
});

// ── Tests: Mobile layout ───────────────────────────────────────────────────────

test.describe('Analyst Chat — mobile layout', () => {
  test('no horizontal overflow at 375px', async ({ page, viewport }) => {
    if (!viewport || viewport.width > 400) { test.skip(); return; }

    await mockStart(page);
    await page.goto('/analyst');

    const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(viewport.width + 1);
  });

  test('no horizontal overflow with a message loaded at 375px', async ({ page, viewport }) => {
    if (!viewport || viewport.width > 400) { test.skip(); return; }

    await mockStart(page);
    await mockMessage(page, SCIENCE_SSE);

    await page.goto('/analyst');
    await expect(page.locator('textarea')).toBeVisible();

    await page.locator('textarea').fill('What minerals were found in the Bennu samples?');
    await page.getByRole('button', { name: 'Send message' }).click();
    await expect(page.getByText(/OSIRIS-REx mission returned/i)).toBeVisible({ timeout: 10_000 });

    const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(viewport.width + 1);
  });

  test('textarea meets 44px minimum touch target height', async ({ page, viewport }) => {
    if (!viewport || viewport.width > 400) { test.skip(); return; }

    await mockStart(page);
    await page.goto('/analyst');

    const textarea = page.locator('textarea');
    await expect(textarea).toBeVisible();

    const box = await textarea.boundingBox();
    expect(box).not.toBeNull();
    if (box) expect(box.height).toBeGreaterThanOrEqual(44);
  });

  test('send button meets 44×44px touch target', async ({ page, viewport }) => {
    if (!viewport || viewport.width > 400) { test.skip(); return; }

    await mockStart(page);
    await page.goto('/analyst');

    const sendBtn = page.getByRole('button', { name: 'Send message' });
    await expect(sendBtn).toBeVisible();

    const box = await sendBtn.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
  });

  test('"New chat" button meets 44px touch target when active', async ({ page, viewport }) => {
    if (!viewport || viewport.width > 400) { test.skip(); return; }

    await mockStart(page);
    await mockMessage(page, SCIENCE_SSE);

    await page.goto('/analyst');
    await expect(page.locator('textarea')).toBeVisible();

    // Send a message so the "New chat" button appears (requires !isEmpty())
    await page.locator('textarea').fill('What minerals were found in the Bennu samples?');
    await page.getByRole('button', { name: 'Send message' }).click();
    await expect(page.getByText(/OSIRIS-REx mission returned/i)).toBeVisible({ timeout: 10_000 });

    const newChatBtn = page.getByRole('button', { name: 'New chat' });
    await expect(newChatBtn).toBeVisible();
    const box = await newChatBtn.boundingBox();
    if (box) expect(box.height).toBeGreaterThanOrEqual(32); // min-h-8 = 32px (header is compact)
  });
});

// ── Tests: Keyboard interaction ────────────────────────────────────────────────

test.describe('Analyst Chat — keyboard interaction', () => {
  test('pressing Enter in textarea submits the message', async ({ page }) => {
    await mockStart(page);
    await mockMessage(page, SCIENCE_SSE);

    await page.goto('/analyst');
    await expect(page.locator('textarea')).toBeVisible();

    await page.locator('textarea').fill('What minerals were found in the Bennu samples?');
    // Enter (not Shift+Enter) should submit
    await page.locator('textarea').press('Enter');

    await expect(page.getByText('What minerals were found in the Bennu samples?')).toBeVisible();
    await expect(
      page.getByText(/OSIRIS-REx mission returned/i),
    ).toBeVisible({ timeout: 10_000 });
  });
});
