import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock external dependencies before importing tools
vi.mock('../../src/services/nasaApi/NHATSService.js', () => ({
  NHATSService: vi.fn().mockImplementation(() => ({
    getByDesignation: vi.fn(),
  })),
}));

vi.mock('../../src/services/nasaApi/CADService.js', () => ({
  CADService: vi.fn().mockImplementation(() => ({
    getSummaryByDesignation: vi.fn(),
  })),
}));

vi.mock('../../src/services/ragService.js', () => ({
  queryRag: vi.fn(),
}));

import { NHATSService } from '../../src/services/nasaApi/NHATSService.js';
import { CADService } from '../../src/services/nasaApi/CADService.js';
import { queryRag } from '../../src/services/ragService.js';
import {
  fetchNHATSData,
  fetchCloseApproaches,
  queryScienceIndex,
  queryScenarioIndex,
} from '../../src/services/orchestrator/tools.js';
import type { RagResult } from '../../../shared/types.js';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const SCIENCE_CHUNK: RagResult = {
  id: 'chunk-sci-001',
  source_id: 'nasa-osiris-rex-2021',
  source_title: 'OSIRIS-REx Mission Report 2021',
  source_year: 2021,
  content: 'Bennu has a rubble-pile structure with a bulk density of 1.19 g/cm³.',
  similarity: 0.88,
  source_type: 'science',
};

