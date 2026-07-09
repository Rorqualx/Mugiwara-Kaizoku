/**
 * Phase 3: Data Assembly + Gap Detection
 *
 * Assembles all provider data into a unified SourceDataCollection
 * for AI agent processing. Parses ComicVine volume descriptions,
 * normalizes all sources, and detects coverage gaps.
 */

import { logger } from '@/utils/logger';

import { parseComicVineDescriptions } from './comicvine-description-parser';

import type {
  GapAnalysis,
  SourceDataCollection,
  UnifiedProviderResults,
  VolumeDataItem,
} from './types';
import type { MangaPublicationStatus } from '@prisma/client';

/**
 * Stored DB signal used as a LAST-RESORT trusted ceiling when the live providers
 * carry no terminal signal — e.g. Berserk reads as RELEASING on AniList (no
 * chapters/endDate) yet the library's stored Metadata already knows it concluded
 * (endDate set) at a known chapter count.
 */
export interface StoredTerminalSignal {
  endDate: Date | null;
  status: MangaPublicationStatus | null;
  chapters: number | null;
}

const log = logger.child('DataAssembly');

/**
 * Assemble all provider data into a SourceDataCollection with gap analysis.
 *
 * @param results - Combined results from Phase 1 (all providers)
 * @param dbChapterCount - Number of chapters currently in the database
 * @param stored - Stored DB terminal signal (endDate/status/chapters), used as a
 *   last-resort trusted ceiling when live providers report no terminal signal
 * @returns Assembled and normalized data ready for AI agent processing
 */
export function assembleSourceData(
  results: UnifiedProviderResults,
  dbChapterCount: number,
  stored?: StoredTerminalSignal,
): SourceDataCollection {
  const sources = extractAllSources(results);
  const rawExpectedChapterCount = estimateChapterCountFromAssembly(
    results.enrichmentResult, dbChapterCount, sources,
  );

  // A finished series with a trusted scalar has a KNOWN final chapter — clamp
  // the expected count to it so reconciliation never fabricates placeholders
  // past the end (e.g. AoT's 140/141 beyond the real 139). null when untrusted,
  // leaving the existing overshoot-tolerant behaviour unchanged. The plausibility
  // guard rejects an obviously-broken scalar (e.g. Black Clover AniList chapters=1
  // against ~370 corroborated source chapters) so real chapters are never clamped.
  const trustedFinalChapter = plausibleTrustedCeiling(
    resolveTrustedFinalChapter(results, stored).ceiling, rawExpectedChapterCount,
  );
  const expectedChapterCount = trustedFinalChapter !== null
    ? Math.min(rawExpectedChapterCount || trustedFinalChapter, trustedFinalChapter)
    : rawExpectedChapterCount;

  const gaps = buildGapAnalysis(expectedChapterCount, sources, results);

  logAssemblyResult(results, expectedChapterCount, sources, gaps);

  const assembled: SourceDataCollection = {
    mangaId: results.enrichmentResult.manga.id,
    title: results.enrichmentResult.manga.title,
    expectedChapterCount,
    trustedFinalChapter,
    sources,
    gaps,
    rawData: buildRawDataSection(results),
  };

  const volumeSources = extractVolumeDataFromSources(results);
  if (volumeSources) {
    assembled.volumeSources = volumeSources;
  }

  return assembled;
}

/** Extract and normalize chapter data from all sources */
function extractAllSources(results: UnifiedProviderResults): SourceDataCollection['sources'] {
  const comicvineResult = parseComicVineDescriptions(results.enrichmentResult.enrichedData);

  return {
    comicvine: comicvineResult.chapters,
    fandom: results.fandomResult?.chapterList ?? [],
    wikipedia: results.wikipediaResult?.chapterList ?? [],
  };
}

