/**
 * Validation Executor
 *
 * Main execution function for the validation tool.
 */

import { createSuccessResult, createErrorResult, isError, isSuccess } from '@/utils/async-result';
import type { AsyncResult } from '@/utils/async-result';
import { logger } from '@/utils/logger';

import {
  validateProviderMatchData,
  validateChapterTitleData,
  validateVolumeMapData,
  validateDataQualityData,
} from './validation-data-handlers';

import type { ValidationToolParams } from './validation-tool-types';

const log = logger.child('ValidationTool');

/**
 * Execute validation
 */
export async function executeValidation(params: ValidationToolParams): Promise<AsyncResult<unknown, Error>> {
  const { validationType, data, threshold } = params;

  log.info('Executing validation', { validationType });

  try {
    await Promise.resolve(); // Satisfy eslint require-await rule
    let result: AsyncResult<Record<string, unknown>, Error>;

    switch (validationType) {
      case 'provider_match':
        result = validateProviderMatchData(data, threshold ?? 0.3);
        break;

      case 'chapter_title':
        result = validateChapterTitleData(data);
        break;

      case 'volume_map':
        result = validateVolumeMapData(data);
        break;

      case 'data_quality':
        result = validateDataQualityData(data);
        break;

      default:
        return createErrorResult(new Error(`Unknown validation type: ${validationType}`));
    }

    if (isError(result)) {
      return createErrorResult(result.error);
    }
    if (!isSuccess(result)) {
      return createErrorResult(new Error(`Validation result in unexpected state: ${result.status}`));
    }

    log.debug('Validation completed', { validationType, result: 'success' });

    return createSuccessResult(result.data);
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    log.error('Validation failed', { error: err, validationType });
    return createErrorResult(err);
  }
}