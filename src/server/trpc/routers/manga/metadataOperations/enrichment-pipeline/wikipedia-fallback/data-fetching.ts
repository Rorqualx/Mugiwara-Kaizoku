/**
 * Wikipedia data fetching
 */

import { prisma } from '@/server/db';
import { logParseFailure } from '@/server/services/metadata/parse-failure-logger';
import type { WikipediaParseResult } from '@/server/services/wikipedia/adaptive/types';
import type { WikipediaMangaData, WikipediaChapter } from '@/server/services/wikipedia/wikipedia/types';
import { logger } from '@/utils/logger';

/** Fetch alternative titles (synonyms) from the manga's metadata */
export async function fetchAlternativeTitles(mangaId: number): Promise<string[]> {
  const manga = await prisma.manga.findUnique({
    where: { id: mangaId },
    include: { Metadata: { select: { synonyms: true } } },
  });
  return manga?.Metadata?.synonyms ?? [];
}

/** Fetch Wikipedia data using findBestMatch + adaptiveExtract, merge results.
 *  findBestMatch runs first (API-based — best chapter-to-volume assignments).
 *  Adaptive supplements gaps (descriptions, metadata). */
/**
 * Continuation titles whose chapters should be merged with the main title.
 * Handles series like Dragon Ball where Wikipedia splits the chapter list
 * into "List of Dragon Ball chapters" + "List of Dragon Ball Z chapters".
 */
const CONTINUATION_TITLES: Record<string, string[]> = {
  'Dragon Ball': ['Dragon Ball Z'],
};

type WikipediaFetchHints = {
  knownPageTitle?: string;
  anilistId?: number;
  malId?: number;
  anilistChapters?: number;
  malChapters?: number;
  mangadexChapters?: number;
};

type WikipediaService = { findBestMatch: (t: string) => Promise<WikipediaMangaData | null> };
type AdaptiveExtractFn = (t: string) => Promise<WikipediaParseResult>;

export async function fetchWikipediaData(
  title: string,
  hints?: WikipediaFetchHints,
): Promise<WikipediaMangaData | null> {
  const { adaptiveExtract } = await import('@/server/services/wikipedia/wikipedia/manga-extractor');
  const { wikipediaService } = await import('@/server/services/wikipedia/wikipedia/service');

  // When a known Wikipedia page title is provided (e.g., from Wikidata), use it
  // as the primary lookup title — vastly improves discovery for titles where
  // AniList romaji doesn't match Wikipedia article names.
  const lookupTitle = hints?.knownPageTitle ?? title;

  // Stage 1: findBestMatch first (API-based — best chapter-to-volume assignments)
  let mergedData = await tryFindBestMatch(lookupTitle, wikipediaService, null);

  // Stage 2: Adaptive extraction supplements gaps (descriptions, metadata)
  const discoveredPageTitle = mergedData?.title ?? undefined;
  mergedData = await tryAdaptiveSupplementation(lookupTitle, adaptiveExtract, mergedData, discoveredPageTitle);

  // Stage 2.5a: Wikidata fallback when both prior stages returned nothing
  mergedData ??= await tryWikidataFallback(title, lookupTitle, hints, wikipediaService, adaptiveExtract);

  // Stage 2.5b: Replace chapter list with placeholder fill when extraction is <30% of expected
  if (mergedData) {
    const flooredList = computeFlooredChapterList(mergedData, hints);
    if (flooredList) mergedData.chapterList = flooredList;
  }

  // Stage 3: Merge continuation titles (e.g., Dragon Ball + Dragon Ball Z)
  mergedData = await mergeContinuationData(title, mergedData);

  // Stage 4: Post-merge gap-fill — extend extracted chapters to best known count
  if (mergedData?.chapterList?.length) {
    const gapItems = computeGapFillItems(mergedData, hints);
    if (gapItems.length > 0) mergedData.chapterList.push(...gapItems);
  }

  return mergedData;
}

/**
 * Stage 2.5a: resolve a Wikipedia article title via Wikidata SPARQL using
 * AniList/MAL IDs, then re-run findBestMatch + adaptive against it.
 * Returns null on any failure or when no usable Wikidata title comes back.
 */
