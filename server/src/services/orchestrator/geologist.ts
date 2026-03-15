/**
 * geologist.ts — Geologist Agent
 *
 * Domain: Spectral analysis and mineral composition estimation.
 *
 * Translates spectral classification into an estimated resource profile.
 * Spectral classes have known compositional correlations (C-type → water/organics,
 * M-type → iron/nickel/platinum-group metals, S-type → silicates/metals).
 * The LLM reasons about these correlations from RAG-retrieved science, acknowledges
 * uncertainty ranges, and produces a plain-language resource profile.
 *
 * Tool use:
 *   - query_science_index → spectral class science grounding
 *   - submit_geologist_analysis → forced-choice final output (stops the loop)
 */

import Anthropic from '@anthropic-ai/sdk';
import type { GeologistOutput, SwarmState, MissionParams } from '../../../../shared/types.js';
import type { AsteroidRow } from '../asteroidService.js';
import { SONNET } from '../../../../shared/models.js';
import { AIServiceError } from '../../errors/AppError.js';
import { AgentLogger } from './agentLogger.js';
import { QUERY_SCIENCE_INDEX_TOOL, queryScienceIndex } from './tools.js';

// ── Submit tool ───────────────────────────────────────────────────────────────

const NUMBER_RANGE_SCHEMA = {
  type: 'object' as const,
  properties: {
    min: { type: 'number' },
    max: { type: 'number' },
  },
  required: ['min', 'max'],
};

const SUBMIT_TOOL: Anthropic.Tool = {
  name: 'submit_geologist_analysis',
  description:
    'Submit your final Geologist analysis. Call this ONCE after retrieving and ' +
    'reviewing relevant science chunks. This is the only way to complete the analysis.',
  input_schema: {
    type: 'object' as const,
    properties: {
      spectralClass: {
        type: 'string',
        description: 'The asteroid\'s spectral class (e.g. "C", "S", "M", "X"). Use "unknown" if not in the record.',
      },
      compositionEstimate: {
        type: 'object' as const,
        description: 'Estimated composition ranges. Ranges may be wide for uncertain classes.',
        properties: {
          water_ice_pct: NUMBER_RANGE_SCHEMA,
          carbonaceous_pct: NUMBER_RANGE_SCHEMA,
          silicate_pct: NUMBER_RANGE_SCHEMA,
          iron_nickel_pct: NUMBER_RANGE_SCHEMA,
          platinum_group_pct: NUMBER_RANGE_SCHEMA,
          other_pct: NUMBER_RANGE_SCHEMA,
        },
        required: ['water_ice_pct', 'carbonaceous_pct', 'silicate_pct', 'iron_nickel_pct', 'platinum_group_pct', 'other_pct'],
      },
      keyResources: {
        type: 'array',
        items: {
          type: 'object' as const,
          properties: {
            resource: { type: 'string' },
            significance: { type: 'string' },
          },
          required: ['resource', 'significance'],
        },
        description: 'Noteworthy resources for this specific asteroid.',
      },
      compositionConfidence: {
        type: 'string',
        enum: ['well_characterized', 'estimated', 'uncertain', 'unknown'],
        description: 'Confidence in the composition estimate based on spectral data quality.',
      },
      analogAsteroids: {
        type: 'array',
        items: { type: 'string' },
        description: 'Real asteroid names with similar spectral profiles (e.g. "Bennu", "Ryugu").',
      },
      dataCompleteness: {
        type: 'number',
        description: '0.0–1.0. High if spectral class is known and science chunks were retrieved. Low if spectral class is null or unknown.',
      },
      assumptionsRequired: {
        type: 'array',
        items: { type: 'string' },
        description: 'Assumptions made due to missing spectral or physical data.',
      },
      reasoning: {
        type: 'string',
        description: 'Plain-language explanation of the composition assessment. 2–4 sentences.',
      },
      sources: {
        type: 'array',
        items: { type: 'string' },
        description: 'source_id values from retrieved science chunks used in the analysis.',
      },
    },
    required: [
      'spectralClass', 'compositionEstimate', 'keyResources', 'compositionConfidence',
      'analogAsteroids', 'dataCompleteness', 'assumptionsRequired', 'reasoning', 'sources',
    ],
  },
};

// ── System prompt ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are the Geologist Agent for Asteroid Bonanza — an expert in asteroid spectral analysis and mineral composition.

YOUR ROLE:
- Translate an asteroid's spectral classification into an estimated mineral composition profile.
- Reason about resource potential based on known spectral-composition correlations.
- Acknowledge uncertainty ranges — composition estimates for most NEOs are probabilistic.

