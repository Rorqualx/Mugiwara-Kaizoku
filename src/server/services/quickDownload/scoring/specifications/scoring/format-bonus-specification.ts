/**
 * Format Bonus Specification
 *
 * Awards bonus points for releases matching the user's preferred formats.
 * Higher-priority formats receive a larger bonus.
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

export class FormatBonusSpecification implements DownloadSpecification {
  readonly name = 'FormatBonusSpecification';
  readonly rejectionType = RejectionType.PERMANENT;
  readonly priority = SpecificationPriority.SCORING;

  evaluate(
    result: ProwlarrSearchResult,
    criteria: QuickDownloadCriteria,
  ): SpecificationResult {
    if (!result.format) {
      return { accepted: true, score: 0, breakdownKey: 'formatBonus' };
    }

    const formatIndex = criteria.preferredFormats.indexOf(result.format);

    if (formatIndex === -1) {
      return { accepted: true, score: 0, breakdownKey: 'formatBonus' };
    }

    // First format gets highest bonus (100), each subsequent format gets 20 less
    const bonus = 100 - formatIndex * 20;

    logger.debug(
      `[Scoring] Format bonus for ${result.format}: +${bonus}`,
    );

    return {
      accepted: true,
      score: bonus,
      breakdownKey: 'formatBonus',
    };
  }
}
