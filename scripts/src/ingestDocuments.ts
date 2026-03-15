/**
 * ingestDocuments.ts
 *
 * RAG ingest pipeline for Asteroid Bonanza Phase 3.
 *
 * For each source document:
 *   1. Download the PDF
 *   2. Extract text with pdf-parse
 *   3. Chunk the text (document-structure aware: respects headings; semantic for papers)
 *   4. Embed each chunk via Voyage AI (voyage-large-2-instruct, 1024-dim)
 *   5. Upsert into science_chunks or scenario_chunks in Supabase
 *
 * Safe to re-run — upserts on (source_id, chunk_index) so duplicates are overwritten.
 *
 * Usage:
 *   npm run ingestDocuments               # all documents
 *   npm run ingestDocuments -- --id osiris-rex-bennu  # single document
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { PDFParse } from 'pdf-parse';

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
const VOYAGE_DELAY_MS = 300;   // delay between Voyage API calls

/** Semantic chunking params */
const MAX_TOKENS_PER_CHUNK = 512;
const OVERLAP_TOKENS = 50;
/** Rough chars-per-token estimate (conservative for mixed scientific text) */
const CHARS_PER_TOKEN = 4;
const MAX_CHARS = MAX_TOKENS_PER_CHUNK * CHARS_PER_TOKEN;   // ~2048
const OVERLAP_CHARS = OVERLAP_TOKENS * CHARS_PER_TOKEN;     // ~200

// ── Types ──────────────────────────────────────────────────────────────────────

type IndexTable = 'science_chunks' | 'scenario_chunks';

interface SourceDoc {
  id: string;           // stable slug, e.g. "osiris-rex-bennu"
  title: string;
  url: string;
  year: number;
  table: IndexTable;
  /** Primary contribution determines chunking strategy */
  chunkStrategy: 'document-structure' | 'semantic';
}

interface ChunkRow {
  source_id: string;
  source_title: string;
  source_url: string;
  source_year: number;
  chunk_index: number;
  content: string;
  embedding: number[];
  metadata: Record<string, unknown>;
}

// ── Source document registry ───────────────────────────────────────────────────
//
// Document-level classification (see PHASE_0_FOUNDATION.md for rationale).
// Rule: primary contribution = measured/computed facts → science_chunks
//       primary contribution = projections/plans/economic models → scenario_chunks

