/**
 * Fandom Adaptive Parser Bridge
 *
 * Connects the adaptive parser system (10+ specialized parsers)
 * to the enrichment pipeline's ChapterEnrichmentMaps format.
 *
 * Reads from both data sources in FandomMangaData:
 *   - chapterList (flat array with titles — primary source)
 *   - volumeList[].chapters (nested chapters — fallback for volume assignments)
 */

import { adaptiveParse } from '@/server/services/fandom/adaptive';
import type { AdaptiveParseResult } from '@/server/services/fandom/adaptive';
import { logger } from '@/utils/logger';

import type { ChapterEnrichmentMaps } from './types';

/** Try the adaptive parser with URL discovery and 10+ specialized parsers */
export async function tryAdaptiveParser(fandomUrl: string): Promise<AdaptiveParseResult | null> {
  try {
    const result = await adaptiveParse(fandomUrl, {
      fallbackToLegacy: true,
      useCache: false,
    });
    if (result.success && result.data) {
      const flatCount = result.data.chapterList?.length ?? 0;
      const nestedCount = result.data.volumeList?.reduce(
        (sum, v) => sum + (v.chapters?.length ?? 0), 0,
      ) ?? 0;
      const volumeCount = result.data.volumeList?.length ?? 0;
      const chapterCount = Math.max(flatCount, nestedCount);
      logger.info(
        `[enrichmentPipeline] Adaptive parser: ${volumeCount} volumes, ${chapterCount} chapters ` +
        `(flat=${flatCount}, nested=${nestedCount}, ` +
        `parser=${result.structureType ?? 'unknown'}, confidence=${result.confidence}, cached=${result.usedCache})`,
      );
      if (chapterCount > 0 || volumeCount > 0) return result;
    }
    logger.info(`[enrichmentPipeline] Adaptive parser returned no usable data for ${fandomUrl}`);
    return null;
  } catch (err) {
    // Surface with stack + url context for post-run diagnostics (broad-sample harness,
    // completeness loop). Previously only the message was logged, which hid useful detail.
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn(`[enrichmentPipeline] Adaptive parser error (non-fatal) for ${fandomUrl}: ${msg}`, {
      fandomUrl,
      err: err instanceof Error ? { name: err.name, message: err.message, stack: err.stack } : err,
    });
    return null;
  }
}

/** Strip HTML tags and Fandom disambiguation suffixes from chapter titles */
function cleanFandomTitle(text: string): string {
  return text
    .replace(/<[^>]*>/g, '')              // Strip HTML tags
    .replace(/\s*\(Chapter(?:\s+\d+)?\)\s*$/i, '')  // Strip "(Chapter)" or "(Chapter 2)" suffix
    .trim();
}

/** Process flat chapterList entries into enrichment maps (primary source — often has real titles) */
// eslint-disable-next-line complexity -- sequential field assignments, not branching logic
function processFlatChapterList(
  chapterList: NonNullable<NonNullable<AdaptiveParseResult['data']>['chapterList']>,
  maps: ChapterEnrichmentMaps,
): void {
  const { chapterTitleMap, chapterVolumeMap, chapterCoverMap, chapterDescriptionMap, chapterPagesMap, chapterReleaseDateMap } = maps;

  // Sort by volume number ascending so main chapters (Vol 1, 2, ...) are processed
  // before bonus/side-story chapters from later volumes that may reuse low chapter numbers
  // (e.g., Volume 34 bonus "Episode One" claiming chapter 1)
  const sorted = [...chapterList].sort((a, b) => {
    const volA = a.volumeNumber ?? a.volume ?? Infinity;
    const volB = b.volumeNumber ?? b.volume ?? Infinity;
    return volA - volB;
  });

  for (const ch of sorted) {
    const chNum = parseChapterNumber(ch.chapterNumber ?? ch.number);
    // Reject negatives; allow Ch 0 and 0.x decimals (legitimate in Dragon Ball, FMA, etc.)
    if (chNum === null || chNum < 0) continue;

    // First-writer-wins: earliest volume's entry for a chapter number takes priority,
    // preventing bonus/duplicate chapters from later volumes overwriting real data
    if (ch.title && !chapterTitleMap[chNum]) {
      const cleaned = cleanFandomTitle(ch.title);
      if (cleaned) chapterTitleMap[chNum] = cleaned;
    }
    const volNum = ch.volumeNumber ?? ch.volume;
    if (volNum !== undefined && volNum > 0 && !chapterVolumeMap[chNum]) chapterVolumeMap[chNum] = volNum;
    const coverImg = ch.coverImage ?? ch.coverUrl;
    if (coverImg && !chapterCoverMap[chNum]) chapterCoverMap[chNum] = coverImg;
    if (ch.summary && !chapterDescriptionMap[chNum]) chapterDescriptionMap[chNum] = ch.summary;
    if (ch.pages && !chapterPagesMap[chNum]) chapterPagesMap[chNum] = ch.pages;
    if (ch.releaseDate && !chapterReleaseDateMap[chNum]) chapterReleaseDateMap[chNum] = ch.releaseDate;
  }
  logger.info(`[enrichmentPipeline] Adaptive flat chapterList: ${Object.keys(chapterTitleMap).length} titles`);
}

