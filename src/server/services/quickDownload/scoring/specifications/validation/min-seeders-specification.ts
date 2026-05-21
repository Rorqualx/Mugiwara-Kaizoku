/**
 * Minimum Seeders Validation Specification
 *
 * Applies a score penalty for torrents below the minimum seeder threshold
 * (but above zero — zero seeders are handled by the rejection spec).
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

export class MinSeedersSpecification implements DownloadSpecification {
  readonly name = 'MinSeedersSpecification';
  readonly rejectionType = RejectionType.TEMPORARY;
  readonly priority = SpecificationPriority.VALIDATION;

  evaluate(
    result: ProwlarrSearchResult,
    criteria: QuickDownloadCriteria,
  ): SpecificationResult {
    const isTorrent = result.protocol.toLowerCase() === 'torrent';

    if (!isTorrent || result.seeders === undefined) {
      return { accepted: true, score: 0, breakdownKey: 'seedersBonus' };
    }

    // Zero seeders are handled by ZeroSeedersSpecification (Rejection priority)
    if (result.seeders > 0 && result.seeders < criteria.minSeeders) {
      logger.debug(
        `[Scoring] Below min seeders penalty (${result.seeders} < ${criteria.minSeeders}) for ${result.title}`,
      );
      return {
        accepted: true,
        score: -50,
        breakdownKey: 'seedersBonus',
        reason: `Below minimum seeders: ${result.seeders}/${criteria.minSeeders}`,
      };
    }

    return { accepted: true, score: 0, breakdownKey: 'seedersBonus' };
  }
}