/** Build the rawData metadata section */
function buildRawDataSection(results: UnifiedProviderResults): SourceDataCollection['rawData'] {
  const comicvineResult = parseComicVineDescriptions(results.enrichmentResult.enrichedData);

  const rawData: SourceDataCollection['rawData'] = {
    fandomParseSuccess: results.fandomResult?.parseSuccess ?? false,
    wikipediaParseSuccess: results.wikipediaResult !== null,
  };
  if (results.fandomResult?.url) rawData.fandomUrl = results.fandomResult.url;
  if (results.fandomResult?.rawHtml) rawData.fandomRawHtml = results.fandomResult.rawHtml;
  if (comicvineResult.volumeDescriptions.length > 0) {
    rawData.comicvineVolumeDescriptions = comicvineResult.volumeDescriptions.map(v => ({
      volumeNumber: v.volumeNumber,
      descriptionText: v.descriptionText,
      parsedChapterCount: v.parsedChapterCount,
    }));
  }

  // ComicVine match metadata for remediation validation
  if (results.comicvineResult) {
    if (results.comicvineResult.publisherName) {
      rawData.comicvinePublisher = results.comicvineResult.publisherName;
    }
    rawData.comicvineVolumeId = results.comicvineResult.volumeId;
    rawData.comicvineVolumeName = results.comicvineResult.volumeName;
    rawData.comicvineIssueCount = results.comicvineResult.issueCount;
  }

  // MangaUpdates series-level metadata (publisher, categories, licensing)
  if (results.mangaupdatesResult) {
    rawData.mangaupdatesSeriesId = results.mangaupdatesResult.seriesId;
    if (results.mangaupdatesResult.publisher) {
      rawData.mangaupdatesPublisher = results.mangaupdatesResult.publisher;
    }
    rawData.mangaupdatesCategories = results.mangaupdatesResult.categories;
    rawData.mangaupdatesLicensed = results.mangaupdatesResult.licensed;
  }

  return rawData;
}

/** Log assembly results */
function logAssemblyResult(
  results: UnifiedProviderResults,
  expectedChapterCount: number,
  sources: SourceDataCollection['sources'],
  gaps: GapAnalysis,
): void {
  log.info(`Data assembly complete for "${results.enrichmentResult.manga.title}"`, {
    mangaId: results.enrichmentResult.manga.id,
    expectedChapterCount,
    comicvine: sources.comicvine.length,
    fandom: sources.fandom.length,
    wikipedia: sources.wikipedia.length,
    coveragePercent: gaps.coveragePercent,
    needsRemediation: gaps.needsRemediation,
  });
}

/**
 * Estimate an expected chapter-count ceiling from assembled source data.
 *
 * NOTE: distinct from the canonical cross-source `resolveExpectedChapterCount`
 * in `chapter-consensus-resolver.ts` (cluster-vote). This is an older, divergent
 * MAX-with-guards heuristic used only here in Phase 3 gap detection; kept as-is.
 *
 * Takes the MAX across all credible signals rather than short-circuiting
 * on the first non-zero value. This prevents under-counting when AniList
 * returns "?" (0) but MangaDex or wiki sources have data.
 *
 * Signals considered:
 * - AniList scalar chapter count
 * - Fandom chapter list length
 * - Wikipedia chapter list length
 * - ComicVine chapter list length
 * - Max chapter number across all source lists
 * - MangaDex lastChapter metadata
 * - DB count (last resort)
 */
