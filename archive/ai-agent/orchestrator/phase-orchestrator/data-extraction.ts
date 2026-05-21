/**
 * Data extraction and type guards for AI Agent Phase Orchestrator
 *
 * Handles extracting chapter/volume data from tool results
 * and updating enrichment maps.
 */

import type { ChapterEnrichmentMaps } from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/types';
import { logger } from '@/utils/logger';


import type { ChapterDataItem } from './orchestrator-types';

const log = logger.child('AIAgentOrchestrator');

/**
 * Normalize a chapter item with flexible field names into a ChapterDataItem.
 * Handles both `number` (numeric) and `chapterNumber` (string) fields,
 * plus `coverUrl`/`coverImage` → `cover`, `summary` → `description`,
 * `volumeNumber`/`volume` → `volume`.
 */
function normalizeChapterItem(item: Record<string, unknown>): ChapterDataItem | null {
  // Accept `number` (number) or `chapterNumber` (string/number)
  let num: number | undefined;
  if (typeof item['number'] === 'number') {
    num = item['number'];
  } else if (typeof item['number'] === 'string') {
    num = parseFloat(item['number']);
  } else if (typeof item['chapterNumber'] === 'string') {
    num = parseFloat(item['chapterNumber']);
  } else if (typeof item['chapterNumber'] === 'number') {
    num = item['chapterNumber'];
  }
  if (num === undefined || isNaN(num) || num <= 0) return null;

  const normalized: ChapterDataItem = { number: num };
  if (typeof item['title'] === 'string') normalized.title = item['title'];
  if (typeof item['volume'] === 'number') normalized.volume = item['volume'];
  else if (typeof item['volumeNumber'] === 'number') normalized.volume = item['volumeNumber'];
  if (typeof item['cover'] === 'string') normalized.cover = item['cover'];
  else if (typeof item['coverUrl'] === 'string') normalized.cover = item['coverUrl'];
  else if (typeof item['coverImage'] === 'string') normalized.cover = item['coverImage'];
  if (typeof item['description'] === 'string') normalized.description = item['description'];
  else if (typeof item['summary'] === 'string') normalized.description = item['summary'];
  if (typeof item['pages'] === 'number') normalized.pages = item['pages'];
  if (typeof item['releaseDate'] === 'string') normalized.releaseDate = item['releaseDate'];
  return normalized;
}

export function isValidChapterItem(item: unknown): item is ChapterDataItem {
  return (
    typeof item === 'object' &&
    item !== null &&
    'number' in item &&
    typeof (item as { number: unknown }).number === 'number'
  );
}

export function isValidVolumeItem(item: unknown): item is { number: number; description: string } {
  return (
    typeof item === 'object' &&
    item !== null &&
    'number' in item &&
    typeof (item as { number: unknown }).number === 'number' &&
    'description' in item &&
    typeof (item as { description: unknown }).description === 'string' &&
    (item as { description: string }).description.length > 0
  );
}

/* eslint-disable no-param-reassign */
export function updateMapsFromChapterItem(item: ChapterDataItem, maps: ChapterEnrichmentMaps): void {
  const chapterNum = item.number;

  if (item.title) {
    maps.chapterTitleMap[chapterNum] = item.title;
  }
  if (item.volume !== undefined) {
    maps.chapterVolumeMap[chapterNum] = item.volume;
  }
  if (item.cover) {
    maps.chapterCoverMap[chapterNum] = item.cover;
  }
  if (item.description) {
    maps.chapterDescriptionMap[chapterNum] = item.description;
  }
  if (item.pages !== undefined) {
    maps.chapterPagesMap[chapterNum] = item.pages;
  }
  if (item.releaseDate) {
    maps.chapterReleaseDateMap[chapterNum] = item.releaseDate;
  }
}
/* eslint-enable no-param-reassign */