/** Type for a single nested chapter entry */
type NestedChapter = NonNullable<NonNullable<NonNullable<AdaptiveParseResult['data']>['volumeList']>[number]['chapters']>[number];

/** Apply a single nested chapter's data into maps (gap-fill only — won't overwrite existing entries) */
function applyNestedChapter(ch: NestedChapter, volNum: number | undefined, maps: ChapterEnrichmentMaps): void {
  const chNum = parseChapterNumber(ch.chapterNumber ?? ch.number);
  if (chNum === null || chNum <= 0) return;

  const { chapterTitleMap, chapterVolumeMap, chapterCoverMap, chapterDescriptionMap, chapterPagesMap, chapterReleaseDateMap } = maps;
  const cleanedTitle = ch.title ? cleanFandomTitle(ch.title) : '';
  if (cleanedTitle && !chapterTitleMap[chNum]) chapterTitleMap[chNum] = cleanedTitle;
  if (volNum !== undefined && volNum > 0 && !chapterVolumeMap[chNum]) chapterVolumeMap[chNum] = volNum;
  if (ch.coverImage && !chapterCoverMap[chNum]) chapterCoverMap[chNum] = ch.coverImage;
  if (ch.summary && !chapterDescriptionMap[chNum]) chapterDescriptionMap[chNum] = ch.summary;
  if (ch.pages && !chapterPagesMap[chNum]) chapterPagesMap[chNum] = ch.pages;
  if (ch.releaseDate && !chapterReleaseDateMap[chNum]) chapterReleaseDateMap[chNum] = ch.releaseDate;
}

/** Process nested volumeList[].chapters into enrichment maps (fills gaps — volume assignments + extra data) */
function processNestedVolumeList(
  volumeList: NonNullable<NonNullable<AdaptiveParseResult['data']>['volumeList']>,
  maps: ChapterEnrichmentMaps,
): void {
  for (const vol of volumeList) {
    if (!vol.chapters) continue;
    const volNum = vol.volumeNumber ?? vol.number;
    for (const ch of vol.chapters) {
      applyNestedChapter(ch, volNum, maps);
    }
  }
}

/** Extract volume descriptions from volumeList into maps */
function processVolumeDescriptions(
  volumeList: NonNullable<NonNullable<AdaptiveParseResult['data']>['volumeList']>,
  maps: ChapterEnrichmentMaps,
): void {
  const { volumeDescriptionMap } = maps;
  for (const vol of volumeList) {
    const volNum = vol.volumeNumber ?? vol.number;
    if (volNum !== undefined && vol.description && !volumeDescriptionMap[volNum]) {
      volumeDescriptionMap[volNum] = vol.description;
    }
  }
}

/** Populate enrichment maps from adaptive parser results (FandomMangaData) */
export function populateMapsFromAdaptiveResult(
  result: AdaptiveParseResult,
  maps: ChapterEnrichmentMaps,
): void {
  const data = result.data;
  if (!data) return;

  if (data.chapterList && data.chapterList.length > 0) {
    processFlatChapterList(data.chapterList, maps);
  }

  if (data.volumeList) {
    processNestedVolumeList(data.volumeList, maps);
    processVolumeDescriptions(data.volumeList, maps);
  }
}

/** Parse a chapter number from string or number to a numeric value */
function parseChapterNumber(value: string | number | undefined): number | null {
  if (value === undefined) return null;
  const num = typeof value === 'number' ? value : parseFloat(value);
  return isNaN(num) ? null : num;
}