async function tryWikidataFallback(
  title: string,
  lookupTitle: string,
  hints: WikipediaFetchHints | undefined,
  wikipediaService: WikipediaService,
  adaptiveExtract: AdaptiveExtractFn,
): Promise<WikipediaMangaData | null> {
  if (!hints?.anilistId && !hints?.malId) return null;
  try {
    const { resolveWikipediaTitle } = await import('@/server/services/wikipedia/wikidata/article-resolver');
    const wikidataTitle = await resolveWikipediaTitle(hints.anilistId, hints.malId);
    if (!wikidataTitle || wikidataTitle === lookupTitle) return null;
    logger.info(`[enrichmentPipeline] Wikidata fallback: resolved "${title}" -> "${wikidataTitle}"`);
    const fromBestMatch = await tryFindBestMatch(wikidataTitle, wikipediaService, null);
    return fromBestMatch ?? await tryAdaptiveSupplementation(wikidataTitle, adaptiveExtract, null);
  } catch {
    return null;
  }
}

/**
 * Pick the best non-zero chapter count from infobox / AniList / MAL / MangaDex
 * (in that priority order) for use by Stage 2.5b and Stage 4.
 */
function pickBestChapterCount(
  data: WikipediaMangaData,
  hints: WikipediaFetchHints | undefined,
): { count: number; source: string } {
  const sources: Array<[number, string]> = [
    [data.chapters ?? 0, 'infobox'],
    [hints?.anilistChapters ?? 0, 'anilist'],
    [hints?.malChapters ?? 0, 'mal'],
    [hints?.mangadexChapters ?? 0, 'mangadex'],
  ];
  const best = sources.find(([n]) => n > 0);
  return { count: best?.[0] ?? 0, source: best?.[1] ?? 'unknown' };
}

/**
 * Stage 2.5b: when extracted chapter count is <30% of the best external count,
 * return a generic [Chapter 1..N] sequence preserving any extracted chapters
 * with real metadata at their original numbers. Returns null when no replacement
 * is needed.
 */
function computeFlooredChapterList(
  data: WikipediaMangaData,
  hints: WikipediaFetchHints | undefined,
): WikipediaChapter[] | null {
  const extracted = data.chapterList?.length ?? 0;
  const { count: bestCount, source } = pickBestChapterCount(data, hints);
  if (bestCount <= 0 || bestCount > 2000 || extracted >= bestCount * 0.3) return null;

  const existingChapters = data.chapterList ?? [];
  const existingMap = new Map<number, WikipediaChapter>();
  for (const ch of existingChapters) {
    if (typeof ch.number === 'number') existingMap.set(ch.number, ch);
  }
  const filled: WikipediaChapter[] = [];
  for (let i = 1; i <= bestCount; i++) {
    filled.push(existingMap.get(i) ?? { number: i, title: `Chapter ${i}` });
  }
  logger.info(`[enrichmentPipeline] Wikipedia ${source} fill: ${extracted} → ${bestCount} chapters (${existingMap.size} preserved)`);
  return filled;
}

/**
 * Stage 4: build the trailing [Chapter N+1 .. target] entries needed to extend
 * a non-empty chapter list to the best known external count. Returns an empty
 * array when no fill is needed (Stage 2.5b handles the <30% case via replacement).
 */
function computeGapFillItems(
  data: WikipediaMangaData,
  hints: WikipediaFetchHints | undefined,
): WikipediaChapter[] {
  if (!data.chapterList?.length) return [];
  const extracted = data.chapterList.length;
  const { count: targetCount, source } = pickBestChapterCount(data, hints);
  if (targetCount <= 0 || targetCount <= extracted) return [];

  const maxNum = Math.max(...data.chapterList.map(
    ch => typeof ch.number === 'number' ? ch.number : 0,
  ));
  const items: WikipediaChapter[] = [];
  for (let i = maxNum + 1; i <= maxNum + (targetCount - extracted); i++) {
    items.push({ number: i, title: `Chapter ${i}` });
  }
  logger.info(`[enrichmentPipeline] Wikipedia gap-fill (${source}): ${extracted}→${extracted + items.length} (target: ${targetCount})`);
  return items;
}

