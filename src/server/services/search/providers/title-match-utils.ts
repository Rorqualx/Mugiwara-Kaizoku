/**
 * Shared title-matching utilities for AniList relevance filters.
 *
 * Splits query terms across diacritic-folded variants so a folder like
 * "Iken Senki Volundio" can still resolve to AniList's "Völundio ~Divergent
 * Sword Saga~" (english) when the romaji "Iken Senki Völundio" is the variant
 * carrying the user's tokens.
 */
import type { SearchResult } from '@/types/search.types';
import { logger } from '@/utils/logger';

/**
 * NFKD-normalize and strip combining marks so "Völundio" → "Volundio",
 * "Sōsō no Frieren" → "Soso no Frieren", etc. Case is preserved.
 */
export function foldDiacritics(s: string): string {
  return s.normalize('NFKD').replace(/[̀-ͯ]/g, '');
}

/**
 * All title variants a relevance filter should consider for a result.
 * Returns lowered + diacritic-folded strings. Includes the picked title
 * plus any alternativeTitles (which the AniList validator now populates
 * with romaji/english/native + synonyms).
 */
export function collectTitleVariants(result: SearchResult): string[] {
  const out: string[] = [];
  if (result.title) out.push(foldDiacritics(result.title.toLowerCase()));
  if (Array.isArray(result.alternativeTitles)) {
    for (const t of result.alternativeTitles) {
      if (typeof t === 'string' && t.length > 0) {
        out.push(foldDiacritics(t.toLowerCase()));
      }
    }
  }
  return Array.from(new Set(out));
}

/**
 * Returns true if `candidate` (already lowered + diacritic-folded) is a
 * sufficient match for the folded query / search-term list. Mirrors the
 * tiered exact-vs-partial logic used previously on a single title.
 */
export function titleMatchesQuery(
  candidate: string,
  queryFolded: string,
  searchTerms: string[],
  rawTitle: string,
  rawQuery: string,
): boolean {
  if (candidate.includes(queryFolded)) {
    logger.debug(`✅ Exact match (folded): "${rawTitle}" for query "${rawQuery}"`);
    return true;
  }
  const hasAllTerms = searchTerms.every((term) => candidate.includes(term));
  if (hasAllTerms) {
    logger.debug(`✅ Good match: "${rawTitle}" contains all search terms`);
    return true;
  }
  const matchedTerms = searchTerms.filter((term) => candidate.includes(term));
  const matchRatio = matchedTerms.length / searchTerms.length;
  if (matchRatio >= 0.5) {
    logger.debug(`✅ Partial match: "${rawTitle}" matches ${matchedTerms.length}/${searchTerms.length} (${Math.round(matchRatio * 100)}%)`);
    return true;
  }
  return false;
}
