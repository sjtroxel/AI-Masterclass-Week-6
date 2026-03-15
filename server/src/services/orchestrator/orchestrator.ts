/**
 * orchestrator.ts — Lead Orchestrator
 *
 * The state machine controller for the agent swarm. Does no domain analysis —
 * routes, sequences, computes confidence, and synthesizes.
 *
 * Routing:
 *   1. Fetch asteroid from DB
 *   2. Run Navigator (orbital accessibility)
 *   3. Run Geologist + Risk Assessor in parallel (independent)
 *   4. Run Economist (requires Geologist output)
 *   5. Compute ConfidenceScores from observable fields
 *   6. If overall < HANDOFF_THRESHOLD → build HandoffPacket
 *   7. Else → run Claude synthesis pass
 *   8. Persist to analyses table
 *
 * Confidence computation:
 *   Scores are NEVER self-reported. They are computed from:
 *   - agent.dataCompleteness (0–1)
 *   - len(agent.assumptionsRequired) — penalizes assumption-heavy outputs
 *   - whether the agent succeeded at all
 *
 * Observability:
 *   Returns a SwarmTrace including each agent's AgentTrace, the confidence
 *   computation inputs, and the final synthesis or handoff.
 */

import Anthropic from '@anthropic-ai/sdk';
import type {
  SwarmState,
  SwarmPhase,
  ConfidenceScores,
  HandoffPacket,
  MissionParams,
  AgentType,
} from '../../../../shared/types.js';
import type { AsteroidRow } from '../asteroidService.js';
import { getAsteroidById } from '../asteroidService.js';
import { supabaseAdmin } from '../../db/supabase.js';
import { SONNET } from '../../../../shared/models.js';
import { AIServiceError, DatabaseError, NotFoundError } from '../../errors/AppError.js';
import { runNavigator } from './navigator.js';
import { runGeologist } from './geologist.js';
import { runRiskAssessor } from './riskAssessor.js';
import { runEconomist } from './economist.js';
import type { AgentTrace } from './agentLogger.js';

// ── Constants ─────────────────────────────────────────────────────────────────

/**
 * Minimum acceptable overall confidence for a full synthesis.
 * Below this, the Orchestrator produces a HandoffPacket instead.
 * Calibrate empirically after Phase 5 produces real outputs.
 */
const HANDOFF_THRESHOLD = 0.30;

// Confidence weights (must sum to 1.0)
const CONFIDENCE_WEIGHTS = {
  orbital: 0.25,
  compositional: 0.30,
  economic: 0.25,
  risk: 0.20,
} as const;

// ── Swarm trace (full observability record) ───────────────────────────────────

export interface SwarmTrace {
  analysisId: string;
  asteroidId: string;
  asteroidName: string | null;
  agentTraces: Partial<Record<AgentType, AgentTrace>>;
  confidenceInputs: {
    orbital: { dataCompleteness: number; assumptionsCount: number; agentSucceeded: boolean };
    compositional: { dataCompleteness: number; assumptionsCount: number; agentSucceeded: boolean };
    economic: { dataCompleteness: number; assumptionsCount: number; agentSucceeded: boolean };
    risk: { dataCompleteness: number; assumptionsCount: number; agentSucceeded: boolean };
  };
  confidenceScores: ConfidenceScores;
  handoffTriggered: boolean;
  synthesisLatencyMs?: number;
  totalLatencyMs: number;
}

export interface OrchestratorResult {
  state: SwarmState;
  trace: SwarmTrace;
}

// ── Public entry point ────────────────────────────────────────────────────────

