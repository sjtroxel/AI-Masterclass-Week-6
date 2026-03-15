/**
 * agentLogger.ts
 *
 * Structured observability for the agent swarm.
 *
 * Each AgentLogger instance tracks events for one agent invocation:
 * inputs, tool calls (with inputs + results), RAG lookups, the final
 * structured output, and any errors. The resulting AgentTrace is included
 * in the API response so the UI can display the full reasoning chain.
 *
 * Design principles:
 * - Events are accumulated in-memory during the agent run, then returned.
 * - Every event is timestamped to support latency analysis.
 * - RAG lookups include similarity scores and chunk previews so reviewers
 *   can see exactly what grounded the agent's reasoning.
 * - Tool call results are logged at the raw level (before parsing), so
 *   failures are visible even if the agent couldn't interpret the result.
 */

import type { AgentType, RagResult } from '../../../../shared/types.js';

// ── Event shapes ──────────────────────────────────────────────────────────────

export interface AgentInputEvent {
  type: 'input';
  agent: AgentType;
  timestamp: string;
  asteroidId: string;
  asteroidName: string | null;
  dbFieldsSummary: Record<string, unknown>;
}

export interface AgentToolCallEvent {
  type: 'tool_call';
  agent: AgentType;
  timestamp: string;
  toolName: string;
  toolInput: Record<string, unknown>;
}

export interface AgentToolResultEvent {
  type: 'tool_result';
  agent: AgentType;
  timestamp: string;
  toolName: string;
  success: boolean;
  resultSummary: string;   // Brief description (not full payload — could be large)
  latencyMs: number;
}

export interface AgentRagLookupEvent {
  type: 'rag_lookup';
  agent: AgentType;
  timestamp: string;
  query: string;
  retrievedCount: number;
  counts: { science: number; scenario: number };
  chunks: Array<{
    sourceType: 'science' | 'scenario';
    sourceTitle: string;
    sourceId: string;
    similarity: number;
    preview: string;       // First 200 chars
  }>;
  latencyMs: number;
}

export interface AgentOutputEvent {
  type: 'output';
  agent: AgentType;
  timestamp: string;
  dataCompleteness: number;
  assumptionsCount: number;
  sourcesCount: number;
  latencyMs: number;        // Total agent wall-clock time
}

export interface AgentErrorEvent {
  type: 'error';
  agent: AgentType;
  timestamp: string;
  message: string;
  code: string;
}

export type AgentLogEvent =
  | AgentInputEvent
  | AgentToolCallEvent
  | AgentToolResultEvent
  | AgentRagLookupEvent
  | AgentOutputEvent
  | AgentErrorEvent;

// ── Agent trace (returned with API response) ──────────────────────────────────

export interface AgentTrace {
  agent: AgentType;
  events: AgentLogEvent[];
  totalLatencyMs: number;
}

// ── Logger ────────────────────────────────────────────────────────────────────

export class AgentLogger {
  private readonly events: AgentLogEvent[] = [];
  private readonly startTime: number;

  constructor(private readonly agent: AgentType) {
    this.startTime = Date.now();
  }

  logInput(
    asteroidId: string,
    asteroidName: string | null,
    dbFieldsSummary: Record<string, unknown>,
  ): void {
    this.push({
      type: 'input',
      agent: this.agent,
      timestamp: new Date().toISOString(),
      asteroidId,
      asteroidName,
      dbFieldsSummary,
    });
  }

  logToolCall(toolName: string, toolInput: Record<string, unknown>): void {
    this.push({
      type: 'tool_call',
      agent: this.agent,
      timestamp: new Date().toISOString(),
      toolName,
      toolInput,
    });
  }

  logToolResult(
    toolName: string,
    success: boolean,
    resultSummary: string,
    latencyMs: number,
  ): void {
    this.push({
      type: 'tool_result',
      agent: this.agent,
      timestamp: new Date().toISOString(),
      toolName,
      success,
      resultSummary,
      latencyMs,
    });
  }

  logRagLookup(
    query: string,
    chunks: RagResult[],
    counts: { science: number; scenario: number },
    latencyMs: number,
  ): void {
    this.push({
      type: 'rag_lookup',
      agent: this.agent,
      timestamp: new Date().toISOString(),
      query,
      retrievedCount: chunks.length,
      counts,
      chunks: chunks.map((c) => ({
        sourceType: c.source_type,
        sourceTitle: c.source_title,
        sourceId: c.source_id,
        similarity: c.similarity,
        preview: c.content.slice(0, 200),
      })),
      latencyMs,
    });
  }

  logOutput(dataCompleteness: number, assumptionsCount: number, sourcesCount: number): void {
    this.push({
      type: 'output',
      agent: this.agent,
      timestamp: new Date().toISOString(),
      dataCompleteness,
      assumptionsCount,
      sourcesCount,
      latencyMs: Date.now() - this.startTime,
    });
  }

  logError(message: string, code: string): void {
    this.push({
      type: 'error',
      agent: this.agent,
      timestamp: new Date().toISOString(),
      message,
      code,
    });
  }

  getTrace(): AgentTrace {
    return {
      agent: this.agent,
      events: [...this.events],
      totalLatencyMs: Date.now() - this.startTime,
    };
  }

  private push(event: AgentLogEvent): void {
    this.events.push(event);
    // Structured console output in development
    if (process.env['NODE_ENV'] !== 'production') {
      const { type, timestamp, ...rest } = event;
      console.log(
        JSON.stringify({ level: 'agent', type, timestamp, ...rest }),
      );
    }
  }
}
