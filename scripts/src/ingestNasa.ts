/**
 * ingestNasa.ts
 *
 * Full NEO catalog ingest: NASA NeoWs → Supabase asteroids table.
 * Run via: npm run ingestNasa (from project root)
 *
 * Rate limit: 1,000 req/hr (registered NASA key).
 * ~35,000 NEOs ÷ 20 per page = ~1,750 browse requests ≈ 1.75 hrs.
 * Progress is logged every 10 pages; safe to Ctrl+C and resume (upsert is idempotent).
 */

import { createClient } from '@supabase/supabase-js';
import { NeoWsService } from '../../server/src/services/nasaApi/NeoWsService.js';
import { NHATSService } from '../../server/src/services/nasaApi/NHATSService.js';
import type { NeoWsObject, NeoWsCloseApproach } from '../../server/src/services/nasaApi/types.js';
import type { NHATSAccessibility } from '../../server/src/services/nasaApi/NHATSService.js';

// ── Env validation ────────────────────────────────────────────────────────────

const SUPABASE_URL        = process.env['SUPABASE_URL'];
const SUPABASE_SERVICE_KEY = process.env['SUPABASE_SERVICE_ROLE_KEY'];
const NASA_API_KEY         = process.env['NASA_API_KEY'];

if (!SUPABASE_URL)        throw new Error('Missing env: SUPABASE_URL');
if (!SUPABASE_SERVICE_KEY) throw new Error('Missing env: SUPABASE_SERVICE_ROLE_KEY');
if (!NASA_API_KEY)         throw new Error('Missing env: NASA_API_KEY');

// ── Config ────────────────────────────────────────────────────────────────────

const PAGE_SIZE          = 20;    // NASA NeoWs max per page
const BATCH_SIZE         = 100;   // rows per Supabase upsert
const RATE_DELAY_MS      = 3_700; // 3.7s between pages → ~970 req/hr (safely < 1000)
const LOG_EVERY_N_PAGES  = 10;

// ── Clients ───────────────────────────────────────────────────────────────────

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const neoWs = new NeoWsService(NASA_API_KEY);
const nhats = new NHATSService();

// ── Helpers ───────────────────────────────────────────────────────────────────

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const today = new Date().toISOString().slice(0, 10);

// Derive next approach (first future date) and closest approach (smallest AU)
// from the NeoWs close_approach_data array (Earth approaches only).
function summarizeApproaches(approaches: NeoWsCloseApproach[]): {
  nextApproachDate: string | null;
  nextApproachAu: number | null;
  nextApproachMissKm: number | null;
  closestApproachDate: string | null;
  closestApproachAu: number | null;
} {
  if (approaches.length === 0) {
    return {
      nextApproachDate: null,
      nextApproachAu: null,
      nextApproachMissKm: null,
      closestApproachDate: null,
      closestApproachAu: null,
    };
  }

  const future = approaches.filter((a) => a.close_approach_date >= today);
  const next = future[0] ?? null;

  let closest: NeoWsCloseApproach | null = null;
  for (const a of approaches) {
    if (!closest || parseFloat(a.miss_distance.astronomical) < parseFloat(closest.miss_distance.astronomical)) {
      closest = a;
    }
  }

  return {
    nextApproachDate: next?.close_approach_date ?? null,
    nextApproachAu: next ? parseFloat(next.miss_distance.astronomical) : null,
    nextApproachMissKm: next ? parseFloat(next.miss_distance.kilometers) : null,
    closestApproachDate: closest?.close_approach_date ?? null,
    closestApproachAu: closest ? parseFloat(closest.miss_distance.astronomical) : null,
  };
}

