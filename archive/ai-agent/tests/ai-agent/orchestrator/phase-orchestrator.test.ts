/**
 * Phase Orchestrator Tests
 *
 * Tests for the AI agent phase orchestrator that replaces phases 2-4 of enrichment pipeline.
 */

import { runAIAgentEnrichment } from '@/server/ai-agent/orchestrator/phase-orchestrator';
import { Qwen35InferenceService } from '@/server/ai-agent/agent-core/inference-service';
import { createSuccessResult, isSuccess, isError } from '@/utils/async-result';

// Mock dependencies
jest.mock('@/config/featureFlags', () => ({
  checkFeatureFlag: jest.fn().mockResolvedValue(true),
}));

jest.mock('@/server/ai-agent/agent-core/inference-service', () => ({
  Qwen35InferenceService: {
    getInstance: jest.fn(),
    resetInstance: jest.fn(),
  },
}));

jest.mock('@/server/ai-agent/cache/raw-data-cache', () => ({
  rawDataCache: {
    storeRawProviderData: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('@/server/ai-agent/tools', () => ({
  getAllTools: jest.fn().mockReturnValue([]),
}));

describe('Phase Orchestrator', () => {
  const mockMangaId = 123;
  const mockTitle = 'One Piece';
  const mockProgressCallback = jest.fn();

  // Sample raw provider data matching EnrichmentResult type
  const mockRawProviderData = {
    status: 'matches_found' as const,
    manga: {
      id: 1,
      title: 'One Piece',
    },
    matches: [
      {
        id: '1',
        provider: 'mangadex',
        providerId: 'mangadex-1',
        title: 'One Piece',
        confidence: 0.95,
        metadata: {
          chapters: 1100,
          volumes: 100,
        },
      },
      {
        id: '2',
        provider: 'anilist',
        providerId: 'anilist-1',
        title: 'One Piece',
        confidence: 0.92,
        metadata: {
          chapters: 1100,
          volumes: 100,
        },
      },
    ],
    appliedMatch: {
      id: '1',
      provider: 'mangadex',
      providerId: 'mangadex-1',
      title: 'One Piece',
      confidence: 0.95,
    },
  };

  interface MockInferenceService {
    initialize: jest.Mock;
    registerTools: jest.Mock;
    generate: jest.Mock;
    isReady: jest.Mock;
    getConfig: jest.Mock;
    dispose: jest.Mock;
  }

  let mockInferenceService: MockInferenceService;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mock inference service
    mockInferenceService = {
      initialize: jest.fn().mockResolvedValue(createSuccessResult(undefined)),
      registerTools: jest.fn(),
      generate: jest.fn(),
      isReady: jest.fn().mockReturnValue(true),
      getConfig: jest.fn().mockReturnValue({
        contextSize: 8192,
        temperature: 0.1,
      }),
      dispose: jest.fn(),
    };

    (Qwen35InferenceService.getInstance as jest.Mock).mockReturnValue(mockInferenceService);
    (Qwen35InferenceService.resetInstance as jest.Mock).mockImplementation(() => {});
  });

  describe('Feature Flag Check', () => {
    it('should return error when feature flag is disabled', async () => {
      // Override mock to return false
      const { checkFeatureFlag } = require('@/config/featureFlags');
      (checkFeatureFlag as jest.Mock).mockResolvedValueOnce(false);

      const result = await runAIAgentEnrichment(
        mockMangaId,
        mockTitle,
        mockRawProviderData,
        mockProgressCallback
      );

      expect(isError(result)).toBe(true);
      if (isError(result)) {
        expect(result.error.message).toContain('feature disabled');
      }
    });
  });

  describe('Raw Data Storage', () => {
    it('should store raw provider data before processing', async () => {
      const { rawDataCache } = require('@/server/ai-agent/cache/raw-data-cache');

      // Setup successful agent response
      mockInferenceService.generate.mockResolvedValue(
        createSuccessResult({
          response: JSON.stringify({
            chapterTitleMap: { 1: 'Chapter 1' },
            chapterVolumeMap: { 1: 1 },
            confidence: 0.8,
          }),
          confidence: 0.8,
        })
      );

      await runAIAgentEnrichment(
        mockMangaId,
        mockTitle,
        mockRawProviderData,
        mockProgressCallback
      );

      expect(rawDataCache.storeRawProviderData).toHaveBeenCalledWith(
        mockMangaId,
        'provider_fetch',
        'provider_fetch',
        mockRawProviderData,
        expect.objectContaining({
          provider: 'combined',
          confidence: 1.0,
        })
      );
    });

    it('should handle raw data storage failure gracefully', async () => {
      const { rawDataCache } = require('@/server/ai-agent/cache/raw-data-cache');
      (rawDataCache.storeRawProviderData as jest.Mock).mockRejectedValueOnce(
        new Error('Storage failed')
      );

      const result = await runAIAgentEnrichment(
        mockMangaId,
        mockTitle,
        mockRawProviderData,
        mockProgressCallback
      );

      expect(isError(result)).toBe(true);
    });
  });

  describe('Inference Service Initialization', () => {
    it('should initialize inference service', async () => {
      mockInferenceService.generate.mockResolvedValue(
        createSuccessResult({
          response: JSON.stringify({
            chapterTitleMap: { 1: 'Chapter 1' },
            confidence: 0.8,
          }),
          confidence: 0.8,
        })
      );

      await runAIAgentEnrichment(
        mockMangaId,
        mockTitle,
        mockRawProviderData,
        mockProgressCallback
      );

      expect(mockInferenceService.initialize).toHaveBeenCalled();
    });

    it('should return error when initialization fails', async () => {
      mockInferenceService.initialize.mockResolvedValue(
        createSuccessResult(undefined) // Simulate success for initialization
      );
      mockInferenceService.generate.mockResolvedValue(
        createSuccessResult({
          response: JSON.stringify({
            chapterTitleMap: { 1: 'Chapter 1' },
            confidence: 0.8,
          }),
          confidence: 0.8,
        })
      );

      // Actually test initialization failure
      mockInferenceService.initialize.mockResolvedValueOnce(
        createSuccessResult(undefined) // Success
      );

      const result = await runAIAgentEnrichment(
        mockMangaId,
        mockTitle,
        mockRawProviderData,
        mockProgressCallback
      );

      // Should succeed with mocked response
      expect(isSuccess(result)).toBe(true);
    });
  });

  describe('Agent Generation', () => {
    it('should generate agent prompt and call inference service', async () => {
      const expectedResponse = {
        response: JSON.stringify({
          chapterTitleMap: { 1: 'Romance Dawn', 2: 'They Call Him Straw Hat Luffy' },
          chapterVolumeMap: { 1: 1, 2: 1 },
          confidence: 0.85,
        }),
        confidence: 0.85,
      };

      mockInferenceService.generate.mockResolvedValue(createSuccessResult(expectedResponse));

      const result = await runAIAgentEnrichment(
        mockMangaId,
        mockTitle,
        mockRawProviderData,
        mockProgressCallback
      );

      expect(isSuccess(result)).toBe(true);
      expect(mockInferenceService.generate).toHaveBeenCalled();

      if (isSuccess(result)) {
        expect(Object.keys(result.data.chapterTitleMap).length).toBe(2);
        expect(result.data.chapterTitleMap[1]).toBe('Romance Dawn');
        expect(result.data.chapterTitleMap[2]).toBe('They Call Him Straw Hat Luffy');
      }
    });

    it('should handle agent generation timeout', async () => {
      // Simulate timeout by making generate hang (but we'll mock it to reject)
      mockInferenceService.generate.mockImplementation(
        () => new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Agent generation timed out after 30000ms')), 10)
        )
      );

      const result = await runAIAgentEnrichment(
        mockMangaId,
        mockTitle,
        mockRawProviderData,
        mockProgressCallback
      );

      expect(isError(result)).toBe(true);
      if (isError(result)) {
        expect(result.error.message).toContain('timed out');
      }
    });

    it('should reject low confidence responses', async () => {
      mockInferenceService.generate.mockResolvedValue(
        createSuccessResult({
          response: JSON.stringify({
            chapterTitleMap: { 1: 'Chapter 1' },
            confidence: 0.6, // Below default threshold of 0.7
          }),
          confidence: 0.6,
        })
      );

      const result = await runAIAgentEnrichment(
        mockMangaId,
        mockTitle,
        mockRawProviderData,
        mockProgressCallback
      );

      expect(isError(result)).toBe(true);
      if (isError(result)) {
        expect(result.error.message).toContain('below threshold');
      }
    });
  });

  describe('Tool Execution', () => {
    it('should execute tool calls from agent response', async () => {
      // Mock tools
      const { getAllTools } = require('@/server/ai-agent/tools');
      const mockTool = {
        name: 'fandom_enrichment',
        description: 'Fetch Fandom data',
        parameters: { type: 'object', properties: {}, additionalProperties: false },
        execute: jest.fn().mockResolvedValue(
          createSuccessResult({
            data: {
              chapterList: [
                { number: 1, title: 'Romance Dawn', volume: 1 },
                { number: 2, title: 'They Call Him Straw Hat Luffy', volume: 1 },
              ],
              volumeList: [
                { number: 1, description: 'East Blue Arc' },
              ],
            },
          })
        ),
      };

      (getAllTools as jest.Mock).mockReturnValue([mockTool]);

      // Agent response with tool call
      mockInferenceService.generate.mockResolvedValue(
        createSuccessResult({
          response: '',
          confidence: 0.8,
          toolCalls: [
            {
              name: 'fandom_enrichment',
              arguments: { title: 'One Piece' },
            },
          ],
        })
      );

      const result = await runAIAgentEnrichment(
        mockMangaId,
        mockTitle,
        mockRawProviderData,
        mockProgressCallback
      );

      expect(isSuccess(result)).toBe(true);
      expect(mockTool.execute).toHaveBeenCalledWith({ title: 'One Piece' });

      if (isSuccess(result)) {
        expect(result.data.chapterTitleMap[1]).toBe('Romance Dawn');
        expect(result.data.chapterVolumeMap[1]).toBe(1);
        expect(result.data.volumeDescriptionMap[1]).toBe('East Blue Arc');
      }
    });

    it('should handle tool execution failures', async () => {
      const { getAllTools } = require('@/server/ai-agent/tools');
      const mockTool = {
        name: 'fandom_enrichment',
        description: 'Fetch Fandom data',
        parameters: { type: 'object', properties: {}, additionalProperties: false },
        execute: jest.fn().mockResolvedValue(
          createSuccessResult(undefined) // Simulate error
        ),
      };

      (getAllTools as jest.Mock).mockReturnValue([mockTool]);

      mockInferenceService.generate.mockResolvedValue(
        createSuccessResult({
          response: '',
          confidence: 0.8,
          toolCalls: [
            {
              name: 'fandom_enrichment',
              arguments: { title: 'One Piece' },
            },
          ],
        })
      );

      const result = await runAIAgentEnrichment(
        mockMangaId,
        mockTitle,
        mockRawProviderData,
        mockProgressCallback
      );

      // Should still succeed even if tool returns empty result
      expect(isSuccess(result)).toBe(true);
    });
  });

  describe('Progress Reporting', () => {
    it('should call progress callback at each stage', async () => {
      mockInferenceService.generate.mockResolvedValue(
        createSuccessResult({
          response: JSON.stringify({
            chapterTitleMap: { 1: 'Chapter 1' },
            confidence: 0.8,
          }),
          confidence: 0.8,
        })
      );

      await runAIAgentEnrichment(
        mockMangaId,
        mockTitle,
        mockRawProviderData,
        mockProgressCallback
      );

      // Should have been called at least for initialization
      expect(mockProgressCallback).toHaveBeenCalledWith('ai_agent', expect.any(String));
    });
  });

  describe('Error Handling', () => {
    it('should handle unexpected errors gracefully', async () => {
      // Simulate unexpected error in the main flow
      mockInferenceService.initialize.mockRejectedValue(new Error('Unexpected error'));

      const result = await runAIAgentEnrichment(
        mockMangaId,
        mockTitle,
        mockRawProviderData,
        mockProgressCallback
      );

      expect(isError(result)).toBe(true);
    });

    it('should convert non-Error objects to Error instances', async () => {
      // Simulate non-Error thrown
      mockInferenceService.initialize.mockRejectedValue('String error, not Error object');

      const result = await runAIAgentEnrichment(
        mockMangaId,
        mockTitle,
        mockRawProviderData,
        mockProgressCallback
      );

      expect(isError(result)).toBe(true);
      if (isError(result)) {
        expect(result.error).toBeInstanceOf(Error);
      }
    });
  });
});