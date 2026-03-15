/**
 * routes/analysis.ts
 *
 * Agent swarm analysis endpoints.
 *
 * POST /api/analysis/:asteroidId
 *   Trigger a full swarm analysis for an asteroid. Returns the full SwarmState
 *   and observability trace. Long-running — may take 30–90 seconds.
 *
 * GET /api/analysis/:asteroidId/latest
 *   Fetch the most recent completed analysis for an asteroid from the DB.
 *   Returns 404 if no analysis exists yet.
 *
 * GET /api/analysis/:analysisId/trace
 *   (Development/portfolio) Returns the raw analysis record including all
 *   agent outputs for inspection.
 */

import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { runOrchestrator } from '../services/orchestrator/orchestrator.js';
import { supabase } from '../db/supabase.js';
import { ValidationError, DatabaseError, NotFoundError } from '../errors/AppError.js';
import type { MissionParams, AgentType } from '../../../shared/types.js';

const router = Router();

// ── POST /api/analysis/:asteroidId ────────────────────────────────────────────

router.post('/:asteroidId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { asteroidId } = req.params as { asteroidId: string };
    if (!asteroidId) throw new ValidationError('asteroidId is required');

    // Parse optional mission params from request body
    const body = req.body as {
      missionParams?: MissionParams;
      agents?: string[];
    };

    const missionParams: MissionParams = body.missionParams ?? {};

    // Validate requested agents if provided
    const validAgents: AgentType[] = ['navigator', 'geologist', 'economist', 'riskAssessor'];
    let requestedAgents: AgentType[] = validAgents;
    if (body.agents && Array.isArray(body.agents)) {
      const invalid = body.agents.filter((a) => !validAgents.includes(a as AgentType));
      if (invalid.length > 0) {
        throw new ValidationError(`Unknown agents: ${invalid.join(', ')}. Valid: ${validAgents.join(', ')}`);
      }
      requestedAgents = body.agents as AgentType[];
    }

    const { state, trace } = await runOrchestrator(asteroidId, missionParams, requestedAgents);

    res.json({
      analysisId: trace.analysisId,
      asteroidId,
      status: state.phase,
      phase: state.phase,
      handoffTriggered: state.handoffTriggered,
      confidenceScores: state.confidenceScores,
      synthesis: state.synthesis ?? null,
      handoffPacket: state.handoffPacket ?? null,
      outputs: {
        navigator: state.navigatorOutput ?? null,
        geologist: state.geologistOutput ?? null,
        economist: state.economistOutput ?? null,
        risk: state.riskOutput ?? null,
      },
      trace: {
        totalLatencyMs: trace.totalLatencyMs,
        agentLatencies: Object.fromEntries(
          Object.entries(trace.agentTraces).map(([agent, t]) => [agent, t?.totalLatencyMs ?? null]),
        ),
        confidenceInputs: trace.confidenceInputs,
        agentEvents: Object.fromEntries(
          Object.entries(trace.agentTraces).map(([agent, t]) => [agent, t?.events ?? []]),
        ),
      },
      errors: state.errors,
    });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/analysis/:asteroidId/latest ──────────────────────────────────────

router.get('/:asteroidId/latest', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { asteroidId } = req.params as { asteroidId: string };

    const { data, error } = await supabase
      .from('analyses')
      .select('*')
      .eq('asteroid_id', asteroidId)
      .in('status', ['complete', 'handoff'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new NotFoundError(`No completed analysis found for asteroid ${asteroidId}`);
      }
      throw new DatabaseError(error.message);
    }

    res.json(data);
  } catch (err) {
    next(err);
  }
});

// ── GET /api/analysis/record/:analysisId ──────────────────────────────────────

router.get('/record/:analysisId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { analysisId } = req.params as { analysisId: string };

    const { data, error } = await supabase
      .from('analyses')
      .select('*')
      .eq('id', analysisId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new NotFoundError(`Analysis not found: ${analysisId}`);
      }
      throw new DatabaseError(error.message);
    }

    res.json(data);
  } catch (err) {
    next(err);
  }
});

export default router;
