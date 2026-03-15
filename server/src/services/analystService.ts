/**
 * analystService.ts
 *
 * The AI Analyst — a streaming RAG chatbot grounded exclusively in the
 * science_chunks and scenario_chunks knowledge base.
 *
 * Architecture:
 *   1. User message arrives
 *   2. queryRag() retrieves top chunks from both indices in parallel
 *   3. A structured "grounding context" block is injected into the Claude prompt
 *   4. Claude Sonnet 4.6 streams its response via the Anthropic SDK
 *   5. The route handler forwards each token to the client over SSE
 *
 * Observability:
 *   Every request produces an AnalystTrace — the full record of what the
 *   Analyst retrieved, what it sent to Claude, and how Claude responded.
 *   The trace is emitted as the first SSE event (type: "trace") before any
 *   text tokens, so the browser (and portfolio viewers) can see into the
 *   reasoning process in real time.
 *
 * Grounding constraints (enforced in system prompt):
 *   - Only cite content retrieved from science_chunks or scenario_chunks
 *   - Clearly distinguish science (measured facts) from scenario (2050 projections)
 *   - Say "I don't have enough information" when context is insufficient
 *   - Never invent statistics, paper citations, or mission data
 */

import Anthropic from '@anthropic-ai/sdk';
import { randomUUID } from 'crypto';
import { queryRag } from './ragService.js';
import { ValidationError, SessionExpiredError, AIServiceError } from '../errors/AppError.js';
import type { RagResult } from '../../../shared/types.js';

// ── Config ─────────────────────────────────────────────────────────────────────

const ANALYST_MODEL = 'claude-sonnet-4-6';
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const MAX_HISTORY_TURNS = 10;   // keep last N user+assistant pairs
const RAG_TOP_K = 5;            // chunks per index per query (10 combined max)
const RAG_THRESHOLD = 0.3;

// ── Types ──────────────────────────────────────────────────────────────────────

export interface AnalystSession {
  id: string;
  createdAt: number;
  lastActiveAt: number;
  history: Anthropic.MessageParam[];
  contextAsteroidId?: string;
}

/**
 * The observability trace emitted as the first SSE event on every message.
 * Contains everything the Analyst retrieved and the prompt it built —
 * designed to be displayed in the UI for portfolio visibility.
 */
export interface AnalystTrace {
  sessionId: string;
  query: string;
  retrievedChunks: Array<{
    sourceType: 'science' | 'scenario';
    sourceTitle: string;
    sourceId: string;
    sourceYear: number | null;
    chunkIndex: number;
    similarity: number;
    /** First 200 chars of the chunk — enough to show what was retrieved */
    preview: string;
  }>;
  ragCounts: { science: number; scenario: number };
  contextAsteroidId: string | null;
  promptTokenEstimate: number;
  retrievalLatencyMs: number;
}

// ── Session store ──────────────────────────────────────────────────────────────
// In-memory for Phase 4. No persistence needed — sessions are ephemeral.

const sessions = new Map<string, AnalystSession>();

function purgeExpiredSessions(): void {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (now - session.lastActiveAt > SESSION_TTL_MS) {
      sessions.delete(id);
    }
  }
}

// Purge every hour — keeps memory clean without a cron dependency
setInterval(purgeExpiredSessions, 60 * 60 * 1000);

// ── Session management ─────────────────────────────────────────────────────────

export function createSession(contextAsteroidId?: string): AnalystSession {
  const session: AnalystSession = {
    id: randomUUID(),
    createdAt: Date.now(),
    lastActiveAt: Date.now(),
    history: [],
    contextAsteroidId,
  };
  sessions.set(session.id, session);
  return session;
}

export function getSession(sessionId: string): AnalystSession {
  const session = sessions.get(sessionId);
  if (!session) throw new SessionExpiredError();

  const now = Date.now();
  if (now - session.lastActiveAt > SESSION_TTL_MS) {
    sessions.delete(sessionId);
    throw new SessionExpiredError();
  }

  session.lastActiveAt = now;
  return session;
}

export function deleteSession(sessionId: string): void {
  sessions.delete(sessionId);
}

// ── Prompt construction ────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are the Asteroid Bonanza AI Analyst — a research assistant specialized in near-Earth asteroid science, space resource economics, and planetary defense.

GROUNDING RULES (non-negotiable):
1. You may ONLY cite facts that appear in the RETRIEVED CONTEXT block below. Do not use your training knowledge for asteroid facts, mission data, statistics, or economic figures.
2. Every factual claim must be traceable to a specific source in the context. Include the source title when you cite it.
3. Clearly distinguish between:
   - [SCIENCE] — measured facts, peer-reviewed data, mission results (from science_chunks)
   - [SCENARIO / 2050 PROJECTION] — forward-looking projections, economic models, strategy documents (from scenario_chunks)
4. If the retrieved context does not contain enough information to answer the question, say exactly: "I don't have enough information in my knowledge base to answer that confidently." Do not fill gaps with speculation.
5. Never invent paper titles, author names, statistics, orbital parameters, or mission dates.