export async function runOrchestrator(
  asteroidId: string,
  missionParams: MissionParams,
  requestedAgents: AgentType[] = ['navigator', 'geologist', 'economist', 'riskAssessor'],
): Promise<OrchestratorResult> {
  const wallStart = Date.now();

  // ── Init state ──────────────────────────────────────────────────────────────
  const state: SwarmState = {
    asteroidId,
    missionParams,
    requestedAgents,
    phase: 'idle',
    errors: [],
    handoffTriggered: false,
  };

  const agentTraces: Partial<Record<AgentType, AgentTrace>> = {};

  // ── Fetch asteroid ──────────────────────────────────────────────────────────
  let asteroid: AsteroidRow;
  try {
    asteroid = await getAsteroidById(asteroidId);
  } catch (err) {
    if (err instanceof NotFoundError) throw err;
    throw new DatabaseError(`Failed to fetch asteroid ${asteroidId}`);
  }

  const asteroidName = asteroid.name ?? asteroid.full_name ?? asteroid.nasa_id;

  // Create initial DB record
  const analysisId = await createAnalysisRecord(asteroidId);

  // ── Phase: Navigator ────────────────────────────────────────────────────────
  mutatePhase(state, 'navigating');
  await updateAnalysisPhase(analysisId, 'navigating');

  if (requestedAgents.includes('navigator')) {
    try {
      const { output, trace } = await runNavigator(asteroid, state, missionParams);
      state.navigatorOutput = output;
      agentTraces['navigator'] = trace;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      state.errors.push({ agent: 'navigator', message: msg, code: 'AGENT_ERROR', recoverable: true });
      console.error('[Orchestrator] Navigator failed:', msg);
    }
  }

  // ── Phase: Geologist + Risk Assessor (parallel) ─────────────────────────────
  mutatePhase(state, 'geologizing');
  await updateAnalysisPhase(analysisId, 'geologizing');

  const parallelResults = await Promise.allSettled([
    requestedAgents.includes('geologist')
      ? runGeologist(asteroid, state, missionParams)
      : Promise.resolve(null),
    requestedAgents.includes('riskAssessor')
      ? runRiskAssessor(asteroid, state, missionParams)
      : Promise.resolve(null),
  ]);

  const [geologistResult, riskResult] = parallelResults;

  if (geologistResult.status === 'fulfilled' && geologistResult.value) {
    state.geologistOutput = geologistResult.value.output;
    agentTraces['geologist'] = geologistResult.value.trace;
  } else if (geologistResult.status === 'rejected') {
    const msg = geologistResult.reason instanceof Error ? geologistResult.reason.message : String(geologistResult.reason);
    state.errors.push({ agent: 'geologist', message: msg, code: 'AGENT_ERROR', recoverable: true });
    console.error('[Orchestrator] Geologist failed:', msg);
  }

  if (riskResult.status === 'fulfilled' && riskResult.value) {
    state.riskOutput = riskResult.value.output;
    agentTraces['riskAssessor'] = riskResult.value.trace;
  } else if (riskResult.status === 'rejected') {
    const msg = riskResult.reason instanceof Error ? riskResult.reason.message : String(riskResult.reason);
    state.errors.push({ agent: 'riskAssessor', message: msg, code: 'AGENT_ERROR', recoverable: true });
    console.error('[Orchestrator] Risk Assessor failed:', msg);
  }

  // ── Phase: Economist (depends on Geologist) ─────────────────────────────────
  mutatePhase(state, 'economizing');
  await updateAnalysisPhase(analysisId, 'economizing');

  if (requestedAgents.includes('economist')) {
    try {
      const { output, trace } = await runEconomist(asteroid, state, missionParams);
      state.economistOutput = output;
      agentTraces['economist'] = trace;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      state.errors.push({ agent: 'economist', message: msg, code: 'AGENT_ERROR', recoverable: true });
      console.error('[Orchestrator] Economist failed:', msg);
    }
  }

  // ── Phase: Compute confidence ────────────────────────────────────────────────
  const confidenceInputs = buildConfidenceInputs(state, requestedAgents);
  const confidenceScores = computeConfidenceScores(confidenceInputs);
  state.confidenceScores = confidenceScores;

  // ── Phase: Synthesize or handoff ─────────────────────────────────────────────
  mutatePhase(state, 'synthesizing');
  await updateAnalysisPhase(analysisId, 'synthesizing');

  let synthesisLatencyMs: number | undefined;

  if (confidenceScores.overall < HANDOFF_THRESHOLD) {
    // Build handoff packet — confidence too low for reliable synthesis
    state.handoffTriggered = true;
    state.handoffPacket = buildHandoffPacket(state, confidenceScores);
    mutatePhase(state, 'handoff');
  } else {
    // Run synthesis pass
    const synthStart = Date.now();
    try {
      state.synthesis = await runSynthesis(asteroid, state);
      synthesisLatencyMs = Date.now() - synthStart;
      mutatePhase(state, 'complete');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[Orchestrator] Synthesis failed:', msg);
      // Fall back to handoff if synthesis fails
      state.handoffTriggered = true;
      state.handoffPacket = buildHandoffPacket(state, confidenceScores, 'agent_failure');
      mutatePhase(state, 'handoff');
    }
  }

  // ── Persist final state ──────────────────────────────────────────────────────
  await persistFinalState(analysisId, state);

  const swarmTrace: SwarmTrace = {
    analysisId,
    asteroidId,
    asteroidName,
    agentTraces,
    confidenceInputs,
    confidenceScores,
    handoffTriggered: state.handoffTriggered,
    synthesisLatencyMs,
    totalLatencyMs: Date.now() - wallStart,
  };

  return { state, trace: swarmTrace };
}

