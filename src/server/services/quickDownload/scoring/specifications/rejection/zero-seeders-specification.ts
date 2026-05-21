/**
 * Zero Seeders Rejection Specification
 *
 * Rejects torrent releases with zero seeders (temporarily — seeders may appear later).
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

export class ZeroSeedersSpecification implements DownloadSpecification {
  readonly name = 'ZeroSeedersSpecification';
  readonly rejectionType = RejectionType.TEMPORARY;
  readonly priority = SpecificationPriority.REJECTION;

  evaluate(
    result: ProwlarrSearchResult,
    _criteria: QuickDownloadCriteria,
  ): SpecificationResult {
    const isTorrent = result.protocol.toLowerCase() === 'torrent';

    if (isTorrent && result.seeders === 0) {
      logger.debug(`[Scoring] Zero seeders rejection for ${result.title}`);
      return {
        accepted: false,
        score: 0,
        breakdownKey: 'seedersBonus',
        reason: 'Torrent has zero seeders',
      };
    }

    return {
      accepted: true,
      score: 0,
      breakdownKey: 'seedersBonus',
    };
  }
}
