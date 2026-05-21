/**
 * Seeders Bonus Specification
 *
 * Awards bonus points for torrent releases with healthy seeder counts.
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

export class SeedersBonusSpecification implements DownloadSpecification {
  readonly name = 'SeedersBonusSpecification';
  readonly rejectionType = RejectionType.PERMANENT;
  readonly priority = SpecificationPriority.SCORING;

  evaluate(
    result: ProwlarrSearchResult,
    criteria: QuickDownloadCriteria,
  ): SpecificationResult {
    const isTorrent = result.protocol.toLowerCase() === 'torrent';

    if (!isTorrent || result.seeders === undefined) {
      return { accepted: true, score: 0, breakdownKey: 'seedersBonus' };
    }

    if (result.seeders >= criteria.minSeeders) {
      const bonus = Math.min(
        result.seeders * criteria.seedersWeight,
        100,
      );

      logger.debug(
        `[Scoring] Seeders bonus (${result.seeders} seeders): +${bonus}`,
      );

      return {
        accepted: true,
        score: bonus,
        breakdownKey: 'seedersBonus',
      };
    }

    return { accepted: true, score: 0, breakdownKey: 'seedersBonus' };
  }
}
