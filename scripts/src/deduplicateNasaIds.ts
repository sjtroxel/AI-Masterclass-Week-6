/**
 * deduplicateNasaIds.ts
 *
 * One-time cleanup script: removes asteroid records that have a "short" numeric
 * nasa_id (e.g. "99942", "3122") when the canonical NeoWs "2XXXXXX" format
 * record (e.g. "2099942", "2003122") already exists in the database.
 *
 * Background:
 *   NASA NeoWs returns neo_reference_id in the format "2" + 6-digit-zero-padded
 *   asteroid number (e.g. 99942 Apophis → "2099942"). If the database was seeded
 *   with bare catalog numbers at any point, both formats now coexist as separate
 *   rows, causing duplicates in search and browse results.
 *
 * Strategy:
 *   1. Find all rows where nasa_id is all-numeric and ≤ 6 chars (short format).
 *   2. For each, compute the canonical form: "2" + padStart(6, "0").
 *   3. If the canonical form already exists → delete the short-form duplicate.
 *   4. If it does NOT exist → update nasa_id to the canonical form in place.
 *
 * Run via: npm run script deduplicateNasaIds
 * Safe to re-run; uses upsert/delete with explicit guards.
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL         = process.env['SUPABASE_URL'];
const SUPABASE_SERVICE_KEY = process.env['SUPABASE_SERVICE_ROLE_KEY'];

if (!SUPABASE_URL)         throw new Error('Missing env: SUPABASE_URL');
if (!SUPABASE_SERVICE_KEY) throw new Error('Missing env: SUPABASE_SERVICE_ROLE_KEY');

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/** True if a string is all numeric digits with length ≤ 6 — the "short" format. */
function isShortNumericId(id: string): boolean {
  return /^\d{1,6}$/.test(id);
}

/** Convert a short numeric id to the canonical NeoWs 7-char format. */
function toCanonicalId(shortId: string): string {
  return '2' + shortId.padStart(6, '0');
}

async function main(): Promise<void> {
  console.log('=== Asteroid Bonanza — nasa_id Deduplication ===');

  // 1. Fetch all short-format nasa_ids.
  const { data: shortRows, error: fetchErr } = await supabase
    .from('asteroids')
    .select('id, nasa_id, name, full_name')
    .filter('nasa_id', 'lt', '9999999') // All records with nasa_id < 7 chars numerically
    .order('nasa_id');

  if (fetchErr) throw new Error(`Failed to fetch asteroids: ${fetchErr.message}`);

  const candidates = ((shortRows ?? []) as { id: string; nasa_id: string; name: string | null; full_name: string | null }[])
    .filter(r => isShortNumericId(r.nasa_id));

  console.log(`\nFound ${candidates.length} short-format nasa_id records to inspect.`);

  if (candidates.length === 0) {
    console.log('Nothing to do — database is clean.');
    return;
  }

  // 2. For each short-format record, check if the canonical form exists.
  const canonicalIds = candidates.map(r => toCanonicalId(r.nasa_id));

  const { data: canonicalRows, error: canonErr } = await supabase
    .from('asteroids')
    .select('nasa_id')
    .in('nasa_id', canonicalIds);

  if (canonErr) throw new Error(`Failed to fetch canonical records: ${canonErr.message}`);

  const existingCanonical = new Set(
    ((canonicalRows ?? []) as { nasa_id: string }[]).map(r => r.nasa_id)
  );

  // 3. Categorise: delete duplicates, update orphans.
  const toDelete: string[] = [];   // short-form nasa_ids where canonical already exists
  const toUpdate: { id: string; oldId: string; newId: string }[] = []; // orphans to rename

  for (const row of candidates) {
    const canonical = toCanonicalId(row.nasa_id);
    if (existingCanonical.has(canonical)) {
      toDelete.push(row.nasa_id);
      console.log(
        `  DUPLICATE: "${row.nasa_id}" (${row.name ?? row.full_name ?? '?'}) ` +
        `→ canonical "${canonical}" already exists — will DELETE short-form`
      );
    } else {
      toUpdate.push({ id: row.id, oldId: row.nasa_id, newId: canonical });
      console.log(
        `  ORPHAN: "${row.nasa_id}" (${row.name ?? row.full_name ?? '?'}) ` +
        `→ no canonical found — will RENAME to "${canonical}"`
      );
    }
  }

  // 4. Delete duplicates.
  if (toDelete.length > 0) {
    console.log(`\nDeleting ${toDelete.length} duplicate short-format records...`);
    const { error: delErr } = await supabase
      .from('asteroids')
      .delete()
      .in('nasa_id', toDelete);
    if (delErr) throw new Error(`Delete failed: ${delErr.message}`);
    console.log(`  ✓ Deleted ${toDelete.length} records.`);
  }

  // 5. Update orphan nasa_ids to canonical form.
  if (toUpdate.length > 0) {
    console.log(`\nRenaming ${toUpdate.length} orphan records to canonical format...`);
    for (const { id, oldId, newId } of toUpdate) {
      const { error: updErr } = await supabase
        .from('asteroids')
        .update({ nasa_id: newId })
        .eq('id', id);
      if (updErr) {
        console.error(`  ✗ Failed to rename "${oldId}" → "${newId}": ${updErr.message}`);
      } else {
        console.log(`  ✓ Renamed "${oldId}" → "${newId}"`);
      }
    }
  }

  const changed = toDelete.length + toUpdate.length;
  console.log(`\nDone. ${changed} record(s) cleaned up.`);
  if (changed === 0) console.log('Database was already clean.');
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`\n✗ Deduplication failed: ${msg}`);
  process.exit(1);
});