// eslint-disable-next-line complexity -- complexity 25: 5-source candidate collection + 2 sanity guards (3x best-list cap, 1.2x scalar cap) that each prevent a specific data-quality issue documented inline; restructuring would lose the guard ordering
function estimateChapterCountFromAssembly(
  enrichmentResult: UnifiedProviderResults['enrichmentResult'],
  dbChapterCount: number,
  sources: SourceDataCollection['sources'],
): number {
  const candidates: number[] = [];

  // 1. AniList scalar
  const scalarCount = extractScalarChapterCount(enrichmentResult);
  if (scalarCount && scalarCount > 0) candidates.push(scalarCount);

  // 2. Source list lengths
  if (sources.fandom.length > 0) candidates.push(sources.fandom.length);
  if (sources.wikipedia.length > 0) candidates.push(sources.wikipedia.length);
  if (sources.comicvine.length > 0) candidates.push(sources.comicvine.length);

  // 3. Max chapter number across all sources
  const allChapters = [...sources.fandom, ...sources.wikipedia, ...sources.comicvine];
  const maxChapterNum = allChapters.reduce((max, ch) => Math.max(max, ch.number), 0);
  if (maxChapterNum > 0) candidates.push(Math.ceil(maxChapterNum));

  // 4. MangaDex lastChapter
  const mangadexLastCh = extractMangaDexLastChapter(enrichmentResult);
  if (mangadexLastCh > 0) candidates.push(mangadexLastCh);

  // 5. DB count — only if no source data provides a count.
  // Never use DB count alongside source counts: if a prior run created phantom
  // chapters (e.g., 2019 from a misparse), the DB count would be self-reinforcing.
  if (candidates.length === 0 && dbChapterCount > 0) {
    candidates.push(dbChapterCount);
  }

  if (candidates.length === 0) return 0;

  // Guard: if max chapter number is wildly higher than the best list count,
  // prefer the list count. A source list with 200 entries having a max chapter
  // numbered 200 is reliable; a stray "2019" from a misparse is not.
  const maxCandidate = Math.max(...candidates);
  const listCounts = [sources.fandom.length, sources.wikipedia.length, sources.comicvine.length].filter(n => n > 0);
  const bestListCount = listCounts.length > 0 ? Math.max(...listCounts) : 0;

  if (bestListCount > 0 && maxCandidate > bestListCount * 3) {
    logger.warn(
      `[DataAssembly] Max candidate ${maxCandidate} is >3x best list count ${bestListCount} — capping to avoid phantom chapters`,
    );
    return bestListCount;
  }

  // Guard: If AniList provides a scalar chapter count, never exceed it by more than 20%.
  // AniList is the most reliable source for total chapter count — misparsed numbers
  // from Fandom/Wikipedia/ComicVine (years, ISBNs) should not inflate beyond it.
  // Returning Math.max(scalar, bestList) here was a no-op when bestList itself
  // was contaminated (e.g. ComicVine binding to main Naruto's 700 issues for
  // Naruto Shinden where AL=10) — the cap must be against scalar, not bestList.
  if (scalarCount && scalarCount > 0 && maxCandidate > scalarCount * 1.2) {
    logger.warn(
      `[DataAssembly] Max candidate ${maxCandidate} exceeds AniList count ${scalarCount} by >20% — capping to ${Math.ceil(scalarCount * 1.2)}`,
    );
    return Math.ceil(scalarCount * 1.2);
  }

  // Fallback when AL.chapters is null (e.g. ongoing series, sub-series, or
  // a wrong AL match like Trapped in a Dating Sim AL=154693): use MangaDex
  // last-chapter as the cap signal. AL volumes is also tried — most manga
  // have <10 chapters per volume, so volumes × 10 is a generous ceiling.
  if ((!scalarCount || scalarCount === 0) && maxCandidate > 0) {
    const mdxLastCh = extractMangaDexLastChapter(enrichmentResult);
    const alVolumes = extractScalarVolumeCount(enrichmentResult);
    let fallbackCap = 0;
    let fallbackSource = '';
    if (mdxLastCh > 0) {
      fallbackCap = Math.ceil(mdxLastCh * 1.2);
      fallbackSource = `MangaDex last chapter ${mdxLastCh}`;
    } else if (alVolumes && alVolumes > 0) {
      fallbackCap = alVolumes * 10;
      fallbackSource = `AniList ${alVolumes} volumes × 10`;
    }
    if (fallbackCap > 0 && maxCandidate > fallbackCap) {
      logger.warn(
        `[DataAssembly] AL chapters null — capping ${maxCandidate} to ${fallbackCap} via ${fallbackSource}`,
      );
      return fallbackCap;
    }
  }

  return maxCandidate;
}

/** Extract MangaDex lastChapter from enriched data */
function extractMangaDexLastChapter(enrichmentResult: UnifiedProviderResults['enrichmentResult']): number {
  const enrichedData = enrichmentResult.enrichedData as Record<string, unknown> | undefined;
  const manga = enrichedData?.['manga'] as Record<string, unknown> | undefined;
  const mdMeta = manga?.['mangadexMeta'] as Record<string, unknown> | undefined;
  const lastChapter = mdMeta?.['lastChapter'];
  if (typeof lastChapter === 'string') {
    const num = parseFloat(lastChapter);
    return isNaN(num) ? 0 : Math.ceil(num);
  }
  if (typeof lastChapter === 'number') return Math.ceil(lastChapter);
  return 0;
}