export function extractAndUpdateChapterData(
  chapterData: unknown,
  maps: ChapterEnrichmentMaps
): void {
  if (!Array.isArray(chapterData)) {
    return;
  }

  for (const item of chapterData) {
    if (typeof item !== 'object' || item === null) continue;

    // Try direct match first, then normalize from flexible field names
    if (isValidChapterItem(item)) {
      updateMapsFromChapterItem(item, maps);
    } else {
      const normalized = normalizeChapterItem(item as Record<string, unknown>);
      if (normalized) updateMapsFromChapterItem(normalized, maps);
    }
  }
}

/**
 * Extract volume data from tool result and update enrichment maps
 */
export function extractAndUpdateVolumeData(
  volumeData: unknown,
  maps: ChapterEnrichmentMaps
): void {
  if (!Array.isArray(volumeData)) {
    return;
  }

  for (const item of volumeData) {
    if (!isValidVolumeItem(item)) {
      continue;
    }

    // eslint-disable-next-line no-param-reassign
    maps.volumeDescriptionMap[item.number] = item.description;
  }
}

/**
 * Type guard for result with data property
 */
function hasData(obj: unknown): obj is { data: unknown } {
  return typeof obj === 'object' && obj !== null && 'data' in obj;
}

/**
 * Type guard for tool result with chapterList
 */
function hasChapterList(obj: unknown): obj is { chapterList: unknown } {
  return typeof obj === 'object' && obj !== null && 'chapterList' in obj;
}

/**
 * Type guard for tool result with volumeList
 */
function hasVolumeList(obj: unknown): obj is { volumeList: unknown } {
  return typeof obj === 'object' && obj !== null && 'volumeList' in obj;
}

/**
 * Resolve the nested `data` object that holds chapterList/volumeList.
 * All enrichment tools (MangaDex, Fandom, Wikipedia) return
 * `{ data: { chapterList, volumeList } }` at the top level.
 * Falls back to the result itself if no `data` property exists.
 */
function resolveDataPayload(result: unknown): unknown {
  if (hasData(result)) return (result as { data: unknown }).data;
  // Fallback: maybe chapterList/volumeList are at the top level
  if (hasChapterList(result) || hasVolumeList(result)) return result;
  return null;
}

/** Extract chapter/volume data from wiki_scrape result into maps */
function processWikiScrapeResult(result: unknown, maps: ChapterEnrichmentMaps): void {
  const scrapeObj = result as Record<string, unknown> | null;
  if (scrapeObj?.['parseSuccess'] !== true) return;

  const parsed = scrapeObj['parsed'] as Record<string, unknown> | null;
  if (!parsed) return;

  if (hasChapterList(parsed) && Array.isArray(parsed.chapterList)) {
    extractAndUpdateChapterData(parsed.chapterList, maps);
  }
  if (hasVolumeList(parsed) && Array.isArray(parsed.volumeList)) {
    extractAndUpdateVolumeData(parsed.volumeList, maps);
  }
}

/**
 * Process tool result and update enrichment maps
 */
export function processToolResultAndUpdateMaps(
  toolName: string,
  result: unknown,
  maps: ChapterEnrichmentMaps
): void {
  log.debug('Processing tool result', { toolName, resultType: typeof result });

  // Handle different tool types
  switch (toolName) {
    case 'fandom_enrichment':
    case 'wikipedia_enrichment':
    case 'mangadex_enrichment': {
      // All enrichment tools return { data: { chapterList, volumeList } }
      const data = resolveDataPayload(result);
      if (!data) {
        log.warn('Tool result has no extractable data payload', { toolName });
        break;
      }

      if (hasChapterList(data) && Array.isArray(data.chapterList)) {
        extractAndUpdateChapterData(data.chapterList, maps);
      }
      if (hasVolumeList(data) && Array.isArray(data.volumeList)) {
        extractAndUpdateVolumeData(data.volumeList, maps);
      }
      break;
    }

    case 'wiki_scrape':
      processWikiScrapeResult(result, maps);
      break;

    case 'wiki_page_search':
    case 'wiki_url_search':
      // Search tools return URLs, not enrichment data — handled by orchestrator
      break;

    case 'similarity':
    case 'validation':
    case 'merge':
      // Supporting tools don't produce enrichment maps
      break;

    default:
      log.warn('Unknown tool name', { toolName });
  }
}
