/**
 * navigator.ts — Navigator Agent
 *
 * Domain: Orbital mechanics and mission accessibility.
 *
 * The Navigator interprets NASA's pre-computed accessibility data in plain
 * language. It reasons about which close-approach windows are most favorable
 * and explains tradeoffs between mission duration and delta-V. The LLM does
 * not calculate trajectories — it reasons about NASA's calculations.
 *
 * Tool use:
 *   - fetch_nhats_data    → JPL NHATS delta-V budget
 *   - fetch_close_approaches → upcoming close approach windows
 *   - submit_navigator_analysis → forced-choice final output (stops the loop)
 *
 * Confidence inputs for Orchestrator:
 *   - dataCompleteness: fraction of expected NHATS + CAD fields that arrived
 *   - assumptionsRequired: list of assumptions made due to missing data
 */

import Anthropic from '@anthropic-ai/sdk';
import type { NavigatorOutput, SwarmState, MissionParams } from '../../../../shared/types.js';
import type { AsteroidRow } from '../asteroidService.js';
import { SONNET } from '../../../../shared/models.js';
import { AIServiceError } from '../../errors/AppError.js';
import { AgentLogger } from './agentLogger.js';
import type { AgentLogEvent } from './agentLogger.js';
import {
  FETCH_NHATS_TOOL,
  FETCH_CLOSE_APPROACHES_TOOL,
  fetchNHATSData,
  fetchCloseApproaches,
} from './tools.js';

// ── Submit tool definition ─────────────────────────────────────────────────────
// Claude MUST call this as its final action. The tool input IS the NavigatorOutput.

const SUBMIT_TOOL: Anthropic.Tool = {
  name: 'submit_navigator_analysis',
  description:
    'Submit your final Navigator analysis. Call this ONCE after you have gathered ' +
    'all necessary data and formed your assessment. This is the only way to complete the analysis.',
  input_schema: {
    type: 'object' as const,
    properties: {
      accessibilityRating: {
        type: 'string',
        enum: ['exceptional', 'good', 'marginal', 'inaccessible'],
        description: 'Overall mission accessibility rating based on delta-V and approach data.',
      },
      minDeltaV_kms: {
        type: ['number', 'null'],
        description: 'Minimum delta-V required (km/s), or null if not available from NHATS.',
      },
      bestLaunchWindows: {
        type: 'array',
        description: 'Best identified launch opportunities (up to 3). May be empty if no data.',
        items: {
          type: 'object',
          properties: {
            date: { type: 'string', description: 'ISO date of launch opportunity.' },
            deltaV_kms: { type: 'number' },
            missionDurationDays: { type: 'number' },
            notes: { type: 'string' },
          },
          required: ['date', 'deltaV_kms', 'missionDurationDays'],
        },
      },
      missionDurationDays: {
        type: ['number', 'null'],
        description: 'Minimum mission duration (days), or null if unavailable.',
      },
      orbitalClass: {
        type: 'string',
        description: 'Orbital classification (e.g. "Apollo", "Aten", "Amor").',
      },
      dataCompleteness: {
        type: 'number',
        description: '0.0–1.0 representing how complete the available data was. 1.0 = full NHATS + CAD data. 0.5 = partial. 0.0 = no external data, DB values only.',
      },
      assumptionsRequired: {
        type: 'array',
        items: { type: 'string' },
        description: 'List of assumptions made due to missing or incomplete data.',
      },
      reasoning: {
        type: 'string',
        description: 'Plain-language explanation of the accessibility assessment for the user. 2–4 sentences.',
      },
      sources: {
        type: 'array',
        items: { type: 'string' },
        description: 'Source IDs from any RAG chunks used (leave empty if no RAG was consulted).',
      },
    },
    required: [
      'accessibilityRating',
      'minDeltaV_kms',
      'bestLaunchWindows',
      'missionDurationDays',
      'orbitalClass',
      'dataCompleteness',
      'assumptionsRequired',
      'reasoning',
      'sources',
    ],
  },
};

// ── System prompt ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are the Navigator Agent for Asteroid Bonanza — an expert in orbital mechanics and space mission accessibility analysis.