const SCENARIO_CHUNK: RagResult = {
  id: 'chunk-scen-001',
  source_id: 'nasa-vision-2050',
  source_title: 'NASA Vision 2050',
  source_year: 2020,
  content: 'By 2050, asteroid mining could supply platinum group metals to LEO depots.',
  similarity: 0.82,
  source_type: 'scenario',
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('tools', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  // ── fetchNHATSData ───────────────────────────────────────────────────────────

  describe('fetchNHATSData', () => {
    it('returns found=true with delta-V and duration when asteroid is in NHATS', async () => {
      const getByDesignation = vi.fn().mockResolvedValue({
        designation: '433',
        minDeltaVKms: 5.31,
        minDurationDays: 370,
      });
      vi.mocked(NHATSService).mockImplementation(() => ({ getByDesignation } as never));

      const result = await fetchNHATSData({ designation: '433' });

      expect(result.found).toBe(true);
      expect(result.designation).toBe('433');
      expect(result.minDeltaV_kms).toBe(5.31);
      expect(result.minDurationDays).toBe(370);
    });

    it('returns found=false with null fields when asteroid is not in NHATS', async () => {
      const getByDesignation = vi.fn().mockResolvedValue(null);
      vi.mocked(NHATSService).mockImplementation(() => ({ getByDesignation } as never));

      const result = await fetchNHATSData({ designation: '99999' });

      expect(result.found).toBe(false);
      expect(result.designation).toBe('99999');
      expect(result.minDeltaV_kms).toBeNull();
      expect(result.minDurationDays).toBeNull();
    });
  });

  // ── fetchCloseApproaches ─────────────────────────────────────────────────────

  describe('fetchCloseApproaches', () => {
    it('returns next and closest approach data', async () => {
      const getSummaryByDesignation = vi.fn().mockResolvedValue({
        designation: '433',
        nextApproach: { date: '2056-01-14', distanceAu: 0.35, distanceKm: 52_000_000 },
        closestApproach: { date: '2056-01-14', distanceAu: 0.35, distanceKm: 52_000_000 },
      });
      vi.mocked(CADService).mockImplementation(() => ({ getSummaryByDesignation } as never));

      const result = await fetchCloseApproaches({ designation: '433' });

      expect(result.designation).toBe('433');
      expect(result.nextApproach?.date).toBe('2056-01-14');
      expect(result.nextApproach?.distanceAu).toBe(0.35);
      expect(result.closestApproach?.distanceKm).toBe(52_000_000);
    });

    it('returns null approach fields when no data is available', async () => {
      const getSummaryByDesignation = vi.fn().mockResolvedValue({
        designation: '99999',
        nextApproach: null,
        closestApproach: null,
      });
      vi.mocked(CADService).mockImplementation(() => ({ getSummaryByDesignation } as never));

      const result = await fetchCloseApproaches({ designation: '99999' });

      expect(result.nextApproach).toBeNull();
      expect(result.closestApproach).toBeNull();
    });
  });

  // ── queryScienceIndex ────────────────────────────────────────────────────────

  describe('queryScienceIndex', () => {
    it('returns only science-type chunks from the RAG index', async () => {
      vi.mocked(queryRag).mockResolvedValue({
        results: [SCIENCE_CHUNK, SCENARIO_CHUNK],
        query: 'rubble pile density',
        counts: { science: 1, scenario: 1 },
      });

      const result = await queryScienceIndex({ query: 'rubble pile density' });

      expect(result.result.chunks).toHaveLength(1);
      expect(result.result.chunks[0]?.sourceId).toBe('nasa-osiris-rex-2021');
      expect(result.result.chunks[0]?.content).toContain('Bennu');
      expect(result.rawChunks).toHaveLength(1);
      expect(result.rawChunks[0]?.source_type).toBe('science');
    });

    it('returns empty chunks when no science results exist', async () => {
      vi.mocked(queryRag).mockResolvedValue({
        results: [SCENARIO_CHUNK],
        query: 'future mining',
        counts: { science: 0, scenario: 1 },
      });

      const result = await queryScienceIndex({ query: 'future mining' });

      expect(result.result.chunks).toHaveLength(0);
      expect(result.rawChunks).toHaveLength(0);
    });

    it('passes topK to queryRag', async () => {
      vi.mocked(queryRag).mockResolvedValue({ results: [], query: 'test', counts: { science: 0, scenario: 0 } });

      await queryScienceIndex({ query: 'composition', topK: 8 });

      expect(queryRag).toHaveBeenCalledWith('composition', { topK: 8, threshold: 0.3 });
    });

    it('defaults topK to 5 when not specified', async () => {
      vi.mocked(queryRag).mockResolvedValue({ results: [], query: 'test', counts: { science: 0, scenario: 0 } });

      await queryScienceIndex({ query: 'density' });

      expect(queryRag).toHaveBeenCalledWith('density', { topK: 5, threshold: 0.3 });
    });

    it('maps chunk fields correctly', async () => {
      vi.mocked(queryRag).mockResolvedValue({
        results: [SCIENCE_CHUNK],
        query: 'test',
        counts: { science: 1, scenario: 0 },
      });

      const result = await queryScienceIndex({ query: 'test' });
      const chunk = result.result.chunks[0];

      expect(chunk?.sourceId).toBe('nasa-osiris-rex-2021');
      expect(chunk?.sourceTitle).toBe('OSIRIS-REx Mission Report 2021');
      expect(chunk?.sourceYear).toBe(2021);
      expect(chunk?.similarity).toBe(0.88);
    });
  });

  // ── queryScenarioIndex ───────────────────────────────────────────────────────

  describe('queryScenarioIndex', () => {
    it('returns only scenario-type chunks from the RAG index', async () => {
      vi.mocked(queryRag).mockResolvedValue({
        results: [SCIENCE_CHUNK, SCENARIO_CHUNK],
        query: 'asteroid mining 2050',
        counts: { science: 1, scenario: 1 },
      });

      const result = await queryScenarioIndex({ query: 'asteroid mining 2050' });

      expect(result.result.chunks).toHaveLength(1);
      expect(result.result.chunks[0]?.sourceId).toBe('nasa-vision-2050');
      expect(result.result.chunks[0]?.content).toContain('By 2050');
      expect(result.rawChunks[0]?.source_type).toBe('scenario');
    });

    it('returns empty chunks when no scenario results exist', async () => {
      vi.mocked(queryRag).mockResolvedValue({
        results: [SCIENCE_CHUNK],
        query: 'composition',
        counts: { science: 1, scenario: 0 },
      });

      const result = await queryScenarioIndex({ query: 'composition' });

      expect(result.result.chunks).toHaveLength(0);
    });

    it('passes topK to queryRag', async () => {
      vi.mocked(queryRag).mockResolvedValue({ results: [], query: 'test', counts: { science: 0, scenario: 0 } });

      await queryScenarioIndex({ query: 'platinum market', topK: 10 });

      expect(queryRag).toHaveBeenCalledWith('platinum market', { topK: 10, threshold: 0.3 });
    });

    it('defaults topK to 5 when not specified', async () => {
      vi.mocked(queryRag).mockResolvedValue({ results: [], query: 'test', counts: { science: 0, scenario: 0 } });

      await queryScenarioIndex({ query: 'ISRU roadmap' });

      expect(queryRag).toHaveBeenCalledWith('ISRU roadmap', { topK: 5, threshold: 0.3 });
    });
  });
});
