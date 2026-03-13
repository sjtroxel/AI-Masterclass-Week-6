# Phase 3 — RAG Knowledge Base

**Goal**: Dual-index knowledge base ingested and retrieval quality verified. No frontend changes.

**Status**: Not started

**Prerequisite**: RAG document source list compiled and verified during Phase 0. Do not begin this phase without the verified list in hand.

---

## Deliverables

### Ingestion Pipeline
- [ ] `scripts/ingestDocuments.ts` — PDF → text extraction → chunking → Voyage AI embedding → Supabase
- [ ] Document-structure chunking implemented (respects H1/H2/H3 hierarchy, heading attached to content)
- [ ] Semantic chunking for academic papers (paragraph-level, 50-token overlap, max 512 tokens/chunk)

### Data Ingestion
- [ ] Science index (`science_chunks`) populated — all documents from Phase 0 verified list
- [ ] Scenario index (`scenario_chunks`) populated — all 2050 projection documents from Phase 0 verified list
- [ ] Each chunk tagged with `source_type` and `source_title`

### Backend Service
- [ ] `ragService.ts` — retrieval from both indices with source-type labeling
- [ ] Dual-index query: every query hits both `science_chunks` and `scenario_chunks` simultaneously
- [ ] Results returned with `source_type` label so callers know science vs. scenario

### Quality Validation
- [ ] 20 test questions manually written — 10 science, 10 scenario
- [ ] Each question run against the retrieval pipeline and results inspected manually
- [ ] Retrieved chunks are relevant, not generic filler
- [ ] Chunking did not split important context across chunks (spot-check 5–10 chunks per document)

**Exit condition**: `ragService.ts` retrieves relevant, sourced chunks for both science and scenario queries. Manual quality check passed. No frontend changes.

---

*Phase document created: 2026-03-13*
