/**
 * Release Blocklist Alternatives Finder
 *
 * Finds alternative releases for blocked content using Prowlarr search.
 *
 * Coverage detection: parses each Prowlarr result's title via
 * `parseReleaseCoverage` to determine which chapters/volumes the pack
 * covers. The previous implementation read `result['chapters']` directly,
 * but `ProwlarrSearchResult` has no such field — so every candidate was
 * silently dropped, and the retry pipeline always reported "No
 * alternative releases found."
 *
 * Match policy:
 *   - parsed.chapters non-empty: accept iff target chapter ∈ parsed.chapters
 *     (decimal targets like 27.1 fall back to their integer floor — packs
 *     numbered by integer chapter rarely advertise sub-chapter granularity).
 *   - parsed.chapters empty + parsed.volumes non-empty: volume pack —
 *     accept (we don't know the chapter ↔ volume mapping cheaply, and
 *     volume packs are the dominant manga release shape).
 *   - both empty: opaque whole-series mirror — accept (matches the
 *     prowlarr-adapter convention that empty coverage means "covers all").
 */

import { parseReleaseCoverage } from '@/server/services/library/indexerSearch/coverage-parser';
import type { AsyncResult } from '@/utils/async-result';
import {
  createSuccessResult,
  createErrorResult,
  isSuccess
} from '@/utils/async-result';
import { logger } from '@/utils/logger';

import { ProwlarrMangaSearch } from '../prowlarr/mangaSearch';

import type { ReleaseIdentifier } from './types';
import type { PrismaClient } from '@prisma/client';

interface MatchContext {
  mangaId: number;
  targetChapter: number;
  targetInt: number;
  isValidTarget: boolean;
}

interface ProwlarrLikeResult {
  title: string;
  guid?: string;
  indexerName?: string;
}

/**
 * Find alternative releases using Prowlarr search.
 *
 * @param prisma - Prisma client
 * @param mangaId - Manga ID
 * @param chapterNumber - Chapter number to find (string; decimals supported)
 * @param excludeReleases - Release titles to exclude
 * @returns List of alternative release identifiers
 */
export async function findAlternativeReleases(
  prisma: PrismaClient,
  mangaId: number,
  chapterNumber: string,
  excludeReleases: string[]
): Promise<AsyncResult<ReleaseIdentifier[], Error>> {
  try {
    logger.info('Finding alternative releases', {
      mangaId,
      chapterNumber,
      excludeCount: excludeReleases.length
    });

    const manga = await prisma.manga.findUnique({
      where: { id: mangaId },
      select: {
        title: true,
        Metadata: { select: { synonyms: true } }
      }
    });

    if (!manga) {
      return createErrorResult(new Error(`Manga not found: ${mangaId}`));
    }

    // Series-level queries: chapter-narrow queries (`title chapter N`) excluded
    // volume packs and produced API-error noise. The ranker filters by chapter
    // coverage downstream, so a broader search is both more accurate and quieter.
    const searchQueries: string[] = [manga.title];
    const synonyms = manga.Metadata?.synonyms ?? [];
    // Cap synonym fan-out to keep request volume bounded — Prowlarr already
    // dedupes by GUID across queries.
    for (const altTitle of synonyms.slice(0, 2)) {
      if (altTitle.length > 0 && altTitle !== manga.title) {
        searchQueries.push(altTitle);
      }
    }

    const targetChapter = Number(chapterNumber);
    const isValidTarget = !Number.isNaN(targetChapter) && Number.isFinite(targetChapter);
    const targetInt = isValidTarget ? Math.floor(targetChapter) : NaN;

    const allResults: ReleaseIdentifier[] = [];
    const seenReleases = new Set<string>(excludeReleases);
    const prowlarrSearch = new ProwlarrMangaSearch(prisma);

    const matchCtx: MatchContext = { mangaId, targetChapter, targetInt, isValidTarget };
    // mangaId scopes Prowlarr's post-search blocklist check; without it, a
    // block on a same-titled release for a different manga would suppress
    // an otherwise-valid alternative here. acceptedTitles drives the
    // relevance gate so the alternatives we surface aren't themselves
    // wrong-target (Akira → "Akira Failing in Love").
    const acceptedTitles = [manga.title, ...synonyms].filter((t) => t.length > 0);
    const searchResults = await Promise.all(
      searchQueries.map(query => prowlarrSearch.searchManga(query, { mangaId, acceptedTitles }))
    );

    for (const searchResult of searchResults) {
      if (!isSuccess(searchResult)) continue;
      collectAlternatives(searchResult.data.results, matchCtx, seenReleases, allResults);
      if (allResults.length >= 5) break;
    }

    logger.info(`Found ${allResults.length} alternative releases for chapter ${chapterNumber}`);
    return createSuccessResult(allResults);
  } catch (error: unknown) {
    logger.error('Error finding alternative releases', {
      error: error instanceof Error ? error.message : String(error),
      mangaId,
      chapterNumber
    });
    return createErrorResult(
      error instanceof Error ? error : new Error('Failed to find alternative releases')
    );
  }
}

function collectAlternatives(
  results: ProwlarrLikeResult[],
  ctx: MatchContext,
  seen: Set<string>,
  out: ReleaseIdentifier[],
): void {
  for (const result of results) {
    if (seen.has(result.title)) continue;
    const parsed = parseReleaseCoverage(result.title);
    if (!shouldAcceptCandidate(parsed, ctx.targetChapter, ctx.targetInt, ctx.isValidTarget)) continue;

    const releaseId: ReleaseIdentifier = {
      releaseTitle: result.title,
      mangaId: ctx.mangaId,
      ...(ctx.isValidTarget ? { chapterNumber: ctx.targetChapter } : {}),
    };
    if (result.guid !== undefined) releaseId.indexerId = result.guid;
    if (result.indexerName !== undefined) releaseId.source = result.indexerName;

    out.push(releaseId);
    seen.add(result.title);
  }
}

/**
 * Decide whether a parsed Prowlarr release covers the requested chapter.
 * See module-level "Match policy" for the full rule set.
 */
function shouldAcceptCandidate(
  parsed: { chapters: number[]; volumes: number[] },
  targetChapter: number,
  targetInt: number,
  isValidTarget: boolean,
): boolean {
  if (parsed.chapters.length === 0) {
    // No parsed chapter range — accept if it's a volume pack or an opaque
    // whole-series mirror. Both are common for manga and the per-pack
    // ranker downstream will weed out off-topic hits.
    return true;
  }
  if (!isValidTarget) {
    // Caller didn't supply a usable chapter; let the ranker decide later.
    return true;
  }
  return parsed.chapters.includes(targetChapter) || parsed.chapters.includes(targetInt);
}

/**
 * Public wrapper for finding alternatives. Preserved for backwards
 * compatibility with `releaseBlocklistService.findAlternatives`.
 */
export async function findAlternatives(
  prisma: PrismaClient,
  mangaId: number,
  chapterNumber: string,
  excludeReleases: string[]
): Promise<AsyncResult<ReleaseIdentifier[], Error>> {
  return findAlternativeReleases(prisma, mangaId, chapterNumber, excludeReleases);
}
