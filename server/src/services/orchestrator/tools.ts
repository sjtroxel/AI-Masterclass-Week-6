/**
 * tools.ts
 *
 * Shared tool implementations for the agent swarm.
 *
 * Each function here is the real implementation behind an Anthropic tool_use
 * tool definition. When Claude calls a tool by name, the orchestration layer
 * dispatches to these functions and sends the result back in the next turn.
 *
 * Tool definitions (JSON Schema for Claude) are exported alongside the
 * implementations so agent files stay self-contained.
 */

import Anthropic from '@anthropic-ai/sdk';
import { NHATSService } from '../nasaApi/NHATSService.js';
import { CADService } from '../nasaApi/CADService.js';
import { queryRag } from '../ragService.js';
import type { RagResult } from '../../../../shared/types.js';

// ── NHATS data ────────────────────────────────────────────────────────────────

export interface FetchNHATSInput {
  designation: string;
}

export interface FetchNHATSResult {
  found: boolean;
  designation: string;
  minDeltaV_kms: number | null;
  minDurationDays: number | null;
}

export async function fetchNHATSData(input: FetchNHATSInput): Promise<FetchNHATSResult> {
  const nhats = new NHATSService();
  const result = await nhats.getByDesignation(input.designation);
  if (!result) {
    return { found: false, designation: input.designation, minDeltaV_kms: null, minDurationDays: null };
  }
  return {
    found: true,
    designation: result.designation,
    minDeltaV_kms: result.minDeltaVKms,
    minDurationDays: result.minDurationDays,
  };
}

export const FETCH_NHATS_TOOL: Anthropic.Tool = {
  name: 'fetch_nhats_data',
  description:
    'Fetch JPL NHATS accessibility data for an asteroid by its designation. ' +
    'Returns minimum delta-V (km/s) and minimum mission duration (days) from ' +
    'JPL\'s pre-computed human-accessible NEO database. Returns found=false if ' +
    'the asteroid is not in the NHATS catalog (i.e., not considered accessible).',
  input_schema: {
    type: 'object' as const,
    properties: {
      designation: {
        type: 'string',
        description: 'The asteroid designation (e.g. "2021 PDC", "99942"). Use the designation field from the asteroid record.',
      },
    },
    required: ['designation'],
  },
};

// ── Close approaches ──────────────────────────────────────────────────────────

export interface FetchCloseApproachesInput {
  designation: string;
}

export interface FetchCloseApproachesResult {
  designation: string;
  nextApproach: { date: string; distanceAu: number; distanceKm: number } | null;
  closestApproach: { date: string; distanceAu: number; distanceKm: number } | null;
}

export async function fetchCloseApproaches(
  input: FetchCloseApproachesInput,
): Promise<FetchCloseApproachesResult> {
  const cad = new CADService();
  const summary = await cad.getSummaryByDesignation(input.designation);
  return {
    designation: summary.designation,
    nextApproach: summary.nextApproach,
    closestApproach: summary.closestApproach,
  };
}

export const FETCH_CLOSE_APPROACHES_TOOL: Anthropic.Tool = {
  name: 'fetch_close_approaches',
  description:
    'Fetch upcoming and closest close approach data for an asteroid from JPL\'s ' +
    'Close Approach Database (CAD). Returns the next future close approach and the ' +
    'historically closest approach on record, both with date and distance in AU and km.',
  input_schema: {
    type: 'object' as const,
    properties: {
      designation: {
        type: 'string',
        description: 'The asteroid designation (e.g. "2021 PDC", "99942").',
      },
    },
    required: ['designation'],
  },
};

// ── RAG: science index ────────────────────────────────────────────────────────

export interface QueryScienceIndexInput {
  query: string;
  topK?: number;
}

export interface QueryIndexResult {
  chunks: Array<{
    sourceId: string;
    sourceTitle: string;
    sourceYear: number;
    content: string;
    similarity: number;
  }>;
}

export async function queryScienceIndex(
  input: QueryScienceIndexInput,
): Promise<{ result: QueryIndexResult; rawChunks: RagResult[] }> {
  const { results } = await queryRag(input.query, {
    topK: input.topK ?? 5,
    threshold: 0.3,
  });
  const scienceChunks = results.filter((r) => r.source_type === 'science');
  return {
    rawChunks: scienceChunks,
    result: {
      chunks: scienceChunks.map((c) => ({
        sourceId: c.source_id,
        sourceTitle: c.source_title,
        sourceYear: c.source_year,
        content: c.content,
        similarity: c.similarity,
      })),
    },
  };
}

export const QUERY_SCIENCE_INDEX_TOOL: Anthropic.Tool = {
  name: 'query_science_index',
  description:
    'Search the science knowledge base for grounding information. Contains peer-reviewed ' +
    'asteroid science: spectral classification surveys, mission reports (OSIRIS-REx, Psyche, ' +
    'DART/HERA), planetary defense data, and JPL technical documentation. Use this to ' +
    'ground your analysis in published facts rather than training-data assumptions.',
  input_schema: {
    type: 'object' as const,
    properties: {
      query: {
        type: 'string',
        description: 'Natural language search query. Be specific — e.g. "C-type asteroid water ice content" or "Torino scale hazard definitions".',
      },
      topK: {
        type: 'number',
        description: 'Max results to return per index (default 5, max 10).',
      },
    },
    required: ['query'],
  },
};

// ── RAG: scenario index ───────────────────────────────────────────────────────

export interface QueryScenarioIndexInput {
  query: string;
  topK?: number;
}

export async function queryScenarioIndex(
  input: QueryScenarioIndexInput,
): Promise<{ result: QueryIndexResult; rawChunks: RagResult[] }> {
  const { results } = await queryRag(input.query, {
    topK: input.topK ?? 5,
    threshold: 0.3,
  });
  const scenarioChunks = results.filter((r) => r.source_type === 'scenario');
  return {
    rawChunks: scenarioChunks,
    result: {
      chunks: scenarioChunks.map((c) => ({
        sourceId: c.source_id,
        sourceTitle: c.source_title,
        sourceYear: c.source_year,
        content: c.content,
        similarity: c.similarity,
      })),
    },
  };
}

export const QUERY_SCENARIO_INDEX_TOOL: Anthropic.Tool = {
  name: 'query_scenario_index',
  description:
    'Search the 2050 scenario knowledge base for economic projections and strategic context. ' +
    'Contains NASA Vision 2050, ISRU technology roadmaps, space economy reports, and ' +
    'asteroid mining economic analyses. All content is forward-looking — label it as a ' +
    '2050 projection, not an established fact.',
  input_schema: {
    type: 'object' as const,
    properties: {
      query: {
        type: 'string',
        description: 'Natural language search query, e.g. "asteroid mining platinum group metals 2050 market value".',
      },
      topK: {
        type: 'number',
        description: 'Max results to return (default 5, max 10).',
      },
    },
    required: ['query'],
  },
};
