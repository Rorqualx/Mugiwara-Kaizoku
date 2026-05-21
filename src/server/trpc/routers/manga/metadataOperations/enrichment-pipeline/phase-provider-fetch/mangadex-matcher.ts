/**
 * MangaDex Discovery Matcher
 *
 * Picks the best MangaDex manga match using:
 * 1. AniList cross-reference (links.al) — definitive when available
 * 2. Dice coefficient scoring with length-ratio penalty
 * 3. Chapter proximity tiebreaking
 * 4. Bidirectional edition/spinoff mismatch filtering
 */

import type { KaizokuMangaDexClient } from '@/server/services/mangadex/ts-client-factory';
import type { MangaDexManga } from '@/server/services/mangadex/types';
import { logger } from '@/utils/logger';

import { diceCoefficient, hasEditionMismatch, normalizeTitle } from '../utils';

const log = logger.child('MangaDexMatcher');

/** Collect all title variants from a MangaDex manga entry */
function collectTitles(manga: MangaDexManga): string[] {
  const titles: string[] = [];
  const t = manga.attributes.title;
  if (t.en) titles.push(t.en);
  if (t['ja-ro']) titles.push(t['ja-ro']);
  if (t.ja) titles.push(t.ja);
  for (const alt of manga.attributes.altTitles) {
    titles.push(...Object.values(alt).filter((v): v is string => typeof v === 'string'));
  }
  return titles;
}

/** Filter results to those whose links.al matches the given AniList ID */
function filterByCrossRef(results: MangaDexManga[], anilistId: number): MangaDexManga[] {
  return results.filter((m) => {
    const al = m.attributes.links?.al;
    return al !== undefined && parseInt(String(al), 10) === anilistId;
  });
}

/** Compute chapter proximity multiplier (0.7–1.0) */
function chapterProximityFactor(lastChapter: string | null | undefined, expected: number | null): number {
  if (!expected || expected <= 0) return 1;
  const mdCh = parseFloat(lastChapter ?? '0');
  if (Number.isNaN(mdCh) || mdCh <= 0) return 1;
  const ratio = Math.min(mdCh, expected) / Math.max(mdCh, expected);
  return 0.7 + 0.3 * ratio;
}

/** Compute year proximity multiplier — boosts exact year, penalizes >2yr gap */
function yearProximityFactor(candidateYear: number | undefined, expectedYear: number | null): number {
  if (!expectedYear || !candidateYear) return 1;
  const diff = Math.abs(candidateYear - expectedYear);
  if (diff === 0) return 1.15;
  if (diff <= 2) return 1.0;
  return 0.8;
}

/** Score candidates by dice coefficient with length-ratio penalty */
function scoreCandidates(
  results: MangaDexManga[], query: string, applyEditionFilter: boolean,
  expectedChapters: number | null, expectedYear: number | null,
): MangaDexManga | null {
  const normalized = normalizeTitle(query);
  let best: MangaDexManga | null = null;
  let bestScore = 0;
  let bestLenDiff = Infinity;

  for (const manga of results) {
    const titles = collectTitles(manga);
    if (applyEditionFilter && hasEditionMismatch(query, titles.join(' '))) continue;
    const chFactor = chapterProximityFactor(manga.attributes.lastChapter, expectedChapters);
    const yrFactor = yearProximityFactor(manga.attributes.year ?? undefined, expectedYear);
    for (const c of titles) {
      const dice = diceCoefficient(normalized, normalizeTitle(c));
      const lenRatio = Math.min(query.length, c.length) / Math.max(query.length, c.length);
      const score = dice * lenRatio * chFactor * yrFactor;
      const lenDiff = Math.abs(c.length - query.length);
      if (score > bestScore || (score === bestScore && lenDiff < bestLenDiff)) {
        bestScore = score;
        bestLenDiff = lenDiff;
        best = manga;
      }
    }
  }
  return bestScore >= 0.4 ? best : null;
}

/** Try to find a definitive match via AniList cross-reference (links.al) */
// eslint-disable-next-line max-params -- 4 required scoring inputs + 2 optional disambiguation hints, mirrors pickBestMangaDexMatch's shape; bundling would obscure required-vs-optional intent
function tryCrossRef(
  results: MangaDexManga[], query: string, anilistId: number, client: KaizokuMangaDexClient,
  expectedChapters?: number | null, expectedYear?: number | null,
): MangaDexManga | null {
  const alMatches = filterByCrossRef(results, anilistId);
  if (alMatches.length === 0) return null;

  // Prefer main edition among cross-ref matches (filter variant editions like Color/Colored)
  const mainEdition = scoreCandidates(alMatches, query, true, expectedChapters ?? null, expectedYear ?? null);
  if (mainEdition) {
    log.info('MangaDex: cross-ref matched via links.al (main edition)', {
      id: mainEdition.id, title: client.getEnglishTitle(mainEdition), anilistId,
    });
    return mainEdition;
  }

  // Fall back to any cross-ref match — links.al IS the verification
  const best = scoreCandidates(alMatches, query, false, expectedChapters ?? null, expectedYear ?? null);
  if (!best) return null;
  log.info('MangaDex: cross-ref matched via links.al', {
    id: best.id, title: client.getEnglishTitle(best), anilistId,
  });
  return best;
}

/**
 * Pick the best MangaDex match from search results.
 *
 * When an AniList ID is available, first checks for a definitive cross-reference
 * match via `links.al`. Falls back to dice coefficient scoring with length-ratio
 * penalty and chapter proximity tiebreaking.
 */
// eslint-disable-next-line max-params -- 3 required matcher inputs + 3 optional disambiguation hints; positional API keeps required-vs-optional distinction obvious at call sites
export function pickBestMangaDexMatch(
  results: MangaDexManga[],
  query: string,
  client: KaizokuMangaDexClient,
  anilistId?: number,
  expectedChapters?: number | null,
  expectedYear?: number | null,
): MangaDexManga | null {
  // Step 1: definitive cross-reference via links.al
  if (anilistId !== undefined) {
    const crossRefMatch = tryCrossRef(results, query, anilistId, client, expectedChapters, expectedYear);
    if (crossRefMatch) return crossRefMatch;
  }

  // Step 2: title scoring with edition filter + chapter/year proximity
  const best = scoreCandidates(results, query, true, expectedChapters ?? null, expectedYear ?? null);
  if (best) {
    log.info('MangaDex: title-matched', { id: best.id, title: client.getEnglishTitle(best) });
  } else {
    log.warn('MangaDex: best match too dissimilar', { query });
  }
  return best;
}
