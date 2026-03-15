/**
 * analyst.ts — Express routes for the AI Analyst
 *
 * POST   /api/analyst/start    — create anonymous session
 * POST   /api/analyst/message  — send message, stream SSE response
 * DELETE /api/analyst/session  — explicit session cleanup
 *
 * SSE event types emitted by POST /message:
 *   { type: "trace",  data: AnalystTrace }   — observability payload (first event)
 *   { type: "token",  data: "<text>" }        — streamed text delta
 *   { type: "done",   data: "" }              — stream complete
 *   { type: "error",  data: "<message>" }     — error during stream
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import {
  createSession,
  getSession,
  deleteSession,
  streamAnalystMessage,
} from '../services/analystService.js';
import { AppError, ValidationError } from '../errors/AppError.js';

const router = Router();

// ── POST /api/analyst/start ───────────────────────────────────────────────────

router.post('/start', (req: Request, res: Response) => {
  const body = req.body as { context_asteroid_id?: unknown };
  const contextAsteroidId =
    typeof body.context_asteroid_id === 'string' ? body.context_asteroid_id : undefined;

  const session = createSession(contextAsteroidId);

  res.status(201).json({
    session_token: session.id,
    created_at: new Date(session.createdAt).toISOString(),
    expires_at: new Date(session.createdAt + 24 * 60 * 60 * 1000).toISOString(),
    context_asteroid_id: session.contextAsteroidId ?? null,
  });
});

// ── POST /api/analyst/message (SSE stream) ────────────────────────────────────

router.post('/message', async (req: Request, res: Response) => {
  const body = req.body as { session_token?: unknown; message?: unknown };

  const sessionToken = typeof body.session_token === 'string' ? body.session_token : null;
  const message = typeof body.message === 'string' ? body.message : null;

  if (!sessionToken) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'session_token is required' } });
    return;
  }
  if (!message) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'message is required' } });
    return;
  }

  // Validate session exists before opening SSE stream
  try {
    getSession(sessionToken);
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: { code: err.code, message: err.message } });
    } else {
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Unexpected error' } });
    }
    return;
  }

  // ── SSE headers ─────────────────────────────────────────────────────────────
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // disable Nginx buffering in production
  res.flushHeaders();

  const sendEvent = (type: string, data: unknown): void => {
    const payload = typeof data === 'string' ? data : JSON.stringify(data);
    res.write(`event: ${type}\ndata: ${payload}\n\n`);
  };

  try {
    await streamAnalystMessage(sessionToken, message, {
      onTrace: (trace) => sendEvent('trace', trace),
      onToken: (token) => sendEvent('token', token),
      onDone: () => sendEvent('done', ''),
      onError: (err) => {
        sendEvent('error', err.message);
        res.end();
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unexpected error';
    sendEvent('error', msg);
  } finally {
    res.end();
  }
});

// ── DELETE /api/analyst/session ───────────────────────────────────────────────

router.delete('/session', (req: Request, res: Response) => {
  const body = req.body as { session_token?: unknown };
  const sessionToken = typeof body.session_token === 'string' ? body.session_token : null;

  if (!sessionToken) {
    throw new ValidationError('session_token is required');
  }

  deleteSession(sessionToken);
  res.status(204).send();
});

export default router;
