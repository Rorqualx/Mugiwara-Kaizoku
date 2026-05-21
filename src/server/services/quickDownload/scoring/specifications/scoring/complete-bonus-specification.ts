/**
 * Complete Collection Bonus Specification
 *
 * Awards bonus points for releases tagged as "Complete".
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

export class CompleteBonusSpecification implements DownloadSpecification {
  readonly name = 'CompleteBonusSpecification';
  readonly rejectionType = RejectionType.PERMANENT;
  readonly priority = SpecificationPriority.SCORING;

  evaluate(
    result: ProwlarrSearchResult,
    criteria: QuickDownloadCriteria,
  ): SpecificationResult {
    if (criteria.preferComplete && result.tags?.includes('Complete')) {
      logger.debug(
        `[Scoring] Complete collection bonus: +30 for ${result.title}`,
      );
      return {
        accepted: true,
        score: 30,
        breakdownKey: 'completeBonus',
      };
    }

    return { accepted: true, score: 0, breakdownKey: 'completeBonus' };
  }
}
