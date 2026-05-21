/**
 * Validation Tool (Main)
 *
 * Main validation tool definition.
 */

import type { AgentTool } from '@/server/ai-agent/agent-core/types';
import type { AsyncResult } from '@/utils/async-result';
import { createErrorResult, isError, isSuccess } from '@/utils/async-result';
import { logger } from '@/utils/logger';

import { executeValidation } from './validation-executor';
import { validateParams } from './validation-params-validator';

import type { ValidationToolParams } from './validation-tool-types';


const log = logger.child('ValidationTool');

/**
 * Validation tool
 */
export const validationTool: AgentTool = {
  name: 'validation',
  description: 'Validate manga metadata quality. Supports: provider_match (title similarity), chapter_title (content validity), volume_map (chapter-to-volume mapping), data_quality (audit results). Returns validation results with issues and fixes.',
  parameters: {
    type: 'object',
    properties: {
      validationType: {
        type: 'string',
        description: 'Type of validation to perform: provider_match, chapter_title, volume_map, or data_quality',
      },
      data: {
        type: 'object',
        description: 'Data to validate (depends on validationType). For provider_match: [title1, title2]; chapter_title: string; volume_map: Record<number, number>; data_quality: { unlinkedChapterCount?, volumeRanges? }',
        additionalProperties: true,
      },
      threshold: {
        type: 'number',
        description: 'Optional similarity threshold for provider_match (default: 0.3)',
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

    // TypeScript should know validationResult.data is ValidationToolParams here
    const validationParams = validationResult.data as ValidationToolParams;

    // Execute validation
    return executeValidation(validationParams);
  },
};

// Re-exports for convenience
export type { ValidationToolParams } from './validation-tool-types';
export { validateParams } from './validation-params-validator';
export { executeValidation } from './validation-executor';
export {
  validateProviderMatch,
  isValidChapterTitle,
  fixOffByOneChapterVolumeMap,
  findMissingChapters,
  checkVolumeConsistency,
  validateAndFixChapterVolumeMap,
  checkUnlinkedChapters,
  checkOverlappingRanges,
  validateDataQuality,
} from './validation-helpers';
export {
  validateProviderMatchData,
  validateChapterTitleData,
  validateVolumeMapData,
  validateDataQualityData,
} from './validation-data-handlers';