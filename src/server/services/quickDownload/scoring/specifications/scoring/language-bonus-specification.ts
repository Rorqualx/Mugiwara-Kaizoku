/**
 * Language Bonus Specification
 *
 * Awards bonus points for releases matching the user's preferred languages.
 * Higher-priority languages receive a larger bonus.
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

export class LanguageBonusSpecification implements DownloadSpecification {
  readonly name = 'LanguageBonusSpecification';
  readonly rejectionType = RejectionType.PERMANENT;
  readonly priority = SpecificationPriority.SCORING;

  evaluate(
    result: ProwlarrSearchResult,
    criteria: QuickDownloadCriteria,
  ): SpecificationResult {
    if (criteria.preferredLanguages.length === 0) {
      return { accepted: true, score: 0, breakdownKey: 'languageBonus' };
    }

    const resultLanguages = [
      result.audioLanguage,
      ...(result.languages ?? []),
    ].filter(Boolean) as string[];

    for (let i = 0; i < criteria.preferredLanguages.length; i++) {
      const preferredLang = criteria.preferredLanguages[i];
      const matched = resultLanguages.some(
        lang => lang.toLowerCase() === preferredLang?.toLowerCase(),
      );

      if (matched) {
        // First preferred language gets highest bonus (30), each subsequent 10 less
        const bonus = 30 - i * 10;

        logger.debug(
          `[Scoring] Language bonus for ${preferredLang}: +${bonus}`,
        );

        return {
          accepted: true,
          score: bonus,
          breakdownKey: 'languageBonus',
        };
      }
    }

    return { accepted: true, score: 0, breakdownKey: 'languageBonus' };
  }
}