/** Extract scalar chapter count from provider metadata */
function extractScalarChapterCount(enrichmentResult: UnifiedProviderResults['enrichmentResult']): number | null {
  const metadata = enrichmentResult.appliedMatch?.metadata as Record<string, unknown> | undefined;
  if (!metadata) return null;

  // AniList format: metadata.chapters
  if (typeof metadata['chapters'] === 'number') return metadata['chapters'];

  return null;
}

/** Extract scalar volume count from provider metadata. Used as a fallback
 *  cap signal when chapters is null (volumes × 10 is a generous ceiling). */
function extractScalarVolumeCount(enrichmentResult: UnifiedProviderResults['enrichmentResult']): number | null {
  const metadata = enrichmentResult.appliedMatch?.metadata as Record<string, unknown> | undefined;
  if (!metadata) return null;
  if (typeof metadata['volumes'] === 'number') return metadata['volumes'];
  return null;
}

/** Result of resolving the trusted end-of-series ceiling. */
export interface TrustedFinalChapter {
  /** Known final chapter number, or null when no terminal-status scalar exists. */
  ceiling: number | null;
  /** Known final volume number, or null when no terminal-status scalar exists. */
  volumeCeiling: number | null;
  /** True only when a terminal-status provider supplied a numeric chapter scalar. */
  trusted: boolean;
}

/** Prisma MangaPublicationStatus values that mean the run has ended. AniList
 *  FINISHED/CANCELLED are mapped to these before being stored in the applied
 *  match metadata (see anilist/service.ts mapAniListStatusToPrisma). */
const TERMINAL_PRISMA_STATUSES = new Set<string>(['COMPLETED', 'CANCELLED']);
/** Jikan/MAL status strings that mean the run has ended. */
const TERMINAL_MAL_STATUSES = new Set<string>(['finished', 'discontinued']);

/**
 * Resolve the trusted end-of-series chapter (and volume) ceiling.
 *
 * Only a *finished* series has a knowable final chapter — for an ongoing series
 * the latest provider scalar legitimately lags real releases, so no ceiling is
 * returned. Sources are tried in reliability order (AniList → MAL →
 * MangaUpdates) rather than taking the max: AniList's tankōbon chapter count is
 * the canonical end (139 for Attack on Titan), whereas MAL/others sometimes fold
 * specials into the integer count (AoT = 141 on MAL). The first terminal source
 * with a numeric scalar wins.
 *
 * Decimals (139.5) and properly bonus-titled extras are never affected by this
 * ceiling — they are preserved downstream regardless.
 */
/** AniList ceiling — status stored as Prisma MangaPublicationStatus on the applied match metadata. */
function anilistTrustedCeiling(results: UnifiedProviderResults): TrustedFinalChapter | null {
  const metadata = results.enrichmentResult.appliedMatch?.metadata as Record<string, unknown> | undefined;
  const status = typeof metadata?.['status'] === 'string' ? metadata['status'].toUpperCase() : '';
  const chapters = typeof metadata?.['chapters'] === 'number' ? metadata['chapters'] : 0;
  const volumes = typeof metadata?.['volumes'] === 'number' ? metadata['volumes'] : 0;
  // A populated endDate is an authoritative "publication concluded" signal even
  // when the cached status string is a stale ONGOING. AniList only sets endDate
  // once a series has ended, but the status field can lag (JJK ch 271 and Berserk
  // ch 383 both carried an endDate while their stored status still read ONGOING —
  // which let the status-only gate pass phantom generic chapters 272+/384+).
  const hasEndDate = typeof metadata?.['endDate'] === 'string' && metadata['endDate'].length > 0;
  if ((!TERMINAL_PRISMA_STATUSES.has(status) && !hasEndDate) || chapters <= 0) return null;
  return { ceiling: Math.ceil(chapters), volumeCeiling: volumes > 0 ? Math.ceil(volumes) : null, trusted: true };
}

/** MAL (Jikan) ceiling — status string like "Finished". */
function malTrustedCeiling(results: UnifiedProviderResults): TrustedFinalChapter | null {
  const mal = results.malResult;
  const status = typeof mal?.status === 'string' ? mal.status.toLowerCase() : '';
  const chapters = mal?.chapters ?? 0;
  if (!TERMINAL_MAL_STATUSES.has(status) || chapters <= 0) return null;
  const volumes = mal?.volumes ?? 0;
  return { ceiling: Math.ceil(chapters), volumeCeiling: volumes > 0 ? Math.ceil(volumes) : null, trusted: true };
}

