/**
 * Blocklist Rejection Specification
 *
 * Rejects releases that are on the blocklist when skipBlocklisted is enabled.
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

export class BlocklistSpecification implements DownloadSpecification {
  readonly name = 'BlocklistSpecification';
  readonly rejectionType = RejectionType.PERMANENT;
  readonly priority = SpecificationPriority.REJECTION;

  evaluate(
    result: ProwlarrSearchResult,
    criteria: QuickDownloadCriteria,
  ): SpecificationResult {
    if (criteria.skipBlocklisted && result.isBlocked) {
      logger.warn(`[Scoring] Blocklist rejection for ${result.title}`);
      return {
        accepted: false,
        score: -1000,
        breakdownKey: 'blocklistPenalty',
        reason: 'Release is blocklisted',
      };
    }

    return {
      accepted: true,
      score: 0,
      breakdownKey: 'blocklistPenalty',
    };
  }
}
