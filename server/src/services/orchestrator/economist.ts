/**
 * economist.ts — Economist Agent
 *
 * Domain: Resource value modeling in the 2050 scenario context.
 *
 * Runs AFTER Navigator and Geologist have completed — it consumes their outputs:
 * - geologistOutput.compositionEstimate (required: drives the value model)
 * - navigatorOutput.minDeltaV_kms + missionDurationDays (mission cost input)
 *
 * Models three value streams:
 * 1. Terrestrial export value — PGMs and rare elements worth returning to Earth
 * 2. In-space utilization value — water, iron/nickel for orbital economy
 * 3. Strategic value — resources enabling further capabilities
 *
 * All 2050 projections MUST come from the scenario RAG index.
 * The agent cannot invent market prices.
 *
 * Tool use:
 *   - query_scenario_index → 2050 market assumptions, ISRU economics
 *   - query_science_index  → cross-reference science (optional)
 *   - submit_economist_analysis → forced-choice final output
 */

import Anthropic from '@anthropic-ai/sdk';
import type { EconomistOutput, SwarmState, MissionParams } from '../../../../shared/types.js';
import type { AsteroidRow } from '../asteroidService.js';
import { SONNET } from '../../../../shared/models.js';
import { AIServiceError } from '../../errors/AppError.js';
import { AgentLogger } from './agentLogger.js';
import { QUERY_SCENARIO_INDEX_TOOL, QUERY_SCIENCE_INDEX_TOOL, queryScenarioIndex, queryScienceIndex } from './tools.js';

// ── Submit tool ───────────────────────────────────────────────────────────────

const NUMBER_RANGE_SCHEMA = {
  type: 'object' as const,
  properties: { min: { type: 'number' }, max: { type: 'number' } },
  required: ['min', 'max'],
};

const SUBMIT_TOOL: Anthropic.Tool = {
  name: 'submit_economist_analysis',
  description:
    'Submit your final Economist analysis. Call this ONCE after reviewing scenario ' +
    'context and composition data. This is the only way to complete the analysis.',
  input_schema: {
    type: 'object' as const,
    properties: {
      totalResourceValueUSD: {
        ...NUMBER_RANGE_SCHEMA,
        description: 'Total estimated resource value in USD. Always express as a wide range — these are rough 2050 projections.',
      },
      terrestrialExportValue: {
        ...NUMBER_RANGE_SCHEMA,
        description: 'Value of resources worth shipping back to Earth (primarily PGMs, rare elements). In USD.',
      },
      inSpaceUtilizationValue: {
        ...NUMBER_RANGE_SCHEMA,
        description: 'Value of resources usable in orbit or deep space (water-ice for propellant, metals for construction). In USD.',
      },
      missionROI: {
        type: 'string',
        enum: ['exceptional', 'positive', 'marginal', 'negative', 'unmodelable'],
        description: 'Overall return-on-investment assessment given mission costs and resource value.',
      },
      keyValueDrivers: {
        type: 'array',
        items: {
          type: 'object' as const,
          properties: {
            driver: { type: 'string' },
            impact: { type: 'string', enum: ['high', 'moderate', 'low'] },
            description: { type: 'string' },
          },
          required: ['driver', 'impact', 'description'],
        },
        description: 'What makes this asteroid economically interesting.',
      },
      keyRisks: {
        type: 'array',
        items: {
          type: 'object' as const,
          properties: {
            risk: { type: 'string' },
            severity: { type: 'string', enum: ['critical', 'significant', 'moderate', 'minor'] },
            description: { type: 'string' },
          },
          required: ['risk', 'severity', 'description'],
        },
        description: 'Economic risks that could make this unviable.',
      },
      scenarioAssumptions: {
        type: 'array',
        items: { type: 'string' },
        description: 'Explicit 2050 assumptions from the scenario index used in the model.',
      },
      dataCompleteness: {
        type: 'number',
        description: '0.0–1.0. High if composition data + scenario chunks available. Low if composition was uncertain or scenario index returned few chunks.',
      },
      assumptionsRequired: {
        type: 'array',
        items: { type: 'string' },
        description: 'Assumptions beyond scenario index data.',
      },
      reasoning: {
        type: 'string',
        description: 'Plain-language economic assessment. 3–5 sentences.',
      },
      disclaimer: {
        type: 'string',
        description: 'Must include: "These are 2050 scenario projections, not current market values. Actual economics depend on technology development, launch costs, and market conditions that cannot be predicted with confidence."',
      },
      sources: {
        type: 'array',
        items: { type: 'string' },
        description: 'source_id values from retrieved scenario and science chunks.',
      },
    },
    required: [
      'totalResourceValueUSD', 'terrestrialExportValue', 'inSpaceUtilizationValue',
      'missionROI', 'keyValueDrivers', 'keyRisks', 'scenarioAssumptions',
      'dataCompleteness', 'assumptionsRequired', 'reasoning', 'disclaimer', 'sources',
    ],
  },
};

