/**
 * Base Score Specification
 *
 * Uses Prowlarr's built-in relevance score as the baseline.
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

export class BaseScoreSpecification implements DownloadSpecification {
  readonly name = 'BaseScoreSpecification';
  readonly rejectionType = RejectionType.PERMANENT;
  readonly priority = SpecificationPriority.SCORING;

  evaluate(
    result: ProwlarrSearchResult,
    _criteria: QuickDownloadCriteria,
  ): SpecificationResult {
    const score = result.score ?? 0;

    return {
      accepted: true,
      score,
      breakdownKey: 'baseScore',
    };
  }
}
