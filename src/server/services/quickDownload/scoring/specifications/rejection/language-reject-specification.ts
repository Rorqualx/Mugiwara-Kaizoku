/**
 * Language Rejection Specification
 *
 * Rejects releases in non-preferred languages when strict language filtering
 * is enabled via `rejectNonPreferredLanguages` on the criteria.
 */

import type {
  DownloadSpecification,
  SpecificationResult,
} from '@/server/services/quickDownload/scoring/types';
import {
  NON_LATIN_SCRIPT_RE,
  RejectionType,
  SpecificationPriority,
} from '@/server/services/quickDownload/scoring/types';
import type { ProwlarrSearchResult } from '@/types/prowlarr';
import type { QuickDownloadCriteria } from '@/types/quickDownload.types';
import logger from '@/utils/serverLogger';

export class LanguageRejectSpecification implements DownloadSpecification {
  readonly name = 'LanguageRejectSpecification';
  readonly rejectionType = RejectionType.PERMANENT;
  readonly priority = SpecificationPriority.REJECTION;

  evaluate(
    result: ProwlarrSearchResult,
    criteria: QuickDownloadCriteria,
  ): SpecificationResult {
    if (!criteria.rejectNonPreferredLanguages) {
      return { accepted: true, score: 0, breakdownKey: 'languageBonus' };
    }

    if (criteria.preferredLanguages.length === 0) {
      return { accepted: true, score: 0, breakdownKey: 'languageBonus' };
    }

    // Collect all detected languages from the result
    const resultLanguages = [
      result.audioLanguage,
      ...(result.languages ?? []),
    ].filter(Boolean) as string[];

    // Check if any preferred language matches
    const hasPreferredMatch = criteria.preferredLanguages.some(preferred =>
      resultLanguages.some(
        lang => lang.toLowerCase() === preferred.toLowerCase(),
      ),
    );

    if (hasPreferredMatch) {
      return { accepted: true, score: 0, breakdownKey: 'languageBonus' };
    }

    // Reject only if we have evidence of a non-preferred language
    const hasDetectedLanguage = resultLanguages.length > 0;
    const hasNonLatinScript = NON_LATIN_SCRIPT_RE.test(result.title);

    if (hasDetectedLanguage || hasNonLatinScript) {
      logger.debug(
        `[Scoring] Language rejection for ${result.title} — no preferred language match`,
      );
      return {
        accepted: false,
        score: 0,
        breakdownKey: 'languageBonus',
        reason: 'No preferred language detected in release',
      };
    }

    // No language evidence — do not reject (benefit of the doubt)
    return { accepted: true, score: 0, breakdownKey: 'languageBonus' };
  }
}