// ── Confidence computation ────────────────────────────────────────────────────

type ConfidenceInputs = SwarmTrace['confidenceInputs'];

function buildConfidenceInputs(
  state: SwarmState,
  requestedAgents: AgentType[],
): ConfidenceInputs {
  return {
    orbital: {
      dataCompleteness: state.navigatorOutput?.dataCompleteness ?? 0,
      assumptionsCount: state.navigatorOutput?.assumptionsRequired?.length ?? 0,
      agentSucceeded: requestedAgents.includes('navigator') ? state.navigatorOutput !== undefined : true,
    },
    compositional: {
      dataCompleteness: state.geologistOutput?.dataCompleteness ?? 0,
      assumptionsCount: state.geologistOutput?.assumptionsRequired?.length ?? 0,
      agentSucceeded: requestedAgents.includes('geologist') ? state.geologistOutput !== undefined : true,
    },
    economic: {
      dataCompleteness: state.economistOutput?.dataCompleteness ?? 0,
      assumptionsCount: state.economistOutput?.assumptionsRequired?.length ?? 0,
      agentSucceeded: requestedAgents.includes('economist') ? state.economistOutput !== undefined : true,
    },
    risk: {
      dataCompleteness: state.riskOutput?.dataCompleteness ?? 0,
      assumptionsCount: state.riskOutput?.assumptionsRequired?.length ?? 0,
      agentSucceeded: requestedAgents.includes('riskAssessor') ? state.riskOutput !== undefined : true,
    },
  };
}

function computeDimensionScore(inputs: ConfidenceInputs[keyof ConfidenceInputs]): number {
  if (!inputs.agentSucceeded) return 0;

  // Start from dataCompleteness
  let score = inputs.dataCompleteness;

  // Penalize for each assumption required (max penalty: 0.3)
  const assumptionPenalty = Math.min(0.3, inputs.assumptionsCount * 0.05);
  score = Math.max(0, score - assumptionPenalty);

  return Math.round(score * 100) / 100; // 2 decimal places
}

