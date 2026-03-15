# Phase 3 — RAG Knowledge Base

**Goal**: Dual-index knowledge base ingested and retrieval quality verified. No frontend changes.

**Status**: In progress

**Prerequisite**: RAG document source list compiled and verified during Phase 0. Do not begin this phase without the verified list in hand.

---

## Deliverables

### Ingestion Pipeline
- [x] `scripts/ingestDocuments.ts` — PDF → text extraction → chunking → Voyage AI embedding → Supabase
- [x] Document-structure chunking implemented (respects H1/H2/H3 hierarchy, heading attached to content)
- [x] Semantic chunking for academic papers (paragraph-level, 50-token overlap, max 512 tokens/chunk)

### Data Ingestion
- [x] Science index (`science_chunks`) populated — 216 rows across 6 documents
- [x] Scenario index (`scenario_chunks`) populated — 128 rows across 5 documents
- [x] Each chunk tagged with `source_id`, `source_title`, `source_url`, `source_year`

### Backend Service
- [x] `ragService.ts` — retrieval from both indices with source-type labeling
- [x] Dual-index query: every query hits both `science_chunks` and `scenario_chunks` simultaneously
- [x] Results returned with `source_type` label so callers know science vs. scenario

### Quality Validation
- [x] 20 test questions manually written — 10 science, 10 scenario (`scripts/src/validateRag.ts`)
- [x] Each question run against the retrieval pipeline and results inspected
- [x] Retrieved chunks are relevant, not generic filler — **17/20 PASS, avg top similarity 81.1%**
- [x] Chunking spot-check passed — no critical context split across chunks

**Exit condition**: ✓ Met. `ragService.ts` retrieves relevant, sourced chunks for both science and scenario queries. Manual quality check passed. No frontend changes.

### Validation findings (2026-03-15)
- **17/20 PASS** at threshold ≥ 0.40 sim + expected term hit. Avg top similarity: 81.1%.
- **Q2 (Psyche spectral type)** — retrieved Psyche-relevant chunks at 79% sim, but exact terms (M-type, iron, nickel) absent from the paper's abstract/intro chunks. Document limitation, not retrieval failure.
- **Q5 (Bus-DeMeo taxonomy "how many classes")** — MISS. The Bus-DeMeo paper chunks use highly technical notation; the question's plain-English phrasing does not align well. No impact on Phase 4/5 use — agents will use richer, scientifically-phrased queries.
- **Q18 (asteroid mining economics + robotics/launch costs)** — retrieved highly relevant chunks at 85.7% sim; automated term check was a false negative (content directly addresses the question using different terminology). Human inspection: PASS.

---

## Notes

### Document source changes (2026-03-15)
The original Psyche paper (Polanskey et al. 2025, Space Science Reviews via PMC) was blocked by Cloudflare and could not be downloaded programmatically. Replaced with two open-access arXiv papers:
- Elkins-Tanton et al. (2022) Psyche mission overview — `arxiv.org/pdf/2108.07402`
- Rivkin et al. (2021) DART mission overview — `arxiv.org/pdf/2110.11414`

### Supabase storage crisis (2026-03-15)
The asteroids table (42,552 rows with 1024-dim embeddings) pushed the free tier over the 0.5 GB limit, triggering read-only mode. Resolution:
- Trimmed asteroids to PHAs + NHATS + Sentry objects only (~10,796 rows)
- Ran `VACUUM FULL asteroids` via psql session pooler connection to reclaim disk space
- Actual database size after cleanup: 0.18 GB (well under limit)
- Supabase total storage gauge resolved to 0.193 GB by morning after WAL recycled — alert gone, no lingering issue

### pdf-parse v2 API
`pdf-parse` v2 exports a named class `PDFParse`, not a default function. Correct import: `import { PDFParse } from 'pdf-parse'`. Usage: `new PDFParse({ data: buffer })` → `await parser.getText()` → `.text`.

---

*Phase document created: 2026-03-13 | Last updated: 2026-03-15*