const SOURCES: SourceDoc[] = [
  // ── Science index ─────────────────────────────────────────────────────────
  {
    id: 'osiris-rex-bennu',
    title: 'OSIRIS-REx Bennu Sample Mineralogy — Hamilton et al. (2024)',
    url: 'https://ntrs.nasa.gov/api/citations/20240000430/downloads/Hamilton-SSAWG_LPSC55_20240103_1366.pdf',
    year: 2024,
    table: 'science_chunks',
    chunkStrategy: 'semantic',
  },
  {
    id: 'psyche-mission-2022',
    title: 'Psyche Mission Overview — Elkins-Tanton et al. (2022)',
    url: 'https://arxiv.org/pdf/2108.07402',
    year: 2022,
    table: 'science_chunks',
    chunkStrategy: 'semantic',
  },
  {
    id: 'dart-mission-overview',
    title: 'The Double Asteroid Redirection Test (DART) Mission — Rivkin et al. (2021)',
    url: 'https://arxiv.org/pdf/2110.11414',
    year: 2021,
    table: 'science_chunks',
    chunkStrategy: 'semantic',
  },
  {
    id: 'bus-demeo-taxonomy',
    title: 'Bus-DeMeo Asteroid Spectral Taxonomy — DeMeo, Binzel, Slivan, Bus (2009)',
    url: 'https://hal.science/hal-00545286v1/file/PEER_stage2_10.1016%252Fj.icarus.2009.02.005.pdf',
    year: 2009,
    table: 'science_chunks',
    chunkStrategy: 'semantic',
  },
  {
    id: 'esa-hera-mission',
    title: 'ESA Hera Mission — Michel et al. (2022)',
    url: 'https://hal.science/hal-03733008v1/file/psj_3_7_160.pdf',
    year: 2022,
    table: 'science_chunks',
    chunkStrategy: 'semantic',
  },
  {
    id: 'jpl-nhats-methodology',
    title: 'JPL NHATS Methodology and Target List — Abell et al. (2012)',
    url: 'https://ntrs.nasa.gov/api/citations/20120001818/downloads/20120001818.pdf',
    year: 2012,
    table: 'science_chunks',
    chunkStrategy: 'document-structure',
  },

  // ── Scenario index ────────────────────────────────────────────────────────
  {
    id: 'nasa-vision-2050',
    title: 'NASA Planetary Science Vision 2050 — Lakew, Amato et al. (2017)',
    url: 'https://ntrs.nasa.gov/api/citations/20170008907/downloads/20170008907.pdf',
    year: 2017,
    table: 'scenario_chunks',
    chunkStrategy: 'document-structure',
  },
  {
    id: 'nasa-isru-plans',
    title: 'NASA ISRU Plans — Sanders, Kleinhenz, Linne (2022)',
    url: 'https://ntrs.nasa.gov/api/citations/20220008799/downloads/NASA%20ISRU%20Plans_Sanders_COSPAR-Final.pdf',
    year: 2022,
    table: 'scenario_chunks',
    chunkStrategy: 'document-structure',
  },
  {
    id: 'esa-space-resources-strategy',
    title: 'ESA Space Resources Strategy — ESA (2019)',
    url: 'https://sci.esa.int/documents/34161/35992/1567260390250-ESA_Space_Resources_Strategy.pdf',
    year: 2019,
    table: 'scenario_chunks',
    chunkStrategy: 'document-structure',
  },
  {
    id: 'asteroid-mining-economics-hein',
    title: 'A Techno-Economic Analysis of Asteroid Mining — Hein, Matheson, Fries (2018)',
    url: 'https://arxiv.org/pdf/1810.03836',
    year: 2018,
    table: 'scenario_chunks',
    chunkStrategy: 'semantic',
  },
  {
    id: 'asteroid-mining-economics-calla',
    title: 'Asteroid Mining with Small Spacecraft and Its Economic Feasibility — Calla, Fries, Welch (2018)',
    url: 'https://arxiv.org/pdf/1808.05099',
    year: 2018,
    table: 'scenario_chunks',
    chunkStrategy: 'semantic',
  },
];

