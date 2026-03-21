/**
 * riskAssessor.ts — Risk Assessor Agent
 *
 * Domain: Planetary defense and mission risk.
 *
 * Evaluates two separate risk dimensions:
 * 1. Planetary defense risk — how much of a threat does this object pose to Earth?
 * 2. Mission risk — if we sent a spacecraft here, what are the operational challenges?
 *
 * Tool use:
 *   - fetch_close_approaches → upcoming Earth encounters
 *   - query_science_index    → planetary defense science grounding
 *   - submit_risk_analysis   → forced-choice final output (stops the loop)
 *
 * Runs in parallel with the Geologist (both are independent of each other).
 * Economist runs after both complete.
 */

import Anthropic from '@anthropic-ai/sdk';
import type { RiskOutput, SwarmState, MissionParams, CloseApproach } from '../../../../shared/types.js';
import type { AsteroidRow } from '../asteroidService.js';
import { SONNET } from '../../../../shared/models.js';
import { AIServiceError } from '../../errors/AppError.js';
import { AgentLogger } from './agentLogger.js';
import {
  FETCH_CLOSE_APPROACHES_TOOL,
  QUERY_SCIENCE_INDEX_TOOL,
  fetchCloseApproaches,
  queryScienceIndex,
} from './tools.js';

// ── Submit tool ───────────────────────────────────────────────────────────────

const SUBMIT_TOOL: Anthropic.Tool = {
  name: 'submit_risk_analysis',
  description:
    'Submit your final Risk Assessor analysis. Call this ONCE after gathering all necessary data. This is the only way to complete the analysis.',
  input_schema: {
    type: 'object' as const,
    properties: {
      planetaryDefense: {
        type: 'object' as const,
        properties: {
          isPHA: { type: 'boolean', description: 'Whether NASA classifies this as a Potentially Hazardous Asteroid.' },
          hazardRating: {
            type: 'string',
            enum: ['none', 'negligible', 'low', 'moderate', 'elevated', 'high'],
            description: 'Overall planetary defense hazard rating.',
          },
          monitoringStatus: {
            type: 'string',
            description: 'Plain language on NASA\'s current tracking and monitoring status.',
          },
          notableApproaches: {
            type: 'array',
            description: 'Significant future or recent close approaches worth highlighting.',
            items: {
              type: 'object' as const,
              properties: {
                id: { type: 'string' },
                asteroid_id: { type: 'string' },
                close_approach_date: { type: 'string' },
                miss_distance_km: { type: 'number' },
                relative_velocity_km_s: { type: 'number' },
                orbiting_body: { type: 'string' },
              },
              required: ['id', 'asteroid_id', 'close_approach_date', 'miss_distance_km', 'relative_velocity_km_s', 'orbiting_body'],
            },
          },
          mitigationContext: {
            type: 'string',
            description: 'What deflection options exist or have been considered, if relevant. Empty string if not applicable.',
          },
        },
        required: ['isPHA', 'hazardRating', 'monitoringStatus', 'notableApproaches', 'mitigationContext'],
      },
      missionRisk: {
        type: 'object' as const,
        properties: {
          overallRating: {
            type: 'string',
            enum: ['low', 'moderate', 'high', 'extreme'],
            description: 'Overall mission risk rating.',
          },
          communicationDelayMinutes: {
            type: 'object' as const,
            properties: { min: { type: 'number' }, max: { type: 'number' } },
            required: ['min', 'max'],
            description: 'Round-trip communication delay range based on orbital distance.',
          },
          surfaceConditions: {
            type: 'string',
            description: 'What landing or proximity operations near this object type would involve.',
          },
          primaryRisks: {
            type: 'array',
            items: {
              type: 'object' as const,
              properties: {
                risk: { type: 'string' },
                severity: { type: 'string', enum: ['critical', 'high', 'moderate', 'low'] },
                mitigation: { type: 'string' },
              },
              required: ['risk', 'severity'],
            },
          },
        },
        required: ['overallRating', 'communicationDelayMinutes', 'surfaceConditions', 'primaryRisks'],
      },
      dataCompleteness: {
        type: 'number',
        description: '0.0–1.0 representing data availability. 1.0 = PHA flag + close approach data + good science chunks. Lower if data is missing.',
      },
      assumptionsRequired: {
        type: 'array',
        items: { type: 'string' },
        description: 'Assumptions made due to missing data.',
      },
      reasoning: {
        type: 'string',
        description: 'Plain-language summary of the risk assessment. 2–4 sentences.',
      },
      sources: {
        type: 'array',
        items: { type: 'string' },
        description: 'source_id values from retrieved science chunks used.',
      },
    },
    required: ['planetaryDefense', 'missionRisk', 'dataCompleteness', 'assumptionsRequired', 'reasoning', 'sources'],
  },
};

