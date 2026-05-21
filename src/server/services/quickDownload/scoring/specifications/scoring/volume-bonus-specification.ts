/**
 * Volume Pack Bonus Specification
 *
 * Awards bonus points for releases with volume indicators in the title.
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

/** Pattern to match "v01", "v1", " v12" etc. */
const VOLUME_NUMBER_RE = /\sv\d+/;

export class VolumeBonusSpecification implements DownloadSpecification {
  readonly name = 'VolumeBonusSpecification';
  readonly rejectionType = RejectionType.PERMANENT;
  readonly priority = SpecificationPriority.SCORING;

  evaluate(
    result: ProwlarrSearchResult,
    _criteria: QuickDownloadCriteria,
  ): SpecificationResult {
    if (!result.title) {
      return { accepted: true, score: 0, breakdownKey: 'volumeBonus' };
    }

    const titleLower = result.title.toLowerCase();

    const hasVolumeIndicator =
      titleLower.includes('volume') ||
      titleLower.includes(' vol ') ||
      titleLower.includes(' vol.') ||
      VOLUME_NUMBER_RE.test(titleLower) ||
      titleLower.includes('volume pack') ||
      titleLower.includes('complete volume');

    if (hasVolumeIndicator) {
      logger.debug(
        `[Scoring] Volume pack bonus: +40 for ${result.title}`,
      );
      return {
        accepted: true,
        score: 40,
        breakdownKey: 'volumeBonus',
      };
    }

    return { accepted: true, score: 0, breakdownKey: 'volumeBonus' };
  }
}
