# RAG Pipeline Rules — Asteroid Bonanza

## Two-index architecture (non-negotiable)
- There are exactly two vector tables: `science_chunks` and `scenario_chunks` — do not collapse them into one
- `science_chunks` — hard facts: NASA reports, mission data, peer-reviewed papers (observable, sourced)
- `scenario_chunks` — 2050 projections: NASA Vision 2050, ISRU roadmaps, economic analyses (forward-looking)
- Always route retrieval to the correct index based on query type — the Analyst and agents must not mix indices

## Embedding model
- Model: `voyage-large-2-instruct` — 1024-dimensional embeddings, cosine similarity
- Voyage AI is called via raw `fetch()` to `https://api.voyageai.com/v1/embeddings` (no official npm SDK)
- All embedding generation goes through `voyageService.ts` — do not add Voyage API calls elsewhere

## Source citation (mandatory)
- Every RAG chunk used in an agent or Analyst response must include `source_id` in the output
- The Analyst is architecturally constrained: it cannot use model weights for asteroid facts — all data must be sourced from the indices
- `[Science fact]` and `[2050 Projection]` footnotes must be rendered in the frontend for all cited chunks

## Chunking strategy
- Document-structure chunking: respects H1/H2/H3 hierarchy; headings attached to content
- Semantic chunking for academic papers: paragraph-level with 50-token overlap, max 512 tokens
- Never re-chunk already-indexed documents — create new entries with version tracking instead
- Run `npm run ingestDocuments` after adding new source documents; always `ANALYZE` the table after bulk inserts

## Retrieval
- Similarity function: cosine distance (`<=>`) — not L2, not inner product
- Standard retrieval: top-K with similarity threshold ≥ 0.40
- Always pass `source_type` label from retrieved chunks so the Analyst can format footnotes correctly
- Retrieval quality baseline: 17/20 test questions pass at ≥ 0.40 threshold — do not degrade this

## Analyst constraints
- Analyst sessions have a 24-hour TTL; `SessionExpiredError (410)` on expiry
- Analyst session history is stored in `analyst_sessions` table
- Analyst emits `AnalystTrace` SSE event before tokens — this observability event is required, do not remove it
- Context anchoring: `context_asteroid_id` accepted to pre-filter retrieval to a specific object

## See also
- `.claude/rules/agents.md` — agent grounding rules (no invented data, source_id on all RAG citations)
- `.claude/rules/database.md` — pgvector column spec and indexing rules
- `project-specs/AI_ARCHITECTURE.md` — full RAG architecture design