// ── System prompt ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are the Risk Assessor Agent for Asteroid Bonanza — an expert in planetary defense and space mission risk analysis.

YOUR ROLE:
Evaluate two distinct risk dimensions for a given near-Earth asteroid:

1. PLANETARY DEFENSE RISK — Does this object pose a threat to Earth?
   - Is it a PHA (Potentially Hazardous Asteroid)?
   - What are the significant close approaches?
   - What is NASA's monitoring and mitigation status?

2. MISSION RISK — What challenges would a spacecraft face at this object?
   - Communication delays based on orbital distance
   - Surface/proximity operations complexity
   - Navigation and rendezvous challenges
   - Primary failure modes

PROCESS:
1. Review the asteroid's hazard flags and orbital data from the DB record.
2. Call fetch_close_approaches to get upcoming Earth approach data.
3. Call query_science_index for planetary defense context (Torino/Palermo scale, mitigation options).
4. Submit your structured analysis.

HAZARD RATING GUIDANCE:
- none: non-PHA, no significant approaches, purely technical target
- negligible: PHA but no concerning approaches within 100 years
- low: notable approaches but impact probability < 1-in-10,000
- moderate: multiple notable approaches, requires monitoring
- elevated: on Sentry/CNEOS watch list with non-zero impact probability
- high: active mitigation consideration (Apophis pre-2021 level)

COMMUNICATION DELAY ESTIMATION:
- At 0.1 AU: ~1.4 min one-way (2.8 min round-trip)
- At 1 AU: ~14 min one-way (28 min round-trip)
- Use MOID and orbital semi-major axis as proxies when no approach data is available.