/** Fetch and merge continuation titles (e.g., Dragon Ball Z) into existing data */
async function mergeContinuationData(
  title: string,
  existing: WikipediaMangaData | null,
): Promise<WikipediaMangaData | null> {
  const continuations = CONTINUATION_TITLES[title];
  if (!continuations || !existing) return existing;

  const result = { ...existing };

  for (const contTitle of continuations) {
    logger.info(`[enrichmentPipeline] Wikipedia: fetching continuation "${contTitle}"`);
    // eslint-disable-next-line no-await-in-loop -- Sequential continuation fetch
    const contData = await fetchWikipediaData(contTitle);
    if (!contData?.chapterList?.length) continue;

    // Merge continuation chapters (dedup by chapter number)
    const byNumber = new Map<number, WikipediaChapter>();
    for (const ch of result.chapterList ?? []) {
      const num = typeof ch.number === 'number' ? ch.number : parseFloat(String(ch.number));
      if (!isNaN(num)) byNumber.set(num, ch);
    }
    for (const ch of contData.chapterList) {
      const num = typeof ch.number === 'number' ? ch.number : parseFloat(String(ch.number));
      if (!isNaN(num) && !byNumber.has(num)) byNumber.set(num, ch);
    }
    result.chapterList = [...byNumber.values()].sort((a, b) => {
      const aNum = typeof a.number === 'number' ? a.number : parseFloat(String(a.number));
      const bNum = typeof b.number === 'number' ? b.number : parseFloat(String(b.number));
      return aNum - bNum;
    });

    // Merge continuation volumes
    if (contData.volumeList?.length) {
      const existingVolNums = new Set((result.volumeList ?? []).map(v => v.number));
      const newVols = contData.volumeList.filter(v => !existingVolNums.has(v.number));
      result.volumeList = [...(result.volumeList ?? []), ...newVols].sort((a, b) => a.number - b.number);
    }

    logger.info(`[enrichmentPipeline] Wikipedia: merged "${contTitle}" → ${result.chapterList.length} total chapters`);
  }

  return result;
}

/** Try findBestMatch (API-based — best chapter-to-volume assignments) */
export async function tryFindBestMatch(
  title: string,
  wikipediaService: { findBestMatch: (t: string) => Promise<WikipediaMangaData | null> },
  existing: WikipediaMangaData | null,
): Promise<WikipediaMangaData | null> {
  try {
    const bestMatch = await wikipediaService.findBestMatch(title);
    if (!bestMatch) return existing;

    logger.info(`[enrichmentPipeline] Wikipedia findBestMatch: ${bestMatch.chapterList?.length ?? 0} chapters, ${bestMatch.volumeList?.length ?? 0} volumes`);

    if (!existing) return bestMatch;

    // Supplement gaps from bestMatch into a merged copy
    const merged: WikipediaMangaData = { ...existing };
    if ((!merged.chapterList || merged.chapterList.length === 0) && bestMatch.chapterList?.length) {
      merged.chapterList = bestMatch.chapterList;
    }
    if ((!merged.volumeList || merged.volumeList.length === 0) && bestMatch.volumeList?.length) {
      merged.volumeList = bestMatch.volumeList;
    }
    return merged;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.debug(`[enrichmentPipeline] Wikipedia findBestMatch failed:`, error);
    void logParseFailure({
      source: 'wikipedia',
      stage: 'wikipedia-fallback.findBestMatch',
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}`,
      reason: msg,
      context: { title, hasExisting: existing !== null },
    });
    return existing;
  }
}

/** Try adaptive extraction, supplementing gaps in existing data.
 *  For chapters: only override if adaptive has significantly more (>10%).
 *  For volumes: supplement descriptions from adaptive into existing volumes. */
/** Retry adaptive extraction with the page title discovered by findBestMatch.
 *  Only retries when current extraction is <50% of declared infobox count. */
async function retryAdaptiveWithDiscoveredTitle(
  existing: WikipediaMangaData,
  adaptiveExtract: (t: string) => Promise<WikipediaParseResult>,
  title: string,
  discoveredPageTitle?: string,
): Promise<WikipediaMangaData['chapterList'] | null> {
  const existingCount = existing.chapterList?.length ?? 0;
  const declaredCount = existing.chapters ?? 0;
  if (!discoveredPageTitle || discoveredPageTitle === title) return null;
  if (declaredCount <= 0 || existingCount >= declaredCount * 0.5) return null;

  try {
    const retryResult = await adaptiveExtract(discoveredPageTitle);
    const retryChapters = retryResult.success ? retryResult.data?.chapterList : undefined;
    const retryCount = retryChapters?.length ?? 0;
    if (retryCount > existingCount && retryChapters) {
      logger.info(`[enrichmentPipeline] Wikipedia adaptive retry: ${existingCount}→${retryCount} using "${discoveredPageTitle}"`);
      return retryChapters;
    }
  } catch {
    // Retry failed
  }
  return null;
}

export async function tryAdaptiveSupplementation(
  title: string,
  adaptiveExtract: (t: string) => Promise<WikipediaParseResult>,
  existing: WikipediaMangaData | null,
  discoveredPageTitle?: string,
): Promise<WikipediaMangaData | null> {
  try {
    const result = await adaptiveExtract(title);
    if (!result.success || !result.data) return existing;

    const adaptiveData: WikipediaMangaData = { ...result.data };
    if ((!adaptiveData.volumeList || adaptiveData.volumeList.length === 0) && result.volumes.length > 0) {
      adaptiveData.volumeList = result.volumes;
    }
    if ((!adaptiveData.chapterList || adaptiveData.chapterList.length === 0) && result.chapters.length > 0) {
      adaptiveData.chapterList = result.chapters;
    }

    logger.info(`[enrichmentPipeline] Wikipedia adaptive: ${adaptiveData.chapterList?.length ?? 0} chapters, ${adaptiveData.volumeList?.length ?? 0} volumes`);

    if (!existing) return adaptiveData;

    const merged = mergeAdaptiveIntoExisting(existing, adaptiveData);

    // Retry with discovered page title when extraction is insufficient
    const retryChapters = await retryAdaptiveWithDiscoveredTitle(merged, adaptiveExtract, title, discoveredPageTitle);
    if (retryChapters) {
      merged.chapterList = retryChapters;
    }

    return merged;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.debug(`[enrichmentPipeline] Wikipedia adaptive extraction failed:`, error);
    void logParseFailure({
      source: 'wikipedia',
      stage: 'wikipedia-fallback.tryAdaptiveSupplementation',
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}`,
      reason: msg,
      context: { title, discoveredPageTitle, hasExisting: existing !== null },
    });
    return existing;
  }
}

