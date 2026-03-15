/**
 * validateRag.ts
 *
 * Phase 3 quality validation for the RAG knowledge base.
 *
 * Runs 20 manually-crafted test questions (10 science, 10 scenario) against
 * both Supabase vector indices and prints retrieved chunks for human review.
 *
 * Pass/fail criteria (manual inspection):
 *   - Retrieved chunks are relevant to the question (not generic filler)
 *   - Important context was not split across chunks in a way that destroys meaning
 *   - Science questions return results primarily from science_chunks
 *   - Scenario questions return results primarily from scenario_chunks
 *   - Similarity scores are > 0.4 for at-least the top result per question
 *
 * Usage:
 *   npm run script validateRag
 *   npm run script validateRag -- --category science    # science questions only
 *   npm run script validateRag -- --category scenario   # scenario questions only
 *   npm run script validateRag -- --q 3                 # single question by index
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

// ── Env validation ─────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env['SUPABASE_URL'];
const SUPABASE_ANON_KEY = process.env['SUPABASE_ANON_KEY'];
const VOYAGE_API_KEY = process.env['VOYAGE_API_KEY'];

if (!SUPABASE_URL) throw new Error('Missing env: SUPABASE_URL');
if (!SUPABASE_ANON_KEY) throw new Error('Missing env: SUPABASE_ANON_KEY');
if (!VOYAGE_API_KEY) throw new Error('Missing env: VOYAGE_API_KEY');

// ── Config ─────────────────────────────────────────────────────────────────────

const VOYAGE_URL = 'https://api.voyageai.com/v1/embeddings';
const VOYAGE_MODEL = 'voyage-large-2-instruct';
const TOP_K = 3;          // top chunks per index per question
const THRESHOLD = 0.25;   // lower threshold for validation (catch edge cases)
const SNIPPET_LEN = 300;  // characters to preview per chunk

// ── Test questions ─────────────────────────────────────────────────────────────

interface TestQuestion {
  id: number;
  category: 'science' | 'scenario';
  question: string;
  /** Key terms we expect to appear in at least one top chunk (for automated hint). */
  expectedTerms: string[];
}

