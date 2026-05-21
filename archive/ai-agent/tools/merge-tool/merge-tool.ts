/**
 * Merge Tool
 *
 * Wraps metadata merging utilities for AI agent tool calling.
 * Provides intelligent merging of manga metadata from multiple providers.
 * Supports both chapter-level merging and metadata field merging.
 */

import type { AgentTool } from '@/server/ai-agent/agent-core/types';
import type { AsyncResult } from '@/utils/async-result';
import { createErrorResult, isError, isSuccess } from '@/utils/async-result';
import { logger } from '@/utils/logger';

import { executeMerge } from './merge-tool-executors';
import { validateParams } from './merge-tool-param-validators';

const log = logger.child('MergeTool');

/**
 * Merge tool
 */
export const mergeTool: AgentTool = {
  name: 'merge',
  description: 'Merge manga metadata from multiple providers. Supports intelligent merging (automatic provider selection), selected providers (field-level mapping), and chapter-level merging. Returns merged metadata with provenance information.',
  parameters: {
    type: 'object',
    properties: {
      mergeType: {
        type: 'string',
        description: 'Type of merge to perform: intelligent (automatic provider selection), selected (field->provider mapping), or chapters (chapter-level merging)',
      },
      mangaId: {
        type: 'number',
        description: 'Manga ID to merge metadata for',
      },
      availableProviders: {
        type: 'array',
        description: 'Available providers for intelligent merge (e.g., ["anilist", "comicvine", "mangadex"])',
        items: { type: 'string' },
      },
      selectedProviders: {
        type: 'object',
        description: 'Selected providers mapping for field-level merging (e.g., { "title": "anilist", "description": "wikipedia" })',
        additionalProperties: { type: 'string' },
      },
      userPreferences: {
        type: 'object',
        description: 'User preferences for provider priorities in intelligent merge',
        additionalProperties: true,
      },
      providerChapters: {
        type: 'array',
        description: 'Provider chapters data for chapter-level merging',
        items: { type: 'object' },
      },
      forceRefresh: {
        type: 'boolean',
        description: 'Force refresh from APIs (default: false)',
      },
    },
    additionalProperties: false,
  } as const,
  async execute(params: unknown): Promise<AsyncResult<unknown, Error>> {
    // Validate parameters
    const validationResult = validateParams(params);
    if (isError(validationResult)) {
      log.error('Parameter validation failed', { error: validationResult.error });
      return validationResult;
    }
    if (!isSuccess(validationResult)) {
      return createErrorResult(new Error(`Validation result in unexpected state: ${validationResult.status}`));
    }

    // Execute merge
    return executeMerge(validationResult.data);
  },
};

// Re-export types and functions for convenience
export type { MergeToolParams, ProviderChapter } from './merge-tool-types';
export { validateParams } from './merge-tool-param-validators';
export { executeMerge } from './merge-tool-executors';
export {
  validateMergeType,
  validateMangaId,
  validateAvailableProviders,
  validateSelectedProviders,
  validateUserPreferences,
  validateProviderChapters,
  validateForceRefresh,
} from './merge-tool-validators';
export {
  calculateChaptersByVolume,
  countTitlesWithMetadata,
  countUniqueVolumes,
} from './merge-tool-helpers';
export {
  validateIntelligentMergeParams,
  validateSelectedMergeParams,
  validateChaptersMergeParams,
} from './merge-tool-param-validators';