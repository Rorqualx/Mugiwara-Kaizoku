/**
 * Prowlarr-candidate scope filters used by the manual-dispatch path in
 * `dispatch.ts:dispatchProwlarrManual`. Extracted to keep `dispatch.ts`
 * under the project's 500-line per-file limit and to consolidate the
 * normalize-then-filter logic in one place.
 */

import type { ReleaseCandidate } from '@/server/services/library/indexerSearch/types';
import type { ProwlarrSearchResult } from '@/types/prowlarr';

/** Lowercase + collapse whitespace; used for fuzzy title-substring checks. */
export function normalizeForMatching(s: string): string {
  return s.toLowerCase().replace(/\s+/g, '');
}

/**
 * Filter Prowlarr candidates to those that match the requested scope.
 *
 * Two gates, both required:
 *
 * (1) Title relevance — at least one of the manga's known titles (canonical
 *     + synonyms) must appear as a substring of the release title. Without
 *     this, Prowlarr's fuzzy matcher regularly leaks unrelated releases
 *     (anime episodes, similarly-named series). Skipped when the title
 *     vocabulary is empty (lookup failed).
 *
 * (2) Coverage overlap, in priority order:
 *       - chapter coverage (e.g. "c001-c100") → require chapter overlap
 *       - else volume coverage (e.g. "v01-v04", "第01-04巻") → require volume overlap
 *       - else (no parseable range) → reject. See `filterProwlarrToTitleAndOpaque`
 *         below for the iter-3 manual-scope fallback that accepts these.
 */
export function filterProwlarrCandidatesToScope(
  candidates: ReleaseCandidate[],
  titles: string[],
  inScopeChapters: Set<number>,
  inScopeVolumes: Set<number>,
): ReleaseCandidate[] {
  const normalizedTitles = titles.map(normalizeForMatching).filter(t => t.length > 0);
  const skipTitleCheck = normalizedTitles.length === 0;
  return candidates.filter(c => {
    if (!skipTitleCheck) {
      const releaseNorm = normalizeForMatching((c.payload as ProwlarrSearchResult).title);
      if (!normalizedTitles.some(t => releaseNorm.includes(t))) return false;
    }
    if (c.coverage.chapters.length > 0) {
      return c.coverage.chapters.some(n => inScopeChapters.has(n));
    }
    const volumes = c.coverage.volumes;
    if (volumes && volumes.length > 0) {
      return volumes.some(v => inScopeVolumes.has(v));
    }
    return false;
  });
}