/** Enrich existing volumes with descriptions from adaptive data */
export function supplementVolumeDescriptions(
  existingVolumes: WikipediaMangaData['volumeList'],
  adaptiveVolumes: WikipediaMangaData['volumeList'],
): void {
  if (!existingVolumes?.length || !adaptiveVolumes?.length) return;

  for (const vol of existingVolumes) {
    if (vol.description) continue;
    const adaptiveVol = adaptiveVolumes.find(v => v.number === vol.number);
    if (adaptiveVol?.description) {
      vol.description = adaptiveVol.description;
    }
  }
}

/** Check if a chapter title is a generic placeholder like "Chapter 5" */
export function isPlaceholderTitle(title: string | undefined): boolean {
  if (!title) return true;
  return /^Chapter\s+\d+$/i.test(title);
}

/** Supplement chapter-level metadata (titles, release dates, pages)
 *  from adaptive chapters into findBestMatch chapters, matched by chapter number.
 *  Keeps findBestMatch volume assignments but gets richer metadata from adaptive. */
export function supplementChapterMetadata(
  chapters: WikipediaChapter[],
  adaptiveChapters: WikipediaChapter[],
): void {
  if (adaptiveChapters.length === 0) return;

  // Build lookup by chapter number for O(1) matching
  const adaptiveByNum = new Map<number, WikipediaChapter>();
  for (const ch of adaptiveChapters) {
    const num = typeof ch.number === 'number' ? ch.number : parseFloat(String(ch.number));
    if (!isNaN(num)) adaptiveByNum.set(num, ch);
  }

  let supplemented = 0;
  for (const ch of chapters) {
    const num = typeof ch.number === 'number' ? ch.number : parseFloat(String(ch.number));
    if (isNaN(num)) continue;

    const adaptiveCh = adaptiveByNum.get(num);
    if (!adaptiveCh) continue;

    // Supplement title if current is missing or placeholder
    if (isPlaceholderTitle(ch.title) && adaptiveCh.title && !isPlaceholderTitle(adaptiveCh.title)) {
      ch.title = adaptiveCh.title;
      supplemented++;
    }
    // Supplement release date if missing
    if (!ch.releaseDate && adaptiveCh.releaseDate) ch.releaseDate = adaptiveCh.releaseDate;
    // Supplement pages if missing
    if (!ch.pages && adaptiveCh.pages) ch.pages = adaptiveCh.pages;
  }

  if (supplemented > 0) {
    logger.info(`[enrichmentPipeline] Wikipedia merge: supplemented ${supplemented} chapter titles from adaptive`);
  }
}

