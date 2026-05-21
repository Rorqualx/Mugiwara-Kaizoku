/**
 * Official Release Bonus Specification
 *
 * Awards bonus points for official publisher releases when preferred.
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

export class OfficialBonusSpecification implements DownloadSpecification {
  readonly name = 'OfficialBonusSpecification';
  readonly rejectionType = RejectionType.PERMANENT;
  readonly priority = SpecificationPriority.SCORING;

  evaluate(
    result: ProwlarrSearchResult,
    criteria: QuickDownloadCriteria,
  ): SpecificationResult {
    if (criteria.preferOfficial && result.isOfficial) {
      logger.debug(
        `[Scoring] Official release bonus: +50 for ${result.title}`,
      );
      return {
        accepted: true,
        score: 50,
        breakdownKey: 'officialBonus',
      };
    }

    return { accepted: true, score: 0, breakdownKey: 'officialBonus' };
  }
}