const TEST_QUESTIONS: TestQuestion[] = [
  // ── Science questions (10) ─────────────────────────────────────────────────
  {
    id: 1,
    category: 'science',
    question: 'What minerals and hydrated silicates were found in the OSIRIS-REx Bennu samples?',
    expectedTerms: ['serpentine', 'carbonate', 'magnetite', 'phyllosilicate', 'Bennu'],
  },
  {
    id: 2,
    category: 'science',
    question: 'What is the spectral classification of the asteroid Psyche and what does it imply about composition?',
    expectedTerms: ['Psyche', 'M-type', 'metal', 'iron', 'nickel'],
  },
  {
    id: 3,
    category: 'science',
    question: 'How did the DART impactor change the orbital period of Dimorphos?',
    expectedTerms: ['Dimorphos', 'DART', 'orbital period', 'momentum', 'deflection'],
  },
  {
    id: 4,
    category: 'science',
    question: 'What are the delta-V requirements for human missions to near-Earth asteroids according to NHATS?',
    expectedTerms: ['delta-V', 'NHATS', 'km/s', 'mission', 'accessibility'],
  },
  {
    id: 5,
    category: 'science',
    question: 'What is the Bus-DeMeo asteroid spectral taxonomy and how many classes does it define?',
    expectedTerms: ['Bus-DeMeo', 'taxonomy', 'spectral', 'class', 'S-type', 'C-type'],
  },
  {
    id: 6,
    category: 'science',
    question: 'What surface features and boulders did OSIRIS-REx observe on Bennu?',
    expectedTerms: ['boulder', 'Bennu', 'surface', 'regolith', 'OSIRIS-REx'],
  },
  {
    id: 7,
    category: 'science',
    question: 'What is the Hera mission and what will it measure at the Didymos system after DART?',
    expectedTerms: ['Hera', 'Didymos', 'ejecta', 'crater', 'ESA'],
  },
  {
    id: 8,
    category: 'science',
    question: 'What carbon-rich materials and organics have been detected in C-type asteroids?',
    expectedTerms: ['C-type', 'carbon', 'organic', 'carbonaceous', 'chondrite'],
  },
  {
    id: 9,
    category: 'science',
    question: 'How does the Yarkovsky effect affect asteroid orbital trajectories?',
    expectedTerms: ['Yarkovsky', 'thermal', 'drift', 'orbit', 'non-gravitational'],
  },
  {
    id: 10,
    category: 'science',
    question: 'What launch windows and mission durations are typical for NHATS human-accessible asteroids?',
    expectedTerms: ['launch window', 'duration', 'stay time', 'NHATS', 'days'],
  },

  // ── Scenario questions (10) ────────────────────────────────────────────────
  {
    id: 11,
    category: 'scenario',
    question: 'What is the projected economic value of asteroid mining by 2050?',
    expectedTerms: ['billion', 'trillion', 'economic', 'mining', '2050'],
  },
  {
    id: 12,
    category: 'scenario',
    question: 'What does NASA\'s Vision 2050 say about in-space resource utilization?',
    expectedTerms: ['ISRU', 'resource', '2050', 'NASA', 'utilization'],
  },
  {
    id: 13,
    category: 'scenario',
    question: 'What is the feasibility of extracting water ice from asteroids for propellant production?',
    expectedTerms: ['water', 'propellant', 'electrolysis', 'hydrogen', 'oxygen'],
  },
  {
    id: 14,
    category: 'scenario',
    question: 'How does ESA\'s space resources strategy envision commercial asteroid mining operations?',
    expectedTerms: ['ESA', 'commercial', 'strategy', 'resources', 'mining'],
  },
  {
    id: 15,
    category: 'scenario',
    question: 'What are the capital cost estimates for a small spacecraft asteroid mining mission?',
    expectedTerms: ['cost', 'million', 'spacecraft', 'mission', 'capital'],
  },
  {
    id: 16,
    category: 'scenario',
    question: 'What platinum-group metals could be extracted from metallic asteroids and what are their market values?',
    expectedTerms: ['platinum', 'palladium', 'metal', 'market', 'price'],
  },
  {
    id: 17,
    category: 'scenario',
    question: 'What technologies are needed for in-situ resource utilization on asteroids?',
    expectedTerms: ['ISRU', 'extraction', 'processing', 'technology', 'infrastructure'],
  },
  {
    id: 18,
    category: 'scenario',
    question: 'How do asteroid mining economics change with advances in robotics and launch cost reductions?',
    expectedTerms: ['robotics', 'launch cost', 'automation', 'economics', 'reduction'],
  },
  {
    id: 19,
    category: 'scenario',
    question: 'What regulatory and legal frameworks govern asteroid resource extraction rights?',
    expectedTerms: ['legal', 'regulation', 'law', 'rights', 'treaty'],
  },
  {
    id: 20,
    category: 'scenario',
    question: 'What is the break-even analysis for a near-Earth asteroid platinum mining mission?',
    expectedTerms: ['break-even', 'profit', 'return', 'investment', 'platinum'],
  },
];

// ── Types ──────────────────────────────────────────────────────────────────────

interface ChunkRpcRow {
  id: string;
  source_id: string;
  source_title: string;
  source_url: string | null;
  source_year: number;
  chunk_index: number;
  content: string;
  metadata: Record<string, unknown>;
  similarity: number;
}

interface ValidatedResult extends ChunkRpcRow {
  source_type: 'science' | 'scenario';
  termHit: boolean;
}

