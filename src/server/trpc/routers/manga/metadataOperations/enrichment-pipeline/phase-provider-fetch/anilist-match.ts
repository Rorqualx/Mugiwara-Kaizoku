/**
 * AniList best-match picker — extracted from phase-provider-fetch.ts to keep
 * that file under the 800-line cap. No behaviour change from the original.
 *
 * Scoring: normalized bigram Sørensen-Dice vs every primary title (romaji /
 * english / native) and every synonym. Tiebreakers: higher score →
 * primary-title-match preferred over synonym → popularity.
 *
 * Filter: hasEditionMismatch() (imported from ../utils) rejects candidates
 * whose edition/spinoff qualifiers don't agree with the query.
 */
import type { AniListMangaResult } from '@/server/services/anilist/service';
import { logger } from '@/utils/logger';

import { applySingleTokenGuard } from '../matching/sequel-penalty';
import { diceCoefficient, hasEditionMismatch, normalizeTitle } from '../utils';

const log = logger.child('PhaseProviderFetch');

/** Pick the AniList result with the best title match.
 *  Uses tiebreakers when scores are equal: primary title > synonym, then popularity. */
// eslint-disable-next-line complexity -- multi-factor scoring with tiebreakers requires branching
export function pickBestTitleMatch(
  results: AniListMangaResult[],
  query: string,
): AniListMangaResult | null {
  const normalized = normalizeTitle(query);
  let best: AniListMangaResult | null = null;
  let bestScore = 0;
  let bestIsPrimary = false;
  let bestPopularity = 0;

  for (const r of results) {
    const primaryTitles = [r.title.english, r.title.romaji, r.title.native]
      .filter((t): t is string => typeof t === 'string');
    const synonymTitles = (r.synonyms ?? [])
      .filter((t): t is string => typeof t === 'string');

    // Skip results that are the main series when searching for a variant edition
    // (e.g., "Chainsaw Man - Color" should NOT match "Chainsaw Man").
    //
    // Iter-25: check each title independently. The previous
    // join-and-test approach false-rejected candidates whose romaji title
    // contained a spinoff keyword that was only part of the name — e.g.
    // "Shin Petshop of Horrors" (romaji; "Shin" = "New" in JP) was rejected
    // for "Pet Shop of Horrors Tokyo" even though the candidate's English
    // title "Pet Shop of Horrors: Tokyo" matches exactly. Passing when ANY
    // candidate title has no qualifier mismatch avoids that false reject.
    const allTitles = [...primaryTitles, ...synonymTitles];
    const hasMatchingTitle = allTitles.some((t) => !hasEditionMismatch(query, t));
    if (!hasMatchingTitle) continue;

    // Find this result's best score and whether it came from a primary title
    let resultScore = 0;
    let resultIsPrimary = false;
    let resultMatchedTitle = '';

    for (const c of primaryTitles) {
      const score = diceCoefficient(normalized, normalizeTitle(c));
      if (score > resultScore) {
        resultScore = score;
        resultIsPrimary = true;
        resultMatchedTitle = c;
      }
    }
    for (const c of synonymTitles) {
      const score = diceCoefficient(normalized, normalizeTitle(c));
      if (score > resultScore) {
        resultScore = score;
        resultIsPrimary = false;
        resultMatchedTitle = c;
      }
    }

    // Defense-in-depth: penalize adult results so they don't beat non-adult matches
    const isAdultResult = r.isAdult === true;
    const afterAdult = isAdultResult ? resultScore * 0.5 : resultScore;

    // Iter-26: downweight one-token overlaps on long candidate titles.
    // Dice alone can score 0.5+ for "Twisted Visions" vs a multi-word synonym
    // sharing one common word — legacy path already protects against this; parity port.
    const effectiveScore = applySingleTokenGuard(afterAdult, query, resultMatchedTitle);

    // Tiebreaker logic: score > primary title > popularity
    // Prevents "Berserk of Gluttony" (synonym "Berserk") from beating the actual "Berserk" manga
    const popularity = r.popularity ?? 0;
    const isBetter = effectiveScore > bestScore
      || (effectiveScore === bestScore && resultIsPrimary && !bestIsPrimary)
      || (effectiveScore === bestScore && resultIsPrimary === bestIsPrimary && popularity > bestPopularity);

    if (isBetter) {
      bestScore = effectiveScore;
      best = r;
      bestIsPrimary = resultIsPrimary;
      bestPopularity = popularity;
    }
  }

  if (bestScore < 0.3) {
    log.warn('AniList: best match too dissimilar', { query, bestScore: bestScore.toFixed(2) });
    return null;
  }

  if (best) {
    log.info('AniList: title-matched', {
      id: best.id,
      title: best.title.english ?? best.title.romaji,
      score: bestScore.toFixed(2),
      matchType: bestIsPrimary ? 'primary' : 'synonym',
      popularity: bestPopularity,
    });
  }

  return best;
}