/** Merge adaptive extraction data into existing findBestMatch data.
 *  Strategy: ALWAYS keep findBestMatch chapter-to-volume assignments (most reliable),
 *  and supplement titles/metadata from adaptive (richer extraction).
 *  Adaptive's volume assignments are often unreliable (greedy pattern matching),
 *  while findBestMatch uses structured HTML parsing (<ol start=N> format). */
export function mergeAdaptiveIntoExisting(
  existing: WikipediaMangaData,
  adaptiveData: WikipediaMangaData,
): WikipediaMangaData {
  const merged: WikipediaMangaData = { ...existing };

  const replacement = pickAdaptiveChapterReplacement(merged.chapterList, existing.chapters, adaptiveData.chapterList);
  if (replacement) {
    merged.chapterList = replacement;
  } else if (merged.chapterList?.length && adaptiveData.chapterList?.length) {
    // Keep findBestMatch chapters (reliable volume assignments), supplement from adaptive
    supplementChapterMetadata(merged.chapterList, adaptiveData.chapterList);
    logger.info(`[enrichmentPipeline] Wikipedia merge: kept findBestMatch chapters (${merged.chapterList.length}), supplemented from adaptive (${adaptiveData.chapterList.length})`);
  }

  // For volumes: supplement if missing
  if (!merged.volumeList?.length && adaptiveData.volumeList?.length) {
    merged.volumeList = adaptiveData.volumeList;
  }

  // Supplement volume descriptions from adaptive (it's good at extracting these)
  supplementVolumeDescriptions(merged.volumeList, adaptiveData.volumeList);

  // Supplement other metadata gaps
  if (!merged.description && adaptiveData.description) merged.description = adaptiveData.description;
  if (!merged.plot && adaptiveData.plot) merged.plot = adaptiveData.plot;

  return merged;
}

/**
 * Decide whether adaptive chapters should replace existing findBestMatch chapters:
 *   - replace when existing was empty,
 *   - replace when findBestMatch under-delivered vs the declared infobox count,
 *   - replace when adaptive found 50%+ more chapters,
 *   - otherwise return null (caller keeps existing and supplements metadata).
 */
function pickAdaptiveChapterReplacement(
  existingChapters: WikipediaChapter[] | undefined,
  declaredCount: number | undefined,
  adaptiveChapters: WikipediaChapter[] | undefined,
): WikipediaChapter[] | null {
  if (!adaptiveChapters?.length) return null;

  const existingCount = existingChapters?.length ?? 0;
  const adaptiveCount = adaptiveChapters.length;
  const declared = declaredCount ?? 0;

  if (existingCount === 0) {
    logger.info(`[enrichmentPipeline] Wikipedia merge: using adaptive chapters (${adaptiveCount}, no existing)`);
    return adaptiveChapters;
  }
  if (declared > 0 && existingCount < declared * 0.3 && adaptiveCount > existingCount) {
    logger.info(`[enrichmentPipeline] Wikipedia merge: infobox-forced adaptive (existing ${existingCount} = ${Math.round(existingCount / declared * 100)}% of declared ${declared}, adaptive ${adaptiveCount})`);
    return adaptiveChapters;
  }
  if (adaptiveCount > existingCount * 1.5) {
    // findBestMatch likely got partial/summary data (e.g., Naruto: findBestMatch=12
    // from volumes page, adaptive=432 from chapter sub-pages)
    logger.info(`[enrichmentPipeline] Wikipedia merge: replaced findBestMatch (${existingCount}) with adaptive (${adaptiveCount})`);
    return adaptiveChapters;
  }
  return null;
}