// ── Supabase client ────────────────────────────────────────────────────────────

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── Helpers ────────────────────────────────────────────────────────────────────

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** Download a PDF and return its raw buffer. */
async function downloadPdf(url: string): Promise<Buffer> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'AsteroidBonanza-RAGIngest/1.0 (research; non-commercial)' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} downloading ${url}`);
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Extract plain text from a PDF buffer using pdf-parse v2 class API.
 */
async function extractText(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: buffer });
  const result = await parser.getText();
  await parser.destroy();
  return result.text;
}

/**
 * Clean up raw PDF-extracted text:
 * - Collapse runs of 3+ newlines to double newline (paragraph break)
 * - Collapse internal whitespace within each paragraph
 * - Strip paragraphs that are pure noise: very short AND look like page numbers
 *   or running headers (all digits, or < 6 chars). Keeps short headings like
 *   "1. Introduction" or "Abstract" which are load-bearing for structure chunking.
 */
function cleanText(raw: string): string {
  return raw
    .replace(/\r\n/g, '\n')
    .replace(/(\w)-\n(\w)/g, '$1$2')   // rejoin line-break hyphenation ("infor-\nmation" → "information")
    .replace(/\n{3,}/g, '\n\n')
    .split('\n\n')
    .map((para) => para.replace(/\n/g, ' ').replace(/\s{2,}/g, ' ').trim())
    .filter((para) => {
      if (para.length < 6) return false;          // pure noise (page numbers, stray chars)
      if (/^\d+$/.test(para)) return false;        // standalone page number
      return true;
    })
    .join('\n\n');
}

/**
 * Document-structure chunking.
 *
 * Splits on H1/H2/H3-style headings (ALL CAPS lines or numbered sections like
 * "1. Introduction", "2.1 Methodology"). The heading text is prepended to each
 * chunk so that retrieval context is self-contained.
 */
function chunkByStructure(text: string): string[] {
  // Heading patterns found in NASA/ESA technical reports
  const HEADING_RE = /^(?:\d+(?:\.\d+)*\.?\s+[A-Z][^\n]{3,60}|[A-Z][A-Z\s]{5,60})$/m;

  const paragraphs = text.split('\n\n');
  const chunks: string[] = [];
  let currentHeading = '';
  let buffer = '';

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) continue;

    const isHeading = HEADING_RE.test(trimmed) && trimmed.split(' ').length <= 12;

    if (isHeading) {
      // Flush existing buffer as a chunk
      if (buffer.trim().length >= 100) {
        chunks.push(buffer.trim());
      }
      currentHeading = trimmed;
      buffer = currentHeading + '\n\n';
    } else {
      buffer += trimmed + '\n\n';
      // Flush when buffer exceeds max size (split at paragraph boundary)
      if (buffer.length > MAX_CHARS) {
        chunks.push(buffer.trim());
        // Start next chunk with heading for continuity
        buffer = (currentHeading ? currentHeading + ' (continued)\n\n' : '');
      }
    }
  }

  if (buffer.trim().length >= 100) {
    chunks.push(buffer.trim());
  }

  return chunks;
}

/**
 * Semantic chunking for academic papers.
 * Paragraph-level, ~512 tokens max, ~50-token overlap between adjacent chunks.
 */
function chunkSemantic(text: string): string[] {
  const paragraphs = text.split('\n\n').map((p) => p.trim()).filter((p) => p.length >= 40);
  const chunks: string[] = [];
  let buffer = '';
  let overlapTail = '';

  for (const para of paragraphs) {
    const candidate = (overlapTail ? overlapTail + ' ' : '') + (buffer ? buffer + '\n\n' : '') + para;

    if (candidate.length > MAX_CHARS && buffer.length >= 100) {
      // Flush current buffer
      chunks.push(buffer.trim());
      // Carry overlap from the end of the flushed chunk
      overlapTail = buffer.slice(-OVERLAP_CHARS).trim();
      buffer = para;
    } else {
      buffer = buffer ? buffer + '\n\n' + para : para;
    }
  }

  if (buffer.trim().length >= 100) {
    chunks.push(buffer.trim());
  }

  return chunks;
}

/**
 * If a single chunk exceeds MAX_CHARS (can happen when a paragraph is itself huge),
 * split it on sentence boundaries so we stay within the token budget.
 */
function splitOversized(chunk: string): string[] {
  if (chunk.length <= MAX_CHARS) return [chunk];

  const sentences = chunk.match(/[^.!?]+[.!?]+\s*/g) ?? [chunk];
  const parts: string[] = [];
  let buf = '';

  for (const sentence of sentences) {
    if ((buf + sentence).length > MAX_CHARS && buf.length >= 100) {
      parts.push(buf.trim());
      buf = sentence;
    } else {
      buf += sentence;
    }
  }
  if (buf.trim().length >= 100) parts.push(buf.trim());
  return parts.length > 0 ? parts : [chunk];
}

/** Dispatch to the correct chunking strategy, then guard against oversized chunks. */
function chunkText(text: string, strategy: SourceDoc['chunkStrategy']): string[] {
  const raw = strategy === 'document-structure'
    ? chunkByStructure(text)
    : chunkSemantic(text);

  return raw
    .flatMap(splitOversized)
    .filter((c) => c.trim().length >= 100);
}

// ── Voyage AI ──────────────────────────────────────────────────────────────────

async function fetchEmbeddings(texts: string[]): Promise<number[][]> {
  const res = await fetch(VOYAGE_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${VOYAGE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ input: texts, model: VOYAGE_MODEL }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Voyage AI error ${res.status}: ${body}`);
  }

  const json = (await res.json()) as { data: Array<{ index: number; embedding: number[] }> };
  return json.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
}

/** Embed all chunks, respecting Voyage AI's 128-input-per-call limit. */
async function embedChunks(chunks: string[]): Promise<number[][]> {
  const allEmbeddings: number[][] = [];

  for (let i = 0; i < chunks.length; i += VOYAGE_BATCH_SIZE) {
    const batch = chunks.slice(i, i + VOYAGE_BATCH_SIZE);
    const embeddings = await fetchEmbeddings(batch);
    allEmbeddings.push(...embeddings);

    if (i + VOYAGE_BATCH_SIZE < chunks.length) {
      await sleep(VOYAGE_DELAY_MS);
    }
  }

  return allEmbeddings;
}

// ── Supabase upsert ────────────────────────────────────────────────────────────

