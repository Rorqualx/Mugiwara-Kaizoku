/**
 * Volume Data Extraction Utilities
 *
 * Functions for extracting and processing volume/chapter data.
 *
 * @module components/addManga/steps/wizard/volumes-chapters/utils/volume-data
 */

import { isRecord, hasProperty } from '../types';

// ============================================================================
// Provider Volume Extraction
// ============================================================================

/**
 * Get volumes array from a provider data object
 * Returns null if no volumes found
 */
function getVolumesFromProvider(
  volumesDataObj: Record<string, unknown>,
  provider: 'direct' | 'fandom' | 'comicvine' | 'wikipedia'
): unknown[] | null {
  switch (provider) {
    case 'direct':
      return hasProperty(volumesDataObj, 'volumes') && Array.isArray(volumesDataObj['volumes'])
        ? volumesDataObj['volumes']
        : null;
    case 'fandom': {
      const fandom = hasProperty(volumesDataObj, 'fandom') && isRecord(volumesDataObj['fandom'])
        ? volumesDataObj['fandom']
        : null;
      return fandom && hasProperty(fandom, 'volumes') && Array.isArray(fandom['volumes'])
        ? fandom['volumes']
        : null;
    }
    case 'comicvine':
      return hasProperty(volumesDataObj, 'comicvine') && Array.isArray(volumesDataObj['comicvine'])
        ? volumesDataObj['comicvine']
        : null;
    case 'wikipedia': {
      const wikipedia = hasProperty(volumesDataObj, 'wikipedia') && isRecord(volumesDataObj['wikipedia'])
        ? volumesDataObj['wikipedia']
        : null;
      return wikipedia && hasProperty(wikipedia, 'volumeData') && Array.isArray(wikipedia['volumeData'])
        ? wikipedia['volumeData']
        : null;
    }
    default:
      return null;
  }
}

/**
 * Find volumes from any provider in order of priority
 */
function findVolumesFromProviders(volumesDataObj: Record<string, unknown>): unknown[] | null {
  const providers: Array<'direct' | 'fandom' | 'comicvine' | 'wikipedia'> = [
    'direct', 'fandom', 'comicvine', 'wikipedia'
  ];
  for (const provider of providers) {
    const volumes = getVolumesFromProvider(volumesDataObj, provider);
    if (volumes && volumes.length > 0) return volumes;
  }
  return null;
}

/**
 * Extract volume count from volumesData
 */
export function extractVolumeCount(volumesData: unknown): number {
  const volumesDataObj = isRecord(volumesData) ? volumesData : null;
  if (!volumesDataObj) return 0;

  const volumes = findVolumesFromProviders(volumesDataObj);
  return volumes ? volumes.length : 0;
}

// ============================================================================
// Chapter Counting
// ============================================================================

/**
 * Count chapters from ComicVine volumes array
 */
function countComicVineChapters(volumes: unknown[]): number {
  let total = 0;
  for (const vol of volumes) {
    if (!isRecord(vol)) continue;
    if (!hasProperty(vol, 'chapters')) continue;
    const chapters = vol['chapters'];
    if (Array.isArray(chapters)) {
      total += chapters.length;
    }
  }
  return total;
}

/**
 * Process a single chapter for Wikipedia chapter counting
 * Returns { isEpilogue, chapterNumber } or null if invalid
 */
function processWikipediaChapter(
  ch: unknown,
  seenChapters: Set<string>
): { isEpilogue: boolean; chapterNumber: number } | null {
  if (!isRecord(ch)) return null;

  const num = String(ch['chapterNumber'] ?? ch['number'] ?? '');
  if (!num) return null;

  // Skip duplicates
  if (seenChapters.has(num)) return null;
  seenChapters.add(num);

  // Check for epilogues
  if (num.toLowerCase().includes('epilogue')) {
    return { isEpilogue: true, chapterNumber: 0 };
  }

  // Track max regular chapter number
  const parsed = parseInt(num, 10);
  if (isNaN(parsed)) return null;

  return { isEpilogue: false, chapterNumber: parsed };
}

/**
 * Count chapters from Wikipedia volumeData using max chapter number
 * Fixes Fire Force 310 vs 305 issue by counting actual chapter numbers
 */
function countWikipediaChapters(volData: unknown[]): number {
  let maxChapter = 0;
  let epilogueCount = 0;
  const seenChapters = new Set<string>();

  for (const vol of volData) {
    if (!isRecord(vol)) continue;
    if (!hasProperty(vol, 'chapters')) continue;
    const chapters = vol['chapters'];
    if (!Array.isArray(chapters)) continue;

    for (const ch of chapters) {
      const result = processWikipediaChapter(ch, seenChapters);
      if (!result) continue;

      if (result.isEpilogue) {
        epilogueCount++;
      } else if (result.chapterNumber > maxChapter) {
        maxChapter = result.chapterNumber;
      }
    }
  }

  // Return max chapter + 1 (for chapter 0) + epilogues
  if (maxChapter > 0) {
    return maxChapter + 1 + epilogueCount;
  }
  return 0;
}