GROUNDING RULES:
- Torino/Palermo scale values must come from retrieved science chunks or DB — never invented.
- If no close approach data is returned, note this in assumptionsRequired.`;

// ── Agent function ─────────────────────────────────────────────────────────────

export interface RiskAssessorResult {
  output: RiskOutput;
  trace: ReturnType<AgentLogger['getTrace']>;
}

export async function runRiskAssessor(
  asteroid: AsteroidRow,
  _state: SwarmState,
  _missionParams: MissionParams,
  onProgress?: (event: import('./agentLogger.js').AgentLogEvent) => void,
): Promise<RiskAssessorResult> {
  const logger = new AgentLogger('riskAssessor', onProgress);

  logger.logInput(asteroid.id, asteroid.name ?? asteroid.full_name ?? null, {
    is_pha: asteroid.is_pha,
    is_sentry_object: asteroid.is_sentry_object,
    designation: asteroid.designation,
    min_orbit_intersection_au: asteroid.min_orbit_intersection_au,
    semi_major_axis_au: asteroid.semi_major_axis_au,
    next_approach_date: asteroid.next_approach_date,
    next_approach_au: asteroid.next_approach_au,
  });

  const apiKey = process.env['ANTHROPIC_API_KEY'];
  if (!apiKey) throw new AIServiceError('ANTHROPIC_API_KEY environment variable is not set');
  const client = new Anthropic({ apiKey, maxRetries: 5 });

  const userMessage = buildUserMessage(asteroid);
  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: userMessage }];
  const tools: Anthropic.Tool[] = [FETCH_CLOSE_APPROACHES_TOOL, QUERY_SCIENCE_INDEX_TOOL, SUBMIT_TOOL];

  let submitInput: RiskOutput | null = null;
  const MAX_TURNS = 6;

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const response = await client.messages.create({
      model: SONNET,
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      tools,
      messages,
    });

    messages.push({ role: 'assistant', content: response.content });

    const submitBlock = response.content.find(
      (b): b is Anthropic.ToolUseBlock =>
        b.type === 'tool_use' && b.name === 'submit_risk_analysis',
    );

    if (submitBlock) {
      submitInput = submitBlock.input as RiskOutput;
      break;
    }

    const toolUseBlocks = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
    );

    if (toolUseBlocks.length === 0) {
      messages.push({
        role: 'user',
        content: 'Please call submit_risk_analysis to complete your analysis.',
      });
      continue;
    }

    const toolResults = await Promise.all(
      toolUseBlocks.map(async (block) => {
        const t0 = Date.now();
        logger.logToolCall(block.name, block.input as Record<string, unknown>);

        let content: string;

        try {
          if (block.name === 'fetch_close_approaches') {
            const result = await fetchCloseApproaches(block.input as { designation: string });
            logger.logToolResult(
              block.name,
              true,
              result.nextApproach ? `Next: ${result.nextApproach.date}` : 'No approaches found',
              Date.now() - t0,
            );
            content = JSON.stringify(result);
          } else if (block.name === 'query_science_index') {
            const { result, rawChunks } = await queryScienceIndex(
              block.input as { query: string; topK?: number },
            );
            logger.logRagLookup(
              (block.input as { query: string }).query,
              rawChunks,
              { science: rawChunks.length, scenario: 0 },
              Date.now() - t0,
            );
            logger.logToolResult(block.name, true, `Retrieved ${rawChunks.length} chunks`, Date.now() - t0);
            content = JSON.stringify(result);
          } else {
            throw new Error(`Unknown tool: ${block.name}`);
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          content = JSON.stringify({ error: msg });
          logger.logToolResult(block.name, false, `Error: ${msg}`, Date.now() - t0);
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
    throw new AIServiceError('Risk Assessor agent did not call submit_risk_analysis within turn limit');
  }

  // Normalize notableApproaches to match CloseApproach shape
  const normalizedOutput: RiskOutput = {
    ...submitInput,
    planetaryDefense: {
      ...submitInput.planetaryDefense,
      notableApproaches: submitInput.planetaryDefense.notableApproaches.map(
        (a: Partial<CloseApproach>): CloseApproach => ({
          id: a.id ?? '',
          asteroid_id: a.asteroid_id ?? asteroid.id,
          close_approach_date: a.close_approach_date ?? '',
          miss_distance_km: a.miss_distance_km ?? 0,
          relative_velocity_km_s: a.relative_velocity_km_s ?? 0,
          orbiting_body: a.orbiting_body ?? 'Earth',
        }),
      ),
    },
  };

  logger.logOutput(
    normalizedOutput.dataCompleteness,
    normalizedOutput.assumptionsRequired?.length ?? 0,
    normalizedOutput.sources?.length ?? 0,
  );

  return { output: normalizedOutput, trace: logger.getTrace() };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildUserMessage(asteroid: AsteroidRow): string {
  const name = asteroid.name ?? asteroid.full_name ?? asteroid.nasa_id;
  const lines: string[] = [
    `## Asteroid Record: ${name}`,
    '',
    '### Hazard Classification',
    `- Potentially Hazardous Asteroid (PHA): ${asteroid.is_pha}`,
    `- On Sentry impact monitoring list: ${asteroid.is_sentry_object}`,
    `- NASA ID: ${asteroid.nasa_id}`,
    `- Designation: ${asteroid.designation ?? 'not available'}`,
    '',
    '### Orbital Parameters (relevant to hazard)',
    `- Semi-major axis: ${asteroid.semi_major_axis_au ?? 'unknown'} AU`,
    `- Eccentricity: ${asteroid.eccentricity ?? 'unknown'}`,
    `- Inclination: ${asteroid.inclination_deg ?? 'unknown'}°`,
    `- Min orbit intersection (MOID): ${asteroid.min_orbit_intersection_au ?? 'unknown'} AU`,
    `- Next approach date (DB): ${asteroid.next_approach_date ?? 'not available'}`,
    `- Next approach distance (DB): ${asteroid.next_approach_au != null ? `${asteroid.next_approach_au} AU` : 'not available'}`,
    '',
    '### Physical Parameters',
    `- Diameter: ${asteroid.diameter_min_km != null ? `${asteroid.diameter_min_km}–${asteroid.diameter_max_km} km` : 'not available'}`,
    `- Absolute magnitude (H): ${asteroid.absolute_magnitude_h ?? 'unknown'}`,
    '',
    'Please fetch close approach data and retrieve relevant planetary defense science, then submit your risk assessment.',
  ];
  return lines.join('\n');
}