async function upsertChunks(table: IndexTable, rows: ChunkRow[]): Promise<number> {
  const BATCH = 50; // Supabase recommends small upsert batches for large rows
  let upserted = 0;

  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const { error } = await supabase
      .from(table)
      .upsert(batch, { onConflict: 'source_id,chunk_index' });

    if (error) throw new Error(`Supabase upsert error: ${error.message}`);
    upserted += batch.length;
  }

  return upserted;
}

// ── Per-document pipeline ─────────────────────────────────────────────────────

async function ingestDocument(doc: SourceDoc): Promise<void> {
  console.log(`\n[${doc.id}]`);
  console.log(`  Downloading: ${doc.url}`);

  let buffer: Buffer;
  try {
    buffer = await downloadPdf(doc.url);
  } catch (err) {
    console.error(`  FAILED to download: ${err instanceof Error ? err.message : String(err)}`);
    return;
  }

  console.log(`  Extracting text (${(buffer.length / 1024).toFixed(0)} KB PDF)...`);
  let rawText: string;
  try {
    rawText = await extractText(buffer);
  } catch (err) {
    console.error(`  FAILED to parse PDF: ${err instanceof Error ? err.message : String(err)}`);
    return;
  }

  const cleanedText = cleanText(rawText);
  console.log(`  Cleaned text: ${cleanedText.length.toLocaleString()} chars`);

  const chunks = chunkText(cleanedText, doc.chunkStrategy);
  console.log(`  Chunks (${doc.chunkStrategy}): ${chunks.length}`);

  if (chunks.length === 0) {
    console.warn('  WARNING: 0 chunks produced — skipping embed/upsert');
    return;
  }

  console.log(`  Embedding ${chunks.length} chunks via Voyage AI...`);
  let embeddings: number[][];
  try {
    embeddings = await embedChunks(chunks);
  } catch (err) {
    console.error(`  FAILED to embed: ${err instanceof Error ? err.message : String(err)}`);
    return;
  }

  const rows: ChunkRow[] = chunks.map((content, i) => ({
    source_id: doc.id,
    source_title: doc.title,
    source_url: doc.url,
    source_year: doc.year,
    chunk_index: i,
    content,
    embedding: embeddings[i] ?? [],
    metadata: { chunk_strategy: doc.chunkStrategy },
  }));

  console.log(`  Upserting ${rows.length} rows into ${doc.table}...`);
  const upserted = await upsertChunks(doc.table, rows);
  console.log(`  Done — ${upserted} rows upserted.`);
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('Asteroid Bonanza — RAG Document Ingest Pipeline');
  console.log(`Model: ${VOYAGE_MODEL} | Max chunk: ${MAX_TOKENS_PER_CHUNK} tokens\n`);

  // Optional: filter to a single document via --id flag
  const idFlag = process.argv.indexOf('--id');
  const targetId = idFlag !== -1 ? process.argv[idFlag + 1] : undefined;

  const sources = targetId
    ? SOURCES.filter((s) => s.id === targetId)
    : SOURCES;

  if (targetId && sources.length === 0) {
    console.error(`No source found with id "${targetId}". Valid ids:`);
    SOURCES.forEach((s) => console.error(`  ${s.id}`));
    process.exit(1);
  }

  const scienceDocs = sources.filter((s) => s.table === 'science_chunks');
  const scenarioDocs = sources.filter((s) => s.table === 'scenario_chunks');

  console.log(`Sources to ingest: ${sources.length} total`);
  console.log(`  science_chunks: ${scienceDocs.length} documents`);
  console.log(`  scenario_chunks: ${scenarioDocs.length} documents`);

  let totalChunks = 0;

  for (const doc of sources) {
    await ingestDocument(doc);
    // Brief pause between documents to avoid rate limits
    await sleep(500);
  }

  // Count what's actually in the DB
  const { count: scienceCount } = await supabase
    .from('science_chunks')
    .select('*', { count: 'exact', head: true });

  const { count: scenarioCount } = await supabase
    .from('scenario_chunks')
    .select('*', { count: 'exact', head: true });

  console.log('\n── Ingest complete ──────────────────────────────────────');
  console.log(`science_chunks:  ${scienceCount ?? '?'} total rows in DB`);
  console.log(`scenario_chunks: ${scenarioCount ?? '?'} total rows in DB`);

  void totalChunks; // reported per-doc above
}

main().catch((err: unknown) => {
  console.error('Fatal:', err);
  process.exit(1);
});