/** MangaUpdates ceiling — explicit completed flag + the highest released chapter as the final number. */
function mangaupdatesTrustedCeiling(results: UnifiedProviderResults): TrustedFinalChapter | null {
  const mu = results.mangaupdatesResult;
  if (!mu?.completed || mu.latestChapter <= 0) return null;
  return { ceiling: Math.ceil(mu.latestChapter), volumeCeiling: null, trusted: true };
}

/**
 * Stored-DB ceiling — last resort, used only when the live providers carry no
 * terminal signal. Trusted when the library already knows the series ended (a
 * stored endDate or a terminal stored status) AND a stored chapter scalar exists.
 * This is what lets a reidentify cap Berserk: live AniList reports it RELEASING
 * with no chapters/endDate, but the stored Metadata already knows it concluded.
 */
function storedTrustedCeiling(stored: StoredTerminalSignal | undefined): TrustedFinalChapter | null {
  if (!stored) return null;
  const finished = Boolean(stored.endDate) || (stored.status !== null && TERMINAL_PRISMA_STATUSES.has(stored.status));
  const chapters = stored.chapters ?? 0;
  if (!finished || chapters <= 0) return null;
  return { ceiling: Math.ceil(chapters), volumeCeiling: null, trusted: true };
}

export function resolveTrustedFinalChapter(
  results: UnifiedProviderResults,
  stored?: StoredTerminalSignal,
): TrustedFinalChapter {
  return anilistTrustedCeiling(results)
    ?? malTrustedCeiling(results)
    ?? mangaupdatesTrustedCeiling(results)
    ?? storedTrustedCeiling(stored)
    ?? { ceiling: null, volumeCeiling: null, trusted: false };
}

/** Fraction of the corroborated source count below which a "final chapter"
 *  scalar is treated as broken and ignored. */
const CEILING_PLAUSIBILITY_FLOOR = 0.9;

/**
 * Validate a trusted final-chapter ceiling against the corroborated source count.
 *
 * Provider scalars are sometimes badly wrong (a wrong AniList match stores
 * `chapters: 1` for Black Clover, whose sources list ~370). Honoring such a
 * ceiling would clamp away hundreds of real chapters. A ceiling is only trusted
 * when it is at least 90% of the corroborated source count; otherwise this
 * returns null and the caller falls back to the ordinary overshoot tolerance.
 * A small overshoot (AoT raw 141 vs ceiling 139) still passes.
 */
export function plausibleTrustedCeiling(ceiling: number | null, rawExpectedChapterCount: number): number | null {
  if (ceiling === null || ceiling <= 0) return null;
  if (rawExpectedChapterCount > 0 && ceiling < rawExpectedChapterCount * CEILING_PLAUSIBILITY_FLOOR) return null;
  return ceiling;
}

/**
 * Build gap analysis from all source data.
 */
function buildGapAnalysis(
  expectedChapterCount: number,
  sources: SourceDataCollection['sources'],
  results: UnifiedProviderResults,
): GapAnalysis {
  const sourceCoverage = buildSourceCoverage(sources);
  const chaptersWithTitles = countUniqueTitledChapters(sources);
  const coveragePercent = expectedChapterCount > 0
    ? Math.round((chaptersWithTitles / expectedChapterCount) * 100)
    : 0;
  const failedSources = detectFailedSources(results);

  return {
    totalExpectedChapters: expectedChapterCount,
    chaptersWithTitles,
    coveragePercent,
    sourceCoverage,
    failedSources,
    needsRemediation: coveragePercent < 50 && failedSources.length > 0,
  };
}

/** Count chapters with titles per source */
function buildSourceCoverage(sources: SourceDataCollection['sources']): Record<string, number> {
  return {
    comicvine: sources.comicvine.filter(c => c.title).length,
    fandom: sources.fandom.filter(c => c.title).length,
    wikipedia: sources.wikipedia.filter(c => c.title).length,
  };
}

