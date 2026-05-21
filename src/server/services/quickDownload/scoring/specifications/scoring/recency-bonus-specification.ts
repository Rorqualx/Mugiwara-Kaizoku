/**
 * Recency Bonus Specification
 *
 * Awards bonus points for recently published releases.
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

const MS_PER_DAY = 1000 * 60 * 60 * 24;

export class RecencyBonusSpecification implements DownloadSpecification {
  readonly name = 'RecencyBonusSpecification';
  readonly rejectionType = RejectionType.PERMANENT;
  readonly priority = SpecificationPriority.SCORING;

  evaluate(
    result: ProwlarrSearchResult,
    criteria: QuickDownloadCriteria,
  ): SpecificationResult {
    if (!result.publishDate) {
      return { accepted: true, score: 0, breakdownKey: 'recencyBonus' };
    }

    const publishedDate = new Date(result.publishDate);
    const ageDays = (Date.now() - publishedDate.getTime()) / MS_PER_DAY;

    if (ageDays > criteria.maxAgeDays) {
      return { accepted: true, score: 0, breakdownKey: 'recencyBonus' };
    }

    let bonus = 0;

    if (ageDays < 30) {
      bonus = 20;
    } else if (ageDays < 90) {
      bonus = 10;
    } else if (ageDays < 365) {
      bonus = 5;
    }

    if (bonus > 0) {
      logger.debug(
        `[Scoring] Recency bonus (${Math.floor(ageDays)} days old): +${bonus}`,
      );
    }

    return {
      accepted: true,
      score: bonus,
      breakdownKey: 'recencyBonus',
    };
  }
}