/**
 * Get direct totalChapters from object
 */
function getDirectChaptersCount(obj: Record<string, unknown>): number | null {
  const total = hasProperty(obj, 'totalChapters') ? obj['totalChapters'] : undefined;
  return typeof total === 'number' ? total : null;
}

/**
 * Get chapters from fandom data
 */
function getFandomChaptersCount(volumesDataObj: Record<string, unknown>): number | null {
  const fandom = hasProperty(volumesDataObj, 'fandom') && isRecord(volumesDataObj['fandom'])
    ? volumesDataObj['fandom']
    : null;
  return fandom ? getDirectChaptersCount(fandom) : null;
}

/**
 * Get chapters from comicvine data
 */
function getComicVineChaptersCount(volumesDataObj: Record<string, unknown>): number | null {
  const volumes = getVolumesFromProvider(volumesDataObj, 'comicvine');
  return volumes && volumes.length > 0 ? countComicVineChapters(volumes) : null;
}

/**
 * Get chapters from wikipedia data
 */
function getWikipediaChaptersCount(volumesDataObj: Record<string, unknown>): number | null {
  const wikipedia = hasProperty(volumesDataObj, 'wikipedia') && isRecord(volumesDataObj['wikipedia'])
    ? volumesDataObj['wikipedia']
    : null;
  if (!wikipedia) return null;

  const volData = getVolumesFromProvider(volumesDataObj, 'wikipedia');
  if (volData && volData.length > 0) {
    const count = countWikipediaChapters(volData);
    if (count > 0) return count;
  }

  const direct = hasProperty(wikipedia, 'chapters') ? wikipedia['chapters'] : undefined;
  return typeof direct === 'number' ? direct : null;
}

/**
 * Extract total chapters from volumesData
 * Checks providers in priority order: direct, fandom, comicvine, wikipedia
 */
export function extractTotalChapters(volumesData: unknown): number {
  const volumesDataObj = isRecord(volumesData) ? volumesData : null;
  if (!volumesDataObj) return 0;

  // Try each provider in order
  const directCount = getDirectChaptersCount(volumesDataObj);
  if (directCount !== null) return directCount;

  const fandomCount = getFandomChaptersCount(volumesDataObj);
  if (fandomCount !== null) return fandomCount;

  const comicvineCount = getComicVineChaptersCount(volumesDataObj);
  if (comicvineCount !== null) return comicvineCount;

  const wikipediaCount = getWikipediaChaptersCount(volumesDataObj);
  if (wikipediaCount !== null) return wikipediaCount;

  return 0;
}

// ============================================================================
// Scraping State
// ============================================================================

/**
 * Check if chapter scraping is in progress
 * Used to display loading state in the UI during ComicVine chapter scraping
 */
export function isScrapingChapters(volumesData: unknown): boolean {
  const volumesDataObj = isRecord(volumesData) ? volumesData : null;
  if (!volumesDataObj) return false;

  const isScrapingFlag = hasProperty(volumesDataObj, 'isScrapingChapters')
    ? volumesDataObj['isScrapingChapters']
    : undefined;

  return isScrapingFlag === true;
}

/**
 * Simple scraping progress for volumesData (different from types.ts ScrapingProgress)
 * This matches the scrapingProgress shape in VolumesData interface
 */
export interface SimpleScrapingProgress {
  current: number;
  total: number;
  message?: string;
  stage?: 'connecting' | 'api_call' | 'scraping' | 'merging' | 'complete' | 'error';
}

/**
 * Extract scraping progress from volumesData
 * Returns the progress object or undefined if not available
 */
export function extractScrapingProgress(volumesData: unknown): SimpleScrapingProgress | null {
  const volumesDataObj = isRecord(volumesData) ? volumesData : null;
  if (!volumesDataObj) return null;

  const progress = hasProperty(volumesDataObj, 'scrapingProgress')
    ? volumesDataObj['scrapingProgress']
    : undefined;

  if (!isRecord(progress)) return null;

  const current = hasProperty(progress, 'current') ? progress['current'] : undefined;
  const total = hasProperty(progress, 'total') ? progress['total'] : undefined;
  const message = hasProperty(progress, 'message') ? progress['message'] : undefined;
  const stage = hasProperty(progress, 'stage') ? progress['stage'] : undefined;

  if (typeof current !== 'number' || typeof total !== 'number') return null;

  // Build the result object
  const result: SimpleScrapingProgress = { current, total };
  if (typeof message === 'string') {
    result.message = message;
  }
  const validStages = ['connecting', 'api_call', 'scraping', 'merging', 'complete', 'error'] as const;
  if (typeof stage === 'string' && validStages.includes(stage as typeof validStages[number])) {
    result.stage = stage as typeof validStages[number];
  }
  return result;
}

/**
 * Check if volume data has existing volumes
 */
export function hasExistingVolumes(volumesData: unknown): boolean {
  const volumesDataObj = isRecord(volumesData) ? volumesData : null;
  if (!volumesDataObj) return false;

  return findVolumesFromProviders(volumesDataObj) !== null;
}