SPECTRAL CLASS REFERENCE (for context — always verify with retrieved science):
- C-type: Carbonaceous. High water ice (5–25%), organics, low metal. Like Bennu, Ryugu.
- S-type: Silicate + metal mix. Iron/nickel (10–30%), silicates (50–70%), some platinum group.
- M-type: Metal-rich. Iron/nickel dominant (50–80%), platinum-group metals (trace but high value).
- X-type: Ambiguous; could be E (enstatite), M (metal), or P (dark primitive).
- D/P-type: Primitive, organic-rich outer solar system material.
- V-type: Basaltic crust material. Low metal, high silicates.

PROCESS:
1. Note the asteroid's spectral class (SMASS or Tholen) from the DB record.
2. Search the science index for composition data relevant to this spectral class.
3. If the asteroid is a named/famous object, search for it specifically.
4. Submit your structured analysis.

GROUNDING RULES:
- Composition ranges must be grounded in retrieved science chunks where possible.
- If no chunks were retrieved, acknowledge this in assumptionsRequired and lower dataCompleteness.
- Never invent specific percentages — always express as ranges.
- Cite sources by their source_id in the sources field.`;

// ── Agent function ─────────────────────────────────────────────────────────────

export interface GeologistResult {
  output: GeologistOutput;
  trace: ReturnType<AgentLogger['getTrace']>;
}

export async function runGeologist(
  asteroid: AsteroidRow,
  _state: SwarmState,
  _missionParams: MissionParams,
): Promise<GeologistResult> {
  const logger = new AgentLogger('geologist');

  logger.logInput(asteroid.id, asteroid.name ?? asteroid.full_name ?? null, {
    spectral_type_smass: asteroid.spectral_type_smass,
    spectral_type_tholen: asteroid.spectral_type_tholen,
    diameter_min_km: asteroid.diameter_min_km,
    diameter_max_km: asteroid.diameter_max_km,
    absolute_magnitude_h: asteroid.absolute_magnitude_h,
  });

  const apiKey = process.env['ANTHROPIC_API_KEY'];
  if (!apiKey) throw new AIServiceError('ANTHROPIC_API_KEY environment variable is not set');
  const client = new Anthropic({ apiKey });

  const userMessage = buildUserMessage(asteroid);
  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: userMessage }];
  const tools: Anthropic.Tool[] = [QUERY_SCIENCE_INDEX_TOOL, SUBMIT_TOOL];

  let submitInput: GeologistOutput | null = null;
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
        b.type === 'tool_use' && b.name === 'submit_geologist_analysis',
    );

    if (submitBlock) {
      submitInput = submitBlock.input as GeologistOutput;
      break;
    }

    const toolUseBlocks = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
    );

    if (toolUseBlocks.length === 0) {
      messages.push({
        role: 'user',
        content: 'Please call submit_geologist_analysis to complete your analysis.',
      });
      continue;
    }

    const toolResults = await Promise.all(
      toolUseBlocks.map(async (block) => {
        const t0 = Date.now();
        logger.logToolCall(block.name, block.input as Record<string, unknown>);

        let content: string;

        try {
          const { result, rawChunks } = await queryScienceIndex(
            block.input as { query: string; topK?: number },
          );
          const counts = { science: rawChunks.length, scenario: 0 };
          logger.logRagLookup(
            (block.input as { query: string }).query,
            rawChunks,
            counts,
            Date.now() - t0,
          );
          logger.logToolResult(block.name, true, `Retrieved ${rawChunks.length} science chunks`, Date.now() - t0);
          content = JSON.stringify(result);
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
    throw new AIServiceError('Geologist agent did not call submit_geologist_analysis within turn limit');
  }

  logger.logOutput(
    submitInput.dataCompleteness,
    submitInput.assumptionsRequired.length,
    submitInput.sources.length,
  );

  return { output: submitInput, trace: logger.getTrace() };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildUserMessage(asteroid: AsteroidRow): string {
  const name = asteroid.name ?? asteroid.full_name ?? asteroid.nasa_id;
  const spectral = asteroid.spectral_type_smass ?? asteroid.spectral_type_tholen ?? 'unknown';
  const lines: string[] = [
    `## Asteroid Record: ${name}`,
    '',
    '### Physical & Spectral Data',
    `- NASA ID: ${asteroid.nasa_id}`,
    `- Spectral type (SMASS): ${asteroid.spectral_type_smass ?? 'not classified'}`,
    `- Spectral type (Tholen): ${asteroid.spectral_type_tholen ?? 'not classified'}`,
    `- Diameter range: ${asteroid.diameter_min_km != null ? `${asteroid.diameter_min_km}–${asteroid.diameter_max_km} km` : 'not available'}`,
    `- Absolute magnitude (H): ${asteroid.absolute_magnitude_h ?? 'unknown'}`,
    '',
    `Please search the science index for "${spectral}-type asteroid composition" and any other ` +
    `relevant queries, then submit your composition analysis.`,
  ];
  return lines.join('\n');
}