/** Count unique chapter numbers that have titles across all sources */
function countUniqueTitledChapters(sources: SourceDataCollection['sources']): number {
  const allTitledNumbers = new Set<number>();
  const allChapters = [
    ...sources.comicvine,
    ...sources.fandom, ...sources.wikipedia,
  ];
  for (const ch of allChapters) {
    if (ch.title) allTitledNumbers.add(ch.number);
  }
  return allTitledNumbers.size;
}

/** Detect which sources failed to return data */
function detectFailedSources(results: UnifiedProviderResults): string[] {
  const failed: string[] = [];
  if (!results.fandomResult?.parseSuccess) failed.push('fandom');
  if (!results.wikipediaResult) failed.push('wikipedia');
  return failed;
}

/**
 * Extract volume-level data from all sources for field-aware merge.
 *
 * Sources:
 * - ComicVine: enrichmentResult.enrichedData.manga.volumes[] (issues mapped as volumes)
 * - Fandom: fandomResult.volumeList[]
 * - Wikipedia: wikipediaResult.data.volumeList[]
 */
function extractVolumeDataFromSources(
  results: UnifiedProviderResults,
): NonNullable<SourceDataCollection['volumeSources']> | null {
  const comicvine = extractComicVineVolumes(results);
  const fandom = results.fandomResult?.volumeList ?? [];
  const wikipedia = extractWikipediaVolumes(results);

  // Only return if at least one source has volume data
  if (comicvine.length === 0 && fandom.length === 0 && wikipedia.length === 0) {
    return null;
  }

  return { comicvine, fandom, wikipedia };
}

/** Extract ComicVine volume data from enriched data (issues mapped as volumes) */
function extractComicVineVolumes(results: UnifiedProviderResults): VolumeDataItem[] {
  const enrichedData = results.enrichmentResult.enrichedData as Record<string, unknown> | undefined;
  const manga = enrichedData?.['manga'] as Record<string, unknown> | undefined;
  const volumes = manga?.['volumes'];
  if (!Array.isArray(volumes)) return [];

  const items: VolumeDataItem[] = [];
  for (const vol of volumes) {
    if (!vol || typeof vol !== 'object') continue;
    const v = vol as Record<string, unknown>;
    const num = typeof v['number'] === 'number' ? v['number']
      : typeof v['volumeNumber'] === 'string' ? parseInt(v['volumeNumber'] as string, 10)
      : typeof v['volumeNumber'] === 'number' ? v['volumeNumber'] : null;
    if (num === null || isNaN(num) || num <= 0) continue;

    const item: VolumeDataItem = { number: num };
    if (typeof v['title'] === 'string') item.title = v['title'];
    if (typeof v['description'] === 'string') item.description = v['description'];
    if (typeof v['coverImage'] === 'string') item.coverImage = v['coverImage'];
    if (typeof v['releaseDate'] === 'string') item.releaseDate = v['releaseDate'];
    items.push(item);
  }

  return items;
}

/** Extract Wikipedia volume data from volumeList */
function extractWikipediaVolumes(results: UnifiedProviderResults): VolumeDataItem[] {
  const volumeList = results.wikipediaResult?.data.volumeList;
  if (!volumeList || volumeList.length === 0) return [];

  return volumeList.map(wv => {
    const item: VolumeDataItem = { number: wv.number };
    if (wv.title) item.title = wv.title;
    const desc = wv.description ?? wv.summary;
    if (desc) item.description = desc;
    if (wv.originalReleaseDate) item.releaseDate = wv.originalReleaseDate;
    if (wv.englishReleaseDate) item.releaseDateEn = wv.englishReleaseDate;
    if (wv.isbn) item.isbn = wv.isbn;
    // Map chapter range from Wikipedia volumes
    if (wv.chapters.length > 0) {
      const chapterNums = wv.chapters
        .map(c => typeof c.number === 'number' ? c.number : parseFloat(String(c.number)))
        .filter(n => !isNaN(n))
        .sort((a, b) => a - b);
      const first = chapterNums[0];
      const last = chapterNums[chapterNums.length - 1];
      if (first !== undefined && last !== undefined) {
        item.chapterStart = first;
        item.chapterEnd = last;
      }
    }
    return item;
  });
}