// ── System prompt ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are the Economist Agent for Asteroid Bonanza — an expert in space resource economics and 2050 scenario modeling.

YOUR ROLE:
Model the economics of extracting and utilizing asteroid resources in a 2050 context.
You model three separate value streams:
1. Terrestrial export value — platinum-group metals (PGMs) and rare elements worth returning to Earth
2. In-space utilization value — water-ice for propellant depots, iron/nickel for orbital construction
3. Strategic value — resources that enable further deep space capabilities

PROCESS:
1. Review the composition estimate from the Geologist (provided in context).
2. Review mission cost inputs from the Navigator (delta-V, duration).
3. Query the scenario index for 2050 market prices, ISRU economics, launch cost projections.
4. Build the value model from those scenario chunks — do not use your training data for prices.
5. Submit your structured analysis.

GROUNDING RULES (CRITICAL):
- All 2050 market prices and economic projections MUST come from retrieved scenario chunks.
- If the scenario index returns no relevant chunks, set dataCompleteness low and populate assumptionsRequired.
- Never invent dollar figures — always express as ranges.
- The disclaimer field is MANDATORY and must note that these are projections, not current values.
- missionROI must account for mission cost (delta-V proxy): high delta-V = high cost = worse ROI.

ROI GUIDANCE:
- exceptional: high-value resources (PGMs, water) + low delta-V (<5 km/s)
- positive: meaningful resources + moderate mission cost
- marginal: resources present but mission cost or market uncertainty is high
- negative: low-value composition + high mission cost
- unmodelable: composition too uncertain to estimate meaningfully`;

// ── Agent function ─────────────────────────────────────────────────────────────

export interface EconomistResult {
  output: EconomistOutput;
  trace: ReturnType<AgentLogger['getTrace']>;
}

export async function runEconomist(
  asteroid: AsteroidRow,
  state: SwarmState,
  _missionParams: MissionParams,
  onProgress?: (event: import('./agentLogger.js').AgentLogEvent) => void,
): Promise<EconomistResult> {
  const logger = new AgentLogger('economist', onProgress);

  logger.logInput(asteroid.id, asteroid.name ?? asteroid.full_name ?? null, {
    spectral_type_smass: asteroid.spectral_type_smass,
    diameter_min_km: asteroid.diameter_min_km,
    diameter_max_km: asteroid.diameter_max_km,
    navigator_delta_v: state.navigatorOutput?.minDeltaV_kms,
    navigator_duration: state.navigatorOutput?.missionDurationDays,
    geologist_composition_confidence: state.geologistOutput?.compositionConfidence,
  });

  const apiKey = process.env['ANTHROPIC_API_KEY'];
  if (!apiKey) throw new AIServiceError('ANTHROPIC_API_KEY environment variable is not set');
  const client = new Anthropic({ apiKey, maxRetries: 5 });

  const userMessage = buildUserMessage(asteroid, state);
  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: userMessage }];
  const tools: Anthropic.Tool[] = [QUERY_SCENARIO_INDEX_TOOL, QUERY_SCIENCE_INDEX_TOOL, SUBMIT_TOOL];

  let submitInput: EconomistOutput | null = null;
  const MAX_TURNS = 8; // Economist may need more RAG iterations

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const response = await client.messages.create({
      model: SONNET,
      max_tokens: 3000,
      system: SYSTEM_PROMPT,
      tools,
      messages,
    });

    messages.push({ role: 'assistant', content: response.content });

    const submitBlock = response.content.find(
      (b): b is Anthropic.ToolUseBlock =>
        b.type === 'tool_use' && b.name === 'submit_economist_analysis',
    );

    if (submitBlock) {
      submitInput = submitBlock.input as EconomistOutput;
      break;
    }

    const toolUseBlocks = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
    );

    if (toolUseBlocks.length === 0) {
      messages.push({
        role: 'user',
        content: 'Please call submit_economist_analysis to complete your analysis.',
      });
      continue;
    }

    const toolResults = await Promise.all(
      toolUseBlocks.map(async (block) => {
        const t0 = Date.now();
        logger.logToolCall(block.name, block.input as Record<string, unknown>);

        let content: string;

        try {
          if (block.name === 'query_scenario_index') {
            const { result, rawChunks } = await queryScenarioIndex(
              block.input as { query: string; topK?: number },
            );
            logger.logRagLookup(
              (block.input as { query: string }).query,
              rawChunks,
              { science: 0, scenario: rawChunks.length },
              Date.now() - t0,
            );
            logger.logToolResult(block.name, true, `Retrieved ${rawChunks.length} scenario chunks`, Date.now() - t0);
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
            logger.logToolResult(block.name, true, `Retrieved ${rawChunks.length} science chunks`, Date.now() - t0);
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
    throw new AIServiceError('Economist agent did not call submit_economist_analysis within turn limit');
  }

  logger.logOutput(
    submitInput.dataCompleteness,
    submitInput.assumptionsRequired?.length ?? 0,
    submitInput.sources?.length ?? 0,
  );

  return { output: submitInput, trace: logger.getTrace() };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildUserMessage(asteroid: AsteroidRow, state: SwarmState): string {
  const name = asteroid.name ?? asteroid.full_name ?? asteroid.nasa_id;
  const geo = state.geologistOutput;
  const nav = state.navigatorOutput;

  const lines: string[] = [
    `## Asteroid: ${name}`,
    '',
    '### Physical Parameters',
    `- Diameter: ${asteroid.diameter_min_km != null ? `${asteroid.diameter_min_km}–${asteroid.diameter_max_km} km` : 'not available'}`,
    `- Spectral type: ${asteroid.spectral_type_smass ?? asteroid.spectral_type_tholen ?? 'unknown'}`,
    '',
  ];

  if (nav) {
    lines.push(
      '### Navigator Output (Mission Cost Inputs)',
      `- Accessibility rating: ${nav.accessibilityRating}`,
      `- Min delta-V: ${nav.minDeltaV_kms != null ? `${nav.minDeltaV_kms} km/s` : 'not available'}`,
      `- Min mission duration: ${nav.missionDurationDays != null ? `${nav.missionDurationDays} days` : 'not available'}`,
      '',
    );
  } else {
    lines.push('### Navigator Output: not available (assume unknown mission cost)', '');
  }

  if (geo) {
    lines.push(
      '### Geologist Output (Composition — your primary input)',
      `- Spectral class: ${geo.spectralClass}`,
      `- Composition confidence: ${geo.compositionConfidence}`,
      `- Water ice: ${geo.compositionEstimate.water_ice_pct.min}–${geo.compositionEstimate.water_ice_pct.max}%`,
      `- Carbonaceous: ${geo.compositionEstimate.carbonaceous_pct.min}–${geo.compositionEstimate.carbonaceous_pct.max}%`,
      `- Silicate: ${geo.compositionEstimate.silicate_pct.min}–${geo.compositionEstimate.silicate_pct.max}%`,
      `- Iron/nickel: ${geo.compositionEstimate.iron_nickel_pct.min}–${geo.compositionEstimate.iron_nickel_pct.max}%`,
      `- Platinum-group metals: ${geo.compositionEstimate.platinum_group_pct.min}–${geo.compositionEstimate.platinum_group_pct.max}%`,
      '',
      'Key resources identified by Geologist:',
      ...geo.keyResources.map((r) => `- ${r.resource}: ${r.significance}`),
      '',
      `Geologist reasoning: ${geo.reasoning}`,
      '',
    );
  } else {
    lines.push('### Geologist Output: not available — composition unknown. Set missionROI to "unmodelable".', '');
  }

  lines.push(
    'Please query the scenario index for 2050 economic projections relevant to this asteroid\'s ' +
    'composition, then submit your economic analysis.',
  );

  return lines.join('\n');
}