function computeConfidenceScores(inputs: ConfidenceInputs): ConfidenceScores {
  const orbital = computeDimensionScore(inputs.orbital);
  const compositional = computeDimensionScore(inputs.compositional);
  const economic = computeDimensionScore(inputs.economic);
  const risk = computeDimensionScore(inputs.risk);

  const overall =
    orbital * CONFIDENCE_WEIGHTS.orbital +
    compositional * CONFIDENCE_WEIGHTS.compositional +
    economic * CONFIDENCE_WEIGHTS.economic +
    risk * CONFIDENCE_WEIGHTS.risk;

  return {
    orbital,
    compositional,
    economic,
    risk,
    overall: Math.round(overall * 100) / 100,
  };
}

// ── Synthesis pass ────────────────────────────────────────────────────────────

async function runSynthesis(asteroid: AsteroidRow, state: SwarmState): Promise<string> {
  const apiKey = process.env['ANTHROPIC_API_KEY'];
  if (!apiKey) throw new AIServiceError('ANTHROPIC_API_KEY environment variable is not set');
  const client = new Anthropic({ apiKey, maxRetries: 5 });

  const name = asteroid.name ?? asteroid.full_name ?? asteroid.nasa_id;
  const prompt = buildSynthesisPrompt(name, state);

  const response = await client.messages.create({
    model: SONNET,
    max_tokens: 1500,
    system: `You are the Lead Orchestrator for Asteroid Bonanza. Your job is to synthesize outputs from four domain agents into a clear, accurate, and grounded assessment of an asteroid's potential. Be honest about uncertainty. Do not inflate confidence. Write for an intelligent non-specialist audience — clear, precise, no jargon without explanation.`,
    messages: [{ role: 'user', content: prompt }],
  });

  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new AIServiceError('Synthesis pass returned no text content');
  }
  return textBlock.text;
}

function buildSynthesisPrompt(asteroidName: string, state: SwarmState): string {
  const lines: string[] = [
    `## Synthesis Request: ${asteroidName}`,
    '',
    `Confidence scores: orbital=${state.confidenceScores?.orbital}, ` +
    `compositional=${state.confidenceScores?.compositional}, ` +
    `economic=${state.confidenceScores?.economic}, ` +
    `risk=${state.confidenceScores?.risk}`,
    '',
  ];

  if (state.navigatorOutput) {
    lines.push(
      '### Navigator Assessment',
      `Accessibility: ${state.navigatorOutput.accessibilityRating}`,
      `Min delta-V: ${state.navigatorOutput.minDeltaV_kms ?? 'unknown'} km/s`,
      `Mission duration: ${state.navigatorOutput.missionDurationDays ?? 'unknown'} days`,
      state.navigatorOutput.reasoning,
      '',
    );
  }

  if (state.geologistOutput) {
    lines.push(
      '### Geologist Assessment',
      `Spectral class: ${state.geologistOutput.spectralClass}`,
      `Composition confidence: ${state.geologistOutput.compositionConfidence}`,
      `Key resources: ${state.geologistOutput.keyResources.map((r) => r.resource).join(', ')}`,
      state.geologistOutput.reasoning,
      '',
    );
  }

  if (state.economistOutput) {
    lines.push(
      '### Economist Assessment',
      `Mission ROI: ${state.economistOutput.missionROI}`,
      `Total value range: $${(state.economistOutput.totalResourceValueUSD.min / 1e9).toFixed(1)}B–$${(state.economistOutput.totalResourceValueUSD.max / 1e9).toFixed(1)}B`,
      state.economistOutput.reasoning,
      `Disclaimer: ${state.economistOutput.disclaimer}`,
      '',
    );
  }

  if (state.riskOutput) {
    lines.push(
      '### Risk Assessment',
      `Planetary defense hazard: ${state.riskOutput.planetaryDefense.hazardRating}`,
      `Mission risk: ${state.riskOutput.missionRisk.overallRating}`,
      state.riskOutput.reasoning,
      '',
    );
  }

  lines.push(
    'Write a 3–5 paragraph synthesis that:',
    '1. Opens with the most important finding about this asteroid',
    '2. Integrates the orbital, compositional, and economic picture',
    '3. Addresses the risk dimension (both planetary defense and mission risk)',
    '4. Is clear about what is known vs. estimated vs. uncertain',
    '5. Closes with a bottom-line assessment of this asteroid\'s significance',
  );

  return lines.join('\n');
}

