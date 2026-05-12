/**
 * Route-scoped rate limiter for the agent-swarm analysis endpoints.
 *
 * Each full swarm run costs ~$0.50 in Anthropic credits and takes 60–90s of
 * inference across four Sonnet agents. Without a per-visitor cap, a small
 * amount of spammed traffic could exhaust the prepaid demo budget in minutes.
 *
 * Active in production only. Local dev and the test suite are unrestricted
 * so they don't have to fight the limiter while iterating.
 *
 * Standard RateLimit-* headers are emitted on every response (including 200s),
 * but the client uses EventSource which can't read headers — so a companion
 * GET /api/analysis/quota endpoint (wiring via getSwarmQuota below) exposes
 * the same state in a JSON body the client can read.
 */

import rateLimit, { MemoryStore } from 'express-rate-limit';
import type { Request, Response } from 'express';

const SWARM_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours
const SWARM_MAX = 2;

// Explicit shared store so the quota endpoint can peek at usage non-mutably.
const store = new MemoryStore();

export const swarmRateLimit = rateLimit({
  windowMs: SWARM_WINDOW_MS,
  max: SWARM_MAX,
  store,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env['NODE_ENV'] !== 'production',
  handler: (_req: Request, res: Response) => {
    res.status(429).json({
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message:
          "Today's 2-analysis quota is exhausted. The 4-Sonnet swarm is expensive to run, so the demo is rate-limited per visitor. Quota resets in 24 hours.",
      },
    });
  },
});

export interface SwarmQuotaStatus {
  /** Total analyses allowed per window (currently 2). */
  limit: number;
  /** Analyses the caller has consumed in the current window. */
  used: number;
  /** Analyses still available in the current window. */
  remaining: number;
  /** ISO timestamp when the window resets, or null if the caller has no usage yet. */
  resetTime: string | null;
  /** Whether rate limiting is active in this environment. False in dev/test. */
  active: boolean;
}

/**
 * Read the current rate-limit state for a key (IP) without consuming a request.
 *
 * The MemoryStore's `get()` method is non-mutating. We use it here to surface
 * the same state the standard RateLimit-* headers carry, in a form the
 * EventSource-using client can actually consume.
 */
export async function getSwarmQuota(key: string): Promise<SwarmQuotaStatus> {
  const active = process.env['NODE_ENV'] === 'production';
  if (!active) {
    return {
      limit: SWARM_MAX,
      used: 0,
      remaining: SWARM_MAX,
      resetTime: null,
      active: false,
    };
  }

  const entry = await store.get(key);
  const used = entry?.totalHits ?? 0;
  return {
    limit: SWARM_MAX,
    used,
    remaining: Math.max(0, SWARM_MAX - used),
    resetTime: entry?.resetTime?.toISOString() ?? null,
    active: true,
  };
}