YOUR ROLE:
- Assess how accessible an asteroid is for human missions or robotic rendezvous.
- Interpret NASA's pre-computed NHATS delta-V budgets and JPL close-approach data.
- You do NOT compute trajectories yourself — you interpret NASA's calculations and reason about what they mean for mission planning.

PROCESS:
1. Review the asteroid's database record (provided in the user message).
2. If the asteroid has a designation, call fetch_nhats_data to get NHATS accessibility data.
3. Call fetch_close_approaches to get upcoming approach windows.
4. Synthesize what you know into an accessibility assessment.
5. Call submit_navigator_analysis with your structured output.

ACCESSIBILITY RATINGS:
- exceptional: delta-V < 4.5 km/s, NHATS accessible
- good: delta-V 4.5–6 km/s, or very close approaches within 10 years
- marginal: delta-V 6–8 km/s, or limited approach data
- inaccessible: delta-V > 8 km/s, or no viable mission window found

DATA COMPLETENESS GUIDANCE:
- 1.0: Full NHATS data + CAD data returned, no gaps
- 0.7: One source returned, other returned null
- 0.4: Both returned null, using DB pre-fetched values only
- 0.2: No external data, DB values also sparse

GROUNDING RULES:
- Never invent delta-V values or orbital parameters — use only what the tools return or what is in the DB record.
- If data is missing, say so in assumptionsRequired and lower dataCompleteness accordingly.
- Always call submit_navigator_analysis as your final action.`;

// ── Agent function ─────────────────────────────────────────────────────────────

export interface NavigatorResult {
  output: NavigatorOutput;
  trace: ReturnType<AgentLogger['getTrace']>;
}

export async function runNavigator(
  asteroid: AsteroidRow,
  _state: SwarmState,
  missionParams: MissionParams,
  onProgress?: (event: AgentLogEvent) => void,
): Promise<NavigatorResult> {
  const logger = new AgentLogger('navigator', onProgress);

  logger.logInput(asteroid.id, asteroid.name ?? asteroid.full_name ?? null, {
    designation: asteroid.designation,
    orbital_class: (asteroid as unknown as Record<string, unknown>)['orbital_class'],
    nhats_accessible: asteroid.nhats_accessible,
    nhats_min_delta_v_kms: asteroid.nhats_min_delta_v_kms,
    nhats_min_duration_days: asteroid.nhats_min_duration_days,
    semi_major_axis_au: asteroid.semi_major_axis_au,
    eccentricity: asteroid.eccentricity,
    inclination_deg: asteroid.inclination_deg,
    next_approach_date: asteroid.next_approach_date,
    next_approach_au: asteroid.next_approach_au,
    missionParams,
  });

  const apiKey = process.env['ANTHROPIC_API_KEY'];
  if (!apiKey) throw new AIServiceError('ANTHROPIC_API_KEY environment variable is not set');
  const client = new Anthropic({ apiKey, maxRetries: 5 });

  const userMessage = buildUserMessage(asteroid, missionParams);
  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: userMessage }];
  const tools: Anthropic.Tool[] = [FETCH_NHATS_TOOL, FETCH_CLOSE_APPROACHES_TOOL, SUBMIT_TOOL];

  // ── Agentic loop ────────────────────────────────────────────────────────────
  let submitInput: NavigatorOutput | null = null;
  const MAX_TURNS = 6;

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const response = await client.messages.create({
      model: SONNET,
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      tools,
      messages,
    });

    // Accumulate assistant turn
    messages.push({ role: 'assistant', content: response.content });

    // Check for submit tool call (terminal condition)
    const submitBlock = response.content.find(
      (b): b is Anthropic.ToolUseBlock =>
        b.type === 'tool_use' && b.name === 'submit_navigator_analysis',
    );

    if (submitBlock) {
      submitInput = submitBlock.input as NavigatorOutput;
      break;
    }

    // Handle data tool calls
    const toolUseBlocks = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
    );

    if (toolUseBlocks.length === 0) {
      // No tool calls and no submit — model responded with text only; request submit
      messages.push({
        role: 'user',
        content: 'Please call submit_navigator_analysis to complete your analysis.',
      });
      continue;
    }

    // Execute tools in parallel where possible
    const toolResults = await Promise.all(
      toolUseBlocks.map(async (block) => {
        const t0 = Date.now();
        logger.logToolCall(block.name, block.input as Record<string, unknown>);

        let content: string;
        let success = true;

        try {
          const result = await dispatchTool(block.name, block.input as Record<string, unknown>);
          content = JSON.stringify(result);
          logger.logToolResult(block.name, true, summarizeToolResult(block.name, result), Date.now() - t0);
        } catch (err) {
          success = false;
          const msg = err instanceof Error ? err.message : String(err);
          content = JSON.stringify({ error: msg });
          logger.logToolResult(block.name, false, `Error: ${msg}`, Date.now() - t0);
        }

        if (!success) {
          logger.logError(`Tool ${block.name} failed`, 'TOOL_ERROR');
        }

        return {
          type: 'tool_result' as const,
          tool_use_id: block.id,
          content,
        };
      }),
    );

    messages.push({ role: 'user', content: toolResults });
  }

  if (!submitInput) {
    throw new AIServiceError('Navigator agent did not call submit_navigator_analysis within turn limit');
  }

  logger.logOutput(
    submitInput.dataCompleteness,
    submitInput.assumptionsRequired?.length ?? 0,
    submitInput.sources?.length ?? 0,
  );

  return { output: submitInput, trace: logger.getTrace() };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildUserMessage(asteroid: AsteroidRow, missionParams: MissionParams): string {
  const name = asteroid.name ?? asteroid.full_name ?? asteroid.nasa_id;
  const lines: string[] = [
    `## Asteroid Record: ${name}`,
    '',
    '### Database Fields',
    `- NASA ID: ${asteroid.nasa_id}`,
    `- Designation: ${asteroid.designation ?? 'not available'}`,
    `- NHATS accessible (DB pre-fetched): ${asteroid.nhats_accessible ?? 'unknown'}`,
    `- NHATS min delta-V (DB pre-fetched): ${asteroid.nhats_min_delta_v_kms != null ? `${asteroid.nhats_min_delta_v_kms} km/s` : 'not available'}`,
    `- NHATS min duration (DB pre-fetched): ${asteroid.nhats_min_duration_days != null ? `${asteroid.nhats_min_duration_days} days` : 'not available'}`,
    `- Semi-major axis: ${asteroid.semi_major_axis_au ?? 'unknown'} AU`,
    `- Eccentricity: ${asteroid.eccentricity ?? 'unknown'}`,
    `- Inclination: ${asteroid.inclination_deg ?? 'unknown'}°`,
    `- Orbital period: ${asteroid.orbital_period_yr ?? 'unknown'} years`,
    `- Min orbit intersection (MOID): ${asteroid.min_orbit_intersection_au ?? 'unknown'} AU`,
    `- Next approach date (DB): ${asteroid.next_approach_date ?? 'not available'}`,
    `- Next approach distance (DB): ${asteroid.next_approach_au != null ? `${asteroid.next_approach_au} AU` : 'not available'}`,
    '',
    '### Mission Parameters (User Constraints)',
    `- Max delta-V budget: ${missionParams.maxDeltaV_kms != null ? `${missionParams.maxDeltaV_kms} km/s` : 'not specified'}`,
    `- Mission window: ${missionParams.missionWindowStart ?? 'no start constraint'} to ${missionParams.missionWindowEnd ?? 'no end constraint'}`,
    `- Mission type: ${missionParams.missionType ?? 'not specified'}`,
    '',
    'Please fetch live NHATS and close-approach data using the tools, then submit your analysis.',
  ];
  return lines.join('\n');
}

async function dispatchTool(name: string, input: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case 'fetch_nhats_data':
      return fetchNHATSData(input as { designation: string });
    case 'fetch_close_approaches':
      return fetchCloseApproaches(input as { designation: string });
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

function summarizeToolResult(toolName: string, result: unknown): string {
  if (toolName === 'fetch_nhats_data') {
    const r = result as { found: boolean; minDeltaV_kms: number | null };
    return r.found ? `NHATS found: deltaV=${r.minDeltaV_kms} km/s` : 'Not in NHATS catalog';
  }
  if (toolName === 'fetch_close_approaches') {
    const r = result as { nextApproach: { date: string } | null };
    return r.nextApproach ? `Next approach: ${r.nextApproach.date}` : 'No close approaches found';
  }
  return 'result returned';
}
