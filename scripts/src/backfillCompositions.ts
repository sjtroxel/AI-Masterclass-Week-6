/**
 * backfillCompositions.ts
 *
 * Runs the Geologist Agent on all asteroids that lack AI-generated composition
 * data and populates three fields on the asteroids table:
 *
 *   - composition_summary  plain-language text (agent reasoning)
 *   - resource_profile     structured JSON (keyResources, compositionEstimate, etc.)
 *   - economic_tier        derived from spectral class + compositionConfidence
 *
 * Safe to re-run: skips asteroids where composition_summary IS NOT NULL.
 * Safe to Ctrl+C and resume: always re-queries from offset 0 since processed
 * rows drop out of the NULL filter automatically.
 *
 * Usage:
 *   npm run backfillCompositions                     # all unprocessed asteroids
 *   npm run backfillCompositions -- --limit 10       # first 10 only (dry run / test)
 */

import { createClient } from '@supabase/supabase-js';
import { runGeologist } from '../../server/src/services/orchestrator/geologist.js';
import type { GeologistOutput, SwarmState, MissionParams } from '../../shared/types.js';
import type { AsteroidRow } from '../../server/src/services/asteroidService.js';

// ── Env validation ────────────────────────────────────────────────────────────

const SUPABASE_URL         = process.env['SUPABASE_URL'];
const SUPABASE_SERVICE_KEY = process.env['SUPABASE_SERVICE_ROLE_KEY'];
const ANTHROPIC_API_KEY    = process.env['ANTHROPIC_API_KEY'];

if (!SUPABASE_URL)         throw new Error('Missing env: SUPABASE_URL');
if (!SUPABASE_SERVICE_KEY) throw new Error('Missing env: SUPABASE_SERVICE_ROLE_KEY');
if (!ANTHROPIC_API_KEY)    throw new Error('Missing env: ANTHROPIC_API_KEY');

// ── Config ────────────────────────────────────────────────────────────────────

const BATCH_SIZE = 50;   // rows fetched per DB query
const DELAY_MS   = 100;  // ms between Anthropic calls (rate limit headroom)

// ── Clients ───────────────────────────────────────────────────────────────────

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── Helpers ───────────────────────────────────────────────────────────────────

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Derive a coarse economic tier from spectral class and composition confidence.
 * Values must match the schema: 'exceptional' | 'high' | 'moderate' | 'low'
 */
function deriveEconomicTier(output: GeologistOutput): string {
  const cls  = (output.spectralClass.toUpperCase()[0]) ?? '';
  const conf = output.compositionConfidence;

  if (conf === 'unknown') return 'low';

  // M-type: metal-rich — highest terrestrial export value
  if (cls === 'M') return conf === 'well_characterized' ? 'exceptional' : 'high';

  // C-type: water + organics — high in-space utilization value
  if (cls === 'C') return 'high';

  // S-type: silicates + moderate metal content
  if (cls === 'S') return 'moderate';

  // X-type: ambiguous composition — value depends on sub-type
  if (cls === 'X') return conf === 'well_characterized' ? 'high' : 'moderate';

  // Uncertain composition → conservatively low
  if (conf === 'uncertain') return 'low';

  return 'moderate';
}

/** Build the minimal SwarmState needed to satisfy the Geologist's type signature. */
function buildMinimalState(asteroidId: string): SwarmState {
  return {
    asteroidId,
    missionParams: {} satisfies MissionParams,
    requestedAgents: ['geologist'],
    phase: 'geologizing',
    errors: [],
    handoffTriggered: false,
  };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  // Parse --limit flag
  const limitIdx = process.argv.indexOf('--limit');
  const limit: number | null =
    limitIdx !== -1 ? parseInt(process.argv[limitIdx + 1] ?? '0', 10) : null;

  console.log('=== Asteroid Bonanza — Composition Backfill ===');
  console.log(`Started: ${new Date().toISOString()}`);
  if (limit !== null) console.log(`Limit: ${limit} asteroids`);
  console.log('');

  let processed = 0;
  let succeeded = 0;
  let failed    = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (limit !== null && processed >= limit) break;

    // Always query from the top of the NULL pool — processed rows drop out
    const { data, error } = await supabaseAdmin
      .from('asteroids')
      .select('*')
      .is('composition_summary', null)
      .limit(BATCH_SIZE)
      .order('created_at', { ascending: true });

    if (error) throw new Error(`DB fetch failed: ${error.message}`);
    if (!data || data.length === 0) {
      console.log('No more unprocessed asteroids. Backfill complete.');
      break;
    }

    for (const row of data) {
      if (limit !== null && processed >= limit) break;

      const asteroid = row as AsteroidRow;
      const label = asteroid.name ?? asteroid.full_name ?? asteroid.nasa_id;

      console.log(`[${processed + 1}${limit !== null ? `/${limit}` : ''}] ${label} (${asteroid.nasa_id})`);

      try {
        const { output } = await runGeologist(
          asteroid,
          buildMinimalState(asteroid.id),
          {} satisfies MissionParams,
        );

        const economicTier = deriveEconomicTier(output);

        const resourceProfile = {
          spectralClass:        output.spectralClass,
          compositionConfidence: output.compositionConfidence,
          compositionEstimate:  output.compositionEstimate,
          keyResources:         output.keyResources,
          analogAsteroids:      output.analogAsteroids,
          sources:              output.sources,
        };

        const { error: updateError } = await supabaseAdmin
          .from('asteroids')
          .update({
            composition_summary: output.reasoning,
            resource_profile:    resourceProfile,
            economic_tier:       economicTier,
          })
          .eq('id', asteroid.id);

        if (updateError) throw new Error(`DB update failed: ${updateError.message}`);

        console.log(
          `  ✓  class=${output.spectralClass} | tier=${economicTier} ` +
          `| confidence=${output.compositionConfidence} ` +
          `| completeness=${output.dataCompleteness}`,
        );

        succeeded++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`  ✗  ${label}: ${msg}`);
        failed++;
      }

      processed++;
      await sleep(DELAY_MS);
    }
  }

  console.log('');
  console.log('=== Backfill Summary ===');
  console.log(`Processed: ${processed} | Succeeded: ${succeeded} | Failed: ${failed}`);
  console.log(`Finished:  ${new Date().toISOString()}`);

  if (failed > 0) {
    console.log(
      `\nNote: ${failed} asteroid(s) failed and were skipped. ` +
      'Re-run the script to retry (failed rows remain null).',
    );
  }
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`\n✗ Backfill failed: ${msg}`);
  process.exit(1);
});
