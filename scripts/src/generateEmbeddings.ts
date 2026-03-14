/**
 * generateEmbeddings.ts
 *
 * Generates Voyage AI embeddings for all asteroids in the database and stores
 * them in the `embedding` column. Run after ingestNasa has completed.
 *
 * Usage: npm run generateEmbeddings (from project root)
 *
 * Cost estimate: ~35,000 asteroids × ~80 tokens each ≈ 2.8M tokens, well within
 * Voyage AI's free tier (50M tokens).
 *
 * Safe to Ctrl+C and resume — only fetches asteroids where embedding IS NULL,
 * and always re-fetches from offset 0 since processed rows drop out of the pool.
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

// ── Env validation ─────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env['SUPABASE_URL'];
const SUPABASE_SERVICE_KEY = process.env['SUPABASE_SERVICE_ROLE_KEY'];
const VOYAGE_API_KEY = process.env['VOYAGE_API_KEY'];

if (!SUPABASE_URL) throw new Error('Missing env: SUPABASE_URL');
if (!SUPABASE_SERVICE_KEY) throw new Error('Missing env: SUPABASE_SERVICE_ROLE_KEY');
if (!VOYAGE_API_KEY) throw new Error('Missing env: VOYAGE_API_KEY');

// ── Config ─────────────────────────────────────────────────────────────────────

const VOYAGE_URL = 'https://api.voyageai.com/v1/embeddings';
const VOYAGE_MODEL = 'voyage-large-2-instruct';
const VOYAGE_BATCH_SIZE = 128; // Voyage AI max inputs per request
const DB_FETCH_SIZE = 500;     // asteroids fetched per round (smaller = better progress display)
const VOYAGE_DELAY_MS = 300;   // delay between Voyage API calls to avoid rate limits

// ── Clients ────────────────────────────────────────────────────────────────────

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── Types ──────────────────────────────────────────────────────────────────────

interface AsteroidForEmbed {
  id: string;
  nasa_id: string;
  full_name: string | null;
  name: string | null;
  designation: string | null;
  spectral_type_smass: string | null;
  spectral_type_tholen: string | null;
  diameter_min_km: number | null;
  diameter_max_km: number | null;
  is_pha: boolean;
  nhats_accessible: boolean | null;
  nhats_min_delta_v_kms: number | null;
  absolute_magnitude_h: number | null;
  min_orbit_intersection_au: number | null;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/**
 * Build a descriptive text string for an asteroid, used as the Voyage AI input.
 */
function buildEmbedText(a: AsteroidForEmbed): string {
  const parts: string[] = [];

  const displayName = a.full_name ?? a.name ?? a.designation ?? a.nasa_id;
  parts.push(displayName);

  const spectral = a.spectral_type_smass ?? a.spectral_type_tholen;
  if (spectral) parts.push(`spectral type ${spectral}`);

  if (a.diameter_min_km !== null && a.diameter_max_km !== null) {
    const avg = ((a.diameter_min_km + a.diameter_max_km) / 2).toFixed(3);
    parts.push(`diameter approximately ${avg} km`);
  } else if (a.diameter_min_km !== null) {
    parts.push(`diameter at least ${a.diameter_min_km.toFixed(3)} km`);
  }

  if (a.is_pha) parts.push('potentially hazardous asteroid');

  if (a.nhats_accessible) {
    const dv = a.nhats_min_delta_v_kms?.toFixed(2) ?? 'unknown';
    parts.push(`human-accessible near-Earth target with minimum delta-V of ${dv} km/s`);
  }

  if (a.min_orbit_intersection_au !== null) {
    parts.push(`minimum orbit intersection distance ${a.min_orbit_intersection_au.toFixed(4)} AU`);
  }

  if (a.absolute_magnitude_h !== null) {
    parts.push(`absolute magnitude H=${a.absolute_magnitude_h.toFixed(1)}`);
  }

  return parts.join('. ') + '.';
}

async function fetchEmbeddings(texts: string[]): Promise<number[][]> {
  const response = await fetch(VOYAGE_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${VOYAGE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ input: texts, model: VOYAGE_MODEL }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Voyage AI error ${response.status}: ${body}`);
  }

  const json = (await response.json()) as {
    data: Array<{ index: number; embedding: number[] }>;
  };

  return json.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
}

/**
 * Write embeddings for a batch of asteroids with bounded concurrency.
 * Supabase JS client resolves (never rejects) even on error, so we check
 * the `error` field explicitly. Concurrency capped at 20 to avoid pool exhaustion.
 */
async function writeEmbeddings(
  batch: AsteroidForEmbed[],
  embeddings: number[][],
): Promise<number> {
  const CONCURRENCY = 20;
  let written = 0;

  for (let i = 0; i < batch.length; i += CONCURRENCY) {
    const chunk = batch.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      chunk.map((asteroid, j) =>
        supabaseAdmin
          .from('asteroids')
          .update({ embedding: embeddings[i + j] })
          .eq('id', asteroid.id)
          .then(({ error }) => {
            if (error) {
              console.error(`  Failed ${asteroid.nasa_id}: ${error.message}`);
              return false;
            }
            return true;
          }),
      ),
    );
    written += results.filter(Boolean).length;
  }

  return written;
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('Asteroid Bonanza — Voyage AI embedding generation');
  console.log(`Model: ${VOYAGE_MODEL} | Batch size: ${VOYAGE_BATCH_SIZE}\n`);

  let totalProcessed = 0;
  let round = 0;

  // Always fetch from offset 0: as rows are updated they leave the IS NULL pool,
  // so the "first page" always contains the next unprocessed asteroids.
  while (true) {
    round++;

    const { data: asteroids, error: fetchError } = await supabaseAdmin
      .from('asteroids')
      .select(
        'id, nasa_id, full_name, name, designation, spectral_type_smass, spectral_type_tholen, diameter_min_km, diameter_max_km, is_pha, nhats_accessible, nhats_min_delta_v_kms, absolute_magnitude_h, min_orbit_intersection_au',
      )
      .is('embedding', null)
      .range(0, DB_FETCH_SIZE - 1);

    if (fetchError) {
      console.error('Database fetch error:', fetchError.message);
      process.exit(1);
    }

    if (!asteroids || asteroids.length === 0) {
      break; // All embeddings written
    }

    process.stdout.write(`Round ${round}: fetched ${asteroids.length} asteroids → embedding...\n`);

    const batch = asteroids as AsteroidForEmbed[];
    const texts = batch.map(buildEmbedText);

    // Voyage AI max is 128 inputs per call — chunk accordingly
    const allEmbeddings: number[][] = [];
    for (let i = 0; i < texts.length; i += VOYAGE_BATCH_SIZE) {
      const chunk = texts.slice(i, i + VOYAGE_BATCH_SIZE);
      try {
        const chunkEmbeddings = await fetchEmbeddings(chunk);
        allEmbeddings.push(...chunkEmbeddings);
      } catch (err) {
        console.error('\nVoyage AI error:', err);
        process.exit(1);
      }
      if (i + VOYAGE_BATCH_SIZE < texts.length) {
        await sleep(VOYAGE_DELAY_MS);
      }
    }

    const written = await writeEmbeddings(batch, allEmbeddings);
    totalProcessed += written;

    process.stdout.write(`  wrote ${written}. Total so far: ${totalProcessed}\n`);

    if (asteroids.length < DB_FETCH_SIZE) {
      break; // Last partial batch — done
    }

    await sleep(VOYAGE_DELAY_MS);
  }

  console.log(`\nDone. ${totalProcessed} embeddings written to the database.`);
}

main().catch((err: unknown) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
