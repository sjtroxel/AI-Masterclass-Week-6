/**
 * analyst.service.ts
 *
 * Angular singleton service for the AI Analyst chat.
 *
 * All state is Signal-based. The service owns the full session lifecycle:
 * start → message → stream → done/error → end.
 *
 * SSE is consumed via fetch() + ReadableStream because the message endpoint
 * is a POST (EventSource only supports GET).
 */

import { Injectable, signal, computed } from '@angular/core';

// ── Domain types ──────────────────────────────────────────────────────────────

export interface RetrievedChunk {
  sourceType: 'science' | 'scenario';
  sourceTitle: string;
  sourceId: string;
  sourceYear: number | null;
  chunkIndex: number;
  similarity: number;
  preview: string;
}

export interface AnalystTrace {
  sessionId: string;
  query: string;
  retrievedChunks: RetrievedChunk[];
  ragCounts: { science: number; scenario: number };
  contextAsteroidId: string | null;
  promptTokenEstimate: number;
  retrievalLatencyMs: number;
}

export type MessageRole = 'user' | 'assistant';

export interface ChatMessage {
  id: string;
  role: MessageRole;
  text: string;
  isStreaming: boolean;
  trace?: AnalystTrace;
}

// ── Service ────────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class AnalystService {
  // ── Public signals (read-only from components) ───────────────────────────
  readonly sessionToken = signal<string | null>(null);
  readonly contextAsteroidId = signal<string | null>(null);
  readonly messages = signal<ChatMessage[]>([]);
  readonly isStreaming = signal(false);
  readonly isStartingSession = signal(false);
  readonly error = signal<string | null>(null);
  readonly sessionExpired = signal(false);

  readonly hasSession = computed(() => this.sessionToken() !== null);
  readonly isEmpty = computed(() => this.messages().length === 0);

  // ── Session management ───────────────────────────────────────────────────

  async startSession(contextAsteroidId?: string): Promise<void> {
    this.isStartingSession.set(true);
    this.error.set(null);
    this.sessionExpired.set(false);

    try {
      const res = await fetch('/api/analyst/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context_asteroid_id: contextAsteroidId ?? null }),
      });

      if (!res.ok) {
        throw new Error(`Failed to start session: ${res.status}`);
      }

      const data = await res.json() as { session_token: string };
      this.sessionToken.set(data.session_token);
      this.contextAsteroidId.set(contextAsteroidId ?? null);
      this.messages.set([]);
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Failed to start session');
    } finally {
      this.isStartingSession.set(false);
    }
  }

  async endSession(): Promise<void> {
    const token = this.sessionToken();
    if (!token) return;

    // Best-effort cleanup — don't block the user on failure
    fetch('/api/analyst/session', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_token: token }),
    }).catch(() => {/* silent */});

    this.sessionToken.set(null);
    this.contextAsteroidId.set(null);
    this.messages.set([]);
    this.error.set(null);
    this.sessionExpired.set(false);
  }

  async resetSession(contextAsteroidId?: string): Promise<void> {
    await this.endSession();
    await this.startSession(contextAsteroidId);
  }

  // ── Message streaming ────────────────────────────────────────────────────

  async sendMessage(userText: string): Promise<void> {
    const token = this.sessionToken();
    if (!token || this.isStreaming()) return;

    const trimmed = userText.trim();
    if (!trimmed) return;

    this.error.set(null);

    // Add user message immediately
    this.pushMessage({ role: 'user', text: trimmed, isStreaming: false });

    // Placeholder for streaming assistant response
    const assistantId = crypto.randomUUID();
    this.pushMessage({ id: assistantId, role: 'assistant', text: '', isStreaming: true });
    this.isStreaming.set(true);

    try {
      const res = await fetch('/api/analyst/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_token: token, message: trimmed }),
      });

      if (res.status === 410) {
        this.sessionExpired.set(true);
        this.removeMessage(assistantId);
        this.isStreaming.set(false);
        return;
      }

      if (!res.ok || !res.body) {
        throw new Error(`Request failed: ${res.status}`);
      }

      const reader = res.body.getReader();
      let fullText = '';

      for await (const { type, data } of parseSSE(reader)) {
        if (type === 'trace') {
          const trace = JSON.parse(data) as AnalystTrace;
          this.updateMessage(assistantId, (m) => ({ ...m, trace }));
        } else if (type === 'token') {
          fullText += data;
          this.updateMessage(assistantId, (m) => ({ ...m, text: fullText }));
        } else if (type === 'error') {
          this.updateMessage(assistantId, (m) => ({
            ...m,
            text: `Error: ${data}`,
            isStreaming: false,
          }));
          this.error.set(data);
          break;
        } else if (type === 'done') {
          this.updateMessage(assistantId, (m) => ({ ...m, isStreaming: false }));
          break;
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Stream failed';
      this.updateMessage(assistantId, (m) => ({
        ...m,
        text: m.text || `Error: ${msg}`,
        isStreaming: false,
      }));
      this.error.set(msg);
    } finally {
      this.isStreaming.set(false);
    }
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  private pushMessage(partial: Partial<ChatMessage> & { role: MessageRole; text: string }): void {
    const msg: ChatMessage = {
      id: partial.id ?? crypto.randomUUID(),
      role: partial.role,
      text: partial.text,
      isStreaming: partial.isStreaming ?? false,
      trace: partial.trace,
    };
    this.messages.update((msgs) => [...msgs, msg]);
  }

  private updateMessage(id: string, updater: (m: ChatMessage) => ChatMessage): void {
    this.messages.update((msgs) => msgs.map((m) => (m.id === id ? updater(m) : m)));
  }

  private removeMessage(id: string): void {
    this.messages.update((msgs) => msgs.filter((m) => m.id !== id));
  }
}

// ── SSE stream parser ─────────────────────────────────────────────────────────

/**
 * Async generator that reads a ReadableStream and yields parsed SSE events.
 * Handles multi-line data fields and arbitrary chunk boundaries.
 */
async function* parseSSE(
  reader: ReadableStreamDefaultReader<Uint8Array>,
): AsyncGenerator<{ type: string; data: string }> {
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // SSE events are separated by double newlines
    const rawEvents = buffer.split('\n\n');
    // Keep the last (possibly incomplete) chunk in the buffer
    buffer = rawEvents.pop() ?? '';

    for (const rawEvent of rawEvents) {
      if (!rawEvent.trim()) continue;

      let eventType = 'message';
      let data = '';

      for (const line of rawEvent.split('\n')) {
        if (line.startsWith('event: ')) {
          eventType = line.slice(7).trim();
        } else if (line.startsWith('data: ')) {
          data = line.slice(6);
        }
      }

      yield { type: eventType, data };
    }
  }
}