// ── Handoff packet ────────────────────────────────────────────────────────────

function buildHandoffPacket(
  state: SwarmState,
  confidenceScores: ConfidenceScores,
  trigger: HandoffPacket['triggeredBy'] = 'low_confidence',
): HandoffPacket {
  const breakdownItems: string[] = [];
  if (confidenceScores.orbital < 0.5) breakdownItems.push(`orbital (${confidenceScores.orbital})`);
  if (confidenceScores.compositional < 0.5) breakdownItems.push(`compositional (${confidenceScores.compositional})`);
  if (confidenceScores.economic < 0.5) breakdownItems.push(`economic (${confidenceScores.economic})`);
  if (confidenceScores.risk < 0.5) breakdownItems.push(`risk (${confidenceScores.risk})`);

  const whatWasFound = [
    state.navigatorOutput ? `Navigator: ${state.navigatorOutput.accessibilityRating} accessibility` : null,
    state.geologistOutput ? `Geologist: ${state.geologistOutput.compositionConfidence} composition confidence` : null,
    state.economistOutput ? `Economist: ${state.economistOutput.missionROI} ROI` : null,
    state.riskOutput ? `Risk: ${state.riskOutput.planetaryDefense.hazardRating} hazard` : null,
  ].filter(Boolean).join('; ');

  return {
    triggeredBy: trigger,
    aggregateConfidence: confidenceScores.overall,
    whatWasFound: whatWasFound || 'Insufficient data gathered across all agents',
    confidenceBreakdown: confidenceScores,
    whereConfidenceBrokDown: breakdownItems.length > 0
      ? `Low confidence in: ${breakdownItems.join(', ')}`
      : 'Overall confidence below synthesis threshold',
    whatHumanExpertNeeds:
      'A planetary scientist with access to the full JPL orbital solution, spectroscopic data, ' +
      'and current mission planning databases should review this object. The automated analysis ' +
      'was limited by incomplete data in one or more domains.',
    generatedAt: new Date().toISOString(),
  };
}

// ── DB helpers ────────────────────────────────────────────────────────────────

async function createAnalysisRecord(asteroidId: string): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from('analyses')
    .insert({ asteroid_id: asteroidId, status: 'running', phase: 'idle' })
    .select('id')
    .single();

  if (error) throw new DatabaseError(`Failed to create analysis record: ${error.message}`);
  const row = data as { id: string };
  return row.id;
}

async function updateAnalysisPhase(analysisId: string, phase: SwarmPhase): Promise<void> {
  const { error } = await supabaseAdmin
    .from('analyses')
    .update({ phase })
    .eq('id', analysisId);

  if (error) console.error('[Orchestrator] Failed to update analysis phase:', error.message);
}

async function persistFinalState(analysisId: string, state: SwarmState): Promise<void> {
  const { error } = await supabaseAdmin
    .from('analyses')
    .update({
      status: state.phase === 'complete' ? 'complete' : state.phase === 'handoff' ? 'handoff' : 'error',
      phase: state.phase,
      navigator_output: state.navigatorOutput ?? null,
      geologist_output: state.geologistOutput ?? null,
      economist_output: state.economistOutput ?? null,
      risk_output: state.riskOutput ?? null,
      confidence_scores: state.confidenceScores ?? null,
      synthesis: state.synthesis ?? null,
      handoff_packet: state.handoffPacket ?? null,
    })
    .eq('id', analysisId);

  if (error) console.error('[Orchestrator] Failed to persist final state:', error.message);
}

// ── Utility ───────────────────────────────────────────────────────────────────

function mutatePhase(state: SwarmState, phase: SwarmPhase): void {
  state.phase = phase;
}
