/**
 * Size Bounds Validation Specification
 *
 * Applies score penalties for files that are suspiciously small or large.
 */

import type {
  DownloadSpecification,
  SpecificationResult,
} from '@/server/services/quickDownload/scoring/types';
import {
  RejectionType,
  SpecificationPriority,
} from '@/server/services/quickDownload/scoring/types';
import type { ProwlarrSearchResult } from '@/types/prowlarr';
import type { QuickDownloadCriteria } from '@/types/quickDownload.types';
import logger from '@/utils/serverLogger';

export class SizeBoundsSpecification implements DownloadSpecification {
  readonly name = 'SizeBoundsSpecification';
  readonly rejectionType = RejectionType.PERMANENT;
  readonly priority = SpecificationPriority.VALIDATION;

  evaluate(
    result: ProwlarrSearchResult,
    criteria: QuickDownloadCriteria,
  ): SpecificationResult {
    const sizeMB = result.size / (1024 * 1024);

    if (sizeMB < criteria.minSizeMB) {
      logger.debug(
        `[Scoring] Too small penalty (${sizeMB.toFixed(2)} MB) for ${result.title}`,
      );
      return {
        accepted: true,
        score: -50,
        breakdownKey: 'sizePenalty',
        reason: `File too small: ${sizeMB.toFixed(2)} MB`,
      };
    }

    if (sizeMB > criteria.maxSizeMB) {
      logger.debug(
        `[Scoring] Too large penalty (${sizeMB.toFixed(2)} MB) for ${result.title}`,
      );
      return {
        accepted: true,
        score: -20,
        breakdownKey: 'sizePenalty',
        reason: `File too large: ${sizeMB.toFixed(2)} MB`,
      };
    }

    return {
      accepted: true,
      score: 0,
      breakdownKey: 'sizePenalty',
    };
  }
}