// ── Supabase + Voyage clients ──────────────────────────────────────────────────

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function embedQuery(text: string): Promise<number[]> {
  const res = await fetch(VOYAGE_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${VOYAGE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ input: [text], model: VOYAGE_MODEL }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Voyage AI error ${res.status}: ${body}`);
  }

  const json = (await res.json()) as { data: Array<{ index: number; embedding: number[] }> };
  const embedding = json.data[0]?.embedding;
  if (!embedding) throw new Error('Voyage AI returned empty embedding');
  return embedding;
}

async function queryIndex(
  rpcName: 'match_science_chunks' | 'match_scenario_chunks',
  embedding: number[],
): Promise<ChunkRpcRow[]> {
  const { data, error } = await supabase.rpc(rpcName, {
    query_embedding: embedding,
    match_threshold: THRESHOLD,
    match_count: TOP_K,
  });

  if (error) throw new Error(`Supabase RPC error (${rpcName}): ${error.message}`);
  return (data ?? []) as ChunkRpcRow[];
}

// ── Formatting ─────────────────────────────────────────────────────────────────

function termHit(content: string, terms: string[]): boolean {
  const lower = content.toLowerCase();
  return terms.some((t) => lower.includes(t.toLowerCase()));
}

function printResult(r: ValidatedResult, rank: number): void {
  const sim = (r.similarity * 100).toFixed(1);
  const hit = r.termHit ? '✓' : '·';
  const snippet = r.content.slice(0, SNIPPET_LEN).replace(/\n/g, ' ').trim();
  console.log(
    `  [${rank}] ${hit} sim=${sim}% [${r.source_type.padEnd(8)}] ${r.source_title} (${r.source_year ?? '?'}) — chunk ${r.chunk_index}`,
  );
  console.log(`       "${snippet}${r.content.length > SNIPPET_LEN ? '…' : ''}"`);
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function runQuestion(q: TestQuestion): Promise<{ passed: boolean; topSim: number }> {
  console.log(`\n── Q${q.id} [${q.category}] ─────────────────────────────────────`);
  console.log(`   ${q.question}`);

  let embedding: number[];
  try {
    embedding = await embedQuery(q.question);
  } catch (err) {
    console.error(`   ERROR embedding query: ${err instanceof Error ? err.message : String(err)}`);
    return { passed: false, topSim: 0 };
  }

  const [scienceRaw, scenarioRaw] = await Promise.all([
    queryIndex('match_science_chunks', embedding),
    queryIndex('match_scenario_chunks', embedding),
  ]);

  const scienceResults: ValidatedResult[] = scienceRaw.map((r) => ({
    ...r,
    source_type: 'science' as const,
    termHit: termHit(r.content, q.expectedTerms),
  }));

  const scenarioResults: ValidatedResult[] = scenarioRaw.map((r) => ({
    ...r,
    source_type: 'scenario' as const,
    termHit: termHit(r.content, q.expectedTerms),
  }));

  const combined = [...scienceResults, ...scenarioResults].sort(
    (a, b) => b.similarity - a.similarity,
  );

  if (combined.length === 0) {
    console.log('   NO RESULTS — below threshold');
    return { passed: false, topSim: 0 };
  }

  combined.forEach((r, i) => printResult(r, i + 1));

  const topSim = combined[0]?.similarity ?? 0;
  const anyTermHit = combined.slice(0, TOP_K).some((r) => r.termHit);
  const passed = topSim >= 0.4 && anyTermHit;

  console.log(
    `   → top sim: ${(topSim * 100).toFixed(1)}% | term hit: ${anyTermHit ? 'YES' : 'NO'} | ${passed ? 'PASS' : 'REVIEW'}`,
  );

  return { passed, topSim };
}

async function main(): Promise<void> {
  console.log('Asteroid Bonanza — RAG Quality Validation');
  console.log(`Indices: science_chunks + scenario_chunks | top_k=${TOP_K} | threshold=${THRESHOLD}\n`);

  // CLI flags
  const args = process.argv.slice(2);
  const categoryIdx = args.indexOf('--category');
  const categoryFilter = categoryIdx !== -1 ? args[categoryIdx + 1] : undefined;
  const qIdx = args.indexOf('--q');
  const qFilter = qIdx !== -1 ? Number(args[qIdx + 1]) : undefined;

  let questions = TEST_QUESTIONS;
  if (categoryFilter === 'science') questions = questions.filter((q) => q.category === 'science');
  else if (categoryFilter === 'scenario') questions = questions.filter((q) => q.category === 'scenario');
  if (qFilter !== undefined) questions = questions.filter((q) => q.id === qFilter);

  if (questions.length === 0) {
    console.error('No matching questions found. Check --category / --q flags.');
    process.exit(1);
  }

  console.log(`Running ${questions.length} question(s)...\n`);

  const results: Array<{ q: TestQuestion; passed: boolean; topSim: number }> = [];

  for (const q of questions) {
    const result = await runQuestion(q);
    results.push({ q, ...result });
    // Brief pause between questions to avoid Voyage rate limits
    await new Promise((r) => setTimeout(r, 400));
  }

  // ── Summary ──────────────────────────────────────────────────────────────────
  const passed = results.filter((r) => r.passed).length;
  const total = results.length;
  const avgSim = results.reduce((s, r) => s + r.topSim, 0) / total;

  console.log('\n══════════════════════════════════════════════════════════');
  console.log(`RESULTS: ${passed}/${total} PASS | avg top similarity: ${(avgSim * 100).toFixed(1)}%`);
  console.log('══════════════════════════════════════════════════════════');

  const failed = results.filter((r) => !r.passed);
  if (failed.length > 0) {
    console.log('\nQuestions needing manual review:');
    failed.forEach(({ q, topSim }) => {
      console.log(`  Q${q.id} [${q.category}] sim=${(topSim * 100).toFixed(1)}% — ${q.question}`);
    });
  }

  console.log('\nLegend: ✓ = expected term found in chunk  · = term not found');
  console.log('PASS = top similarity ≥ 40% AND at least one expected term hit');
  console.log('Manual inspection still required — automated checks are hints only.\n');
}

main().catch((err: unknown) => {
  console.error('Fatal:', err);
  process.exit(1);
});
