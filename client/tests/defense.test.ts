/**
 * defense.test.ts
 *
 * Unit tests for Phase 7 Planetary Defense Watch logic:
 *   - Countdown to Apophis 2029 flyby (apophis-feature.component.ts)
 *   - Timeline sorting (approach-timeline.component.ts)
 *   - Filter / display helpers (defense-watch.component.ts)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

import { buildCountdown } from '../src/app/features/defense-watch/apophis-utils.js';
import { formatMissDistance, formatDate, daysUntil } from '../src/app/features/defense-watch/defense-utils.js';
import type { TimelineApproach } from '../src/app/shared/components/approach-timeline/approach-timeline.component.js';

beforeEach(() => {
  vi.resetAllMocks();
});

// ── Countdown ─────────────────────────────────────────────────────────────────

const APOPHIS_MS = new Date('2029-04-13T00:00:00Z').getTime();

describe('buildCountdown', () => {
  it('returns all zeros and past=true when now is after the flyby', () => {
    const after = APOPHIS_MS + 1_000;
    const c = buildCountdown(after);
    expect(c.past).toBe(true);
    expect(c.days).toBe(0);
    expect(c.hours).toBe(0);
    expect(c.minutes).toBe(0);
    expect(c.seconds).toBe(0);
  });

  it('returns past=false and correct days when before the flyby', () => {
    // Exactly 10 days before the flyby
    const tenDaysBefore = APOPHIS_MS - 10 * 24 * 60 * 60 * 1000;
    const c = buildCountdown(tenDaysBefore);
    expect(c.past).toBe(false);
    expect(c.days).toBe(10);
    expect(c.hours).toBe(0);
    expect(c.minutes).toBe(0);
    expect(c.seconds).toBe(0);
  });

  it('correctly breaks down hours, minutes, seconds within a day', () => {
    // 1 hour, 30 minutes, 45 seconds before the flyby
    const diff = (1 * 3600 + 30 * 60 + 45) * 1000;
    const c = buildCountdown(APOPHIS_MS - diff);
    expect(c.days).toBe(0);
    expect(c.hours).toBe(1);
    expect(c.minutes).toBe(30);
    expect(c.seconds).toBe(45);
    expect(c.past).toBe(false);
  });
});

// ── Timeline sorting ──────────────────────────────────────────────────────────

function sortApproaches(items: TimelineApproach[]): TimelineApproach[] {
  return [...items].sort(
    (a, b) =>
      new Date(a.close_approach_date).getTime() -
      new Date(b.close_approach_date).getTime(),
  );
}

describe('timeline sorting', () => {
  it('sorts approaches in ascending date order', () => {
    const unordered: TimelineApproach[] = [
      { close_approach_date: '2035-06-01', miss_distance_km: 500_000 },
      { close_approach_date: '2029-04-13', miss_distance_km: 38_017 },
      { close_approach_date: '2041-11-20', miss_distance_km: 1_200_000 },
    ];
    const sorted = sortApproaches(unordered);
    expect(sorted[0]?.close_approach_date).toBe('2029-04-13');
    expect(sorted[1]?.close_approach_date).toBe('2035-06-01');
    expect(sorted[2]?.close_approach_date).toBe('2041-11-20');
  });

  it('handles a single item without throwing', () => {
    const single: TimelineApproach[] = [
      { close_approach_date: '2029-04-13', miss_distance_km: 38_017 },
    ];
    expect(sortApproaches(single)).toHaveLength(1);
  });

  it('returns empty array for empty input', () => {
    expect(sortApproaches([])).toHaveLength(0);
  });
});

// ── Filter / display helpers ──────────────────────────────────────────────────

describe('formatMissDistance', () => {
  it('formats null as em dash', () => {
    expect(formatMissDistance(null)).toBe('—');
  });

  it('formats values in the thousands as "X.Xk km"', () => {
    expect(formatMissDistance(38_017)).toBe('38.0k km');
    expect(formatMissDistance(500)).toBe('500 km');
  });

  it('formats values over 1 million as "X.XXM km"', () => {
    expect(formatMissDistance(4_803_000)).toBe('4.80M km');
  });
});

describe('formatDate', () => {
  it('returns em dash for null', () => {
    expect(formatDate(null)).toBe('—');
  });

  it('formats a known ISO date to readable string', () => {
    // 2029-04-13 should render with Apr, 2029
    const result = formatDate('2029-04-13');
    expect(result).toContain('2029');
    expect(result).toContain('Apr');
  });
});

describe('daysUntil', () => {
  it('returns null for null input', () => {
    expect(daysUntil(null)).toBeNull();
  });

  it('returns a positive number for a future date', () => {
    const future = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
    const result = daysUntil(future);
    expect(result).not.toBeNull();
    expect(result!).toBeGreaterThan(0);
  });

  it('returns a negative number for a past date', () => {
    const past = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
    const result = daysUntil(past);
    expect(result).not.toBeNull();
    expect(result!).toBeLessThan(0);
  });
});