RESPONSE STYLE:
- Be precise and scientific. Use correct units (km/s, AU, kg, USD).
- When citing a source, use the format: (Source: <title>, <year>)
- Clearly label projections with phrases like "According to [source], by 2050..." rather than stating projections as established facts.
- Keep responses focused and evidence-based. Prefer substance over length.`;

function buildGroundingBlock(chunks: RagResult[], contextAsteroidId?: string): string {
  if (chunks.length === 0) {
    return '\n\nRETRIEVED CONTEXT: No relevant chunks found above similarity threshold.';
  }

  const lines: string[] = ['\n\nRETRIEVED CONTEXT:'];

  if (contextAsteroidId) {
    lines.push(`[Asteroid context: ${contextAsteroidId}]`);
  }

  chunks.forEach((chunk, i) => {
    const label = chunk.source_type === 'science' ? 'SCIENCE' : 'SCENARIO/PROJECTION';
    lines.push(
      `\n--- Chunk ${i + 1} [${label}] ---`,
      `Source: ${chunk.source_title} (${chunk.source_year ?? 'n/d'})`,
      `Similarity: ${(chunk.similarity * 100).toFixed(1)}%`,
      chunk.content,
    );
  });

  return lines.join('\n');
}

/** Rough token estimate: 1 token ≈ 4 chars */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// ── Anthropic client ──────────────────────────────────────────────────────────

function getAnthropicClient(): Anthropic {
  const apiKey = process.env['ANTHROPIC_API_KEY'];
  if (!apiKey) throw new AIServiceError('ANTHROPIC_API_KEY environment variable is not set');
  return new Anthropic({ apiKey });
}

// ── Core streaming function ────────────────────────────────────────────────────

/**
 * Stream an Analyst response.
 *
 * Calls the provided callbacks as events arrive:
 *   onTrace  — fired once before streaming starts, with the full observability trace
 *   onToken  — fired for each text delta as Claude streams
 *   onDone   — fired when streaming completes, with the full assembled response
 *   onError  — fired if anything goes wrong
 */
export async function streamAnalystMessage(
  sessionId: string,
  userMessage: string,
  callbacks: {
    onTrace: (trace: AnalystTrace) => void;
    onToken: (token: string) => void;
    onDone: (fullText: string) => void;
    onError: (err: Error) => void;
  },
): Promise<void> {
  const trimmed = userMessage.trim();
  if (!trimmed) throw new ValidationError('Message cannot be empty');

  const session = getSession(sessionId);

  // ── 1. Retrieve RAG context ────────────────────────────────────────────────
  const ragStart = Date.now();
  const ragResult = await queryRag(trimmed, {
    topK: RAG_TOP_K,
    threshold: RAG_THRESHOLD,
  });
  const retrievalLatencyMs = Date.now() - ragStart;

  // ── 2. Build observability trace ──────────────────────────────────────────
  const groundingBlock = buildGroundingBlock(
    ragResult.results,
    session.contextAsteroidId,
  );

  const trace: AnalystTrace = {
    sessionId,
    query: trimmed,
    retrievedChunks: ragResult.results.map((c) => ({
      sourceType: c.source_type,
      sourceTitle: c.source_title,
      sourceId: c.source_id,
      sourceYear: c.source_year,
      chunkIndex: c.chunk_index,
      similarity: c.similarity,
      preview: c.content.slice(0, 200),
    })),
    ragCounts: ragResult.counts,
    contextAsteroidId: session.contextAsteroidId ?? null,
    promptTokenEstimate: estimateTokens(SYSTEM_PROMPT + groundingBlock + trimmed),
    retrievalLatencyMs,
  };

  callbacks.onTrace(trace);

  // ── 3. Build message history ───────────────────────────────────────────────
  // Inject grounding context into the user turn (not the system prompt) so it
  // participates in the conversation flow and is visible in the history.
  const userTurnContent = trimmed + groundingBlock;

  const messages: Anthropic.MessageParam[] = [
    ...session.history.slice(-(MAX_HISTORY_TURNS * 2)),
    { role: 'user', content: userTurnContent },
  ];

  // ── 4. Stream from Claude ─────────────────────────────────────────────────
  const anthropic = getAnthropicClient();
  let fullText = '';

  try {
    const stream = await anthropic.messages.stream({
      model: ANALYST_MODEL,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages,
    });

    for await (const event of stream) {
      if (
        event.type === 'content_block_delta' &&
        event.delta.type === 'text_delta'
      ) {
        const token = event.delta.text;
        fullText += token;
        callbacks.onToken(token);
      }
    }

    // ── 5. Update session history ────────────────────────────────────────────
    // Store the clean user message (not the grounding-injected version) in
    // history so future turns have a readable conversation context.
    session.history.push(
      { role: 'user', content: trimmed },
      { role: 'assistant', content: fullText },
    );

    // Trim history to avoid unbounded growth
    if (session.history.length > MAX_HISTORY_TURNS * 2) {
      session.history = session.history.slice(-(MAX_HISTORY_TURNS * 2));
    }

    callbacks.onDone(fullText);
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    callbacks.onError(new AIServiceError(`Analyst stream failed: ${error.message}`));
  }
}