// Map a raw NeoWs object → asteroids row ready for upsert.
function transform(
  neo: NeoWsObject,
  nhatsMap: Map<string, NHATSAccessibility>,
): Record<string, unknown> {
  const orb = neo.orbital_data;
  const ap = summarizeApproaches(neo.close_approach_data);
  const nhatsData = nhatsMap.get(neo.designation ?? '') ?? null;

  return {
    nasa_id: neo.id,
    name: neo.name_limited ?? neo.name,
    full_name: neo.name,
    designation: neo.designation ?? null,
    is_pha: neo.is_potentially_hazardous_asteroid,
    is_sentry_object: neo.is_sentry_object,
    absolute_magnitude_h: neo.absolute_magnitude_h,
    diameter_min_km: neo.estimated_diameter.kilometers.estimated_diameter_min,
    diameter_max_km: neo.estimated_diameter.kilometers.estimated_diameter_max,

    // Orbital elements — present on detail view, may be absent on browse
    orbit_epoch_jd:           orb ? parseFloat(orb.epoch_osculation) : null,
    semi_major_axis_au:       orb ? parseFloat(orb.semi_major_axis) : null,
    eccentricity:             orb ? parseFloat(orb.eccentricity) : null,
    inclination_deg:          orb ? parseFloat(orb.inclination) : null,
    longitude_asc_node_deg:   orb ? parseFloat(orb.ascending_node_longitude) : null,
    argument_perihelion_deg:  orb ? parseFloat(orb.perihelion_argument) : null,
    mean_anomaly_deg:         orb ? parseFloat(orb.mean_anomaly) : null,
    perihelion_distance_au:   orb ? parseFloat(orb.perihelion_distance) : null,
    aphelion_distance_au:     orb ? parseFloat(orb.aphelion_distance) : null,
    // NeoWs orbital_period is in days — convert to years
    orbital_period_yr:        orb ? parseFloat(orb.orbital_period) / 365.25 : null,
    min_orbit_intersection_au: orb ? parseFloat(orb.minimum_orbit_intersection) : null,

    // NHATS human accessibility
    nhats_accessible:         nhatsData !== null,
    nhats_min_delta_v_kms:    nhatsData?.minDeltaVKms ?? null,
    nhats_min_duration_days:  nhatsData?.minDurationDays ?? null,

    // Close approach summary
    next_approach_date:    ap.nextApproachDate,
    next_approach_au:      ap.nextApproachAu,
    next_approach_miss_km: ap.nextApproachMissKm,
    closest_approach_date: ap.closestApproachDate,
    closest_approach_au:   ap.closestApproachAu,

    // AI fields — intentionally omitted (null by default, populated in Phase 5)
  };
}

// Upsert a batch of rows; conflict on nasa_id → update all fields.
async function upsertBatch(rows: Record<string, unknown>[]): Promise<void> {
  const { error } = await supabaseAdmin
    .from('asteroids')
    .upsert(rows, { onConflict: 'nasa_id' });

  if (error) throw new Error(`Supabase upsert failed: ${error.message}`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('=== Asteroid Bonanza — NASA NEO Ingest ===');
  console.log(`Started: ${new Date().toISOString()}`);

  // 1. Fetch all NHATS targets once and build a lookup map by designation.
  console.log('\n[1/3] Fetching NHATS human-accessible targets...');
  const nhatsTargets = await nhats.listAll();
  const nhatsMap = new Map<string, NHATSAccessibility>(
    nhatsTargets.map((t) => [t.designation, t]),
  );
  console.log(`      ${nhatsMap.size} NHATS targets loaded.`);

  // 2. Discover total page count from the first browse request.
  console.log('\n[2/3] Discovering NEO catalog size...');
  const firstPage = await neoWs.browse(0, PAGE_SIZE);
  const totalPages = firstPage.page.total_pages;
  const totalNeos  = firstPage.page.total_elements;
  console.log(`      ${totalNeos.toLocaleString()} NEOs across ${totalPages} pages.`);

  // 3. Paginate through the full catalog.
  console.log('\n[3/3] Ingesting pages...\n');

  let totalIngested = 0;
  let batch: Record<string, unknown>[] = [];

  // Process page 0 (already fetched)
  for (const neo of firstPage.near_earth_objects) {
    batch.push(transform(neo, nhatsMap));
  }

  for (let page = 1; page < totalPages; page++) {
    // Flush batch when full
    if (batch.length >= BATCH_SIZE) {
      await upsertBatch(batch);
      totalIngested += batch.length;
      batch = [];
    }

    // Rate-limit delay
    await sleep(RATE_DELAY_MS);

    const result = await neoWs.browse(page, PAGE_SIZE);

    for (const neo of result.near_earth_objects) {
      batch.push(transform(neo, nhatsMap));
    }

    if (page % LOG_EVERY_N_PAGES === 0) {
      const pct = ((page / totalPages) * 100).toFixed(1);
      console.log(
        `  Page ${page}/${totalPages} (${pct}%) — ` +
        `${totalIngested + batch.length} rows ingested so far`,
      );
    }
  }

  // Flush remaining rows
  if (batch.length > 0) {
    await upsertBatch(batch);
    totalIngested += batch.length;
  }

  console.log(`\n✓ Ingest complete: ${totalIngested.toLocaleString()} asteroids upserted.`);
  console.log(`  Finished: ${new Date().toISOString()}`);
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`\n✗ Ingest failed: ${msg}`);
  process.exit(1);
});
