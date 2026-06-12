/**
 * Volume Batch Processing
 *
 * Handles concurrent batch fetching and processing of volume pages,
 * both from URL patterns and explicit page title lists.
 *
 * @module per-volume-iterator/batch-processing
 */

import * as cheerio from 'cheerio';

import { logger } from '@/utils/logger';

import { extractVolumeNumberFromTitle } from './allpages-discovery';

import type { VolumePageData, PerVolumeIteratorOptions } from '../per-volume-iterator';
import type { CheerioAPI } from 'cheerio';

/** Dependencies injected from the parent module to avoid circular imports */
export interface BatchDeps {
  fetchHtml: (url: string, timeoutMs: number, userAgent: string) => Promise<string | null>;
  formatVolumeNumber: (pattern: string, volNum: number) => string;
  extractChaptersFromVolumePage: (html: string, volumeNumber: number, baseUrl: string, $loaded?: CheerioAPI) => import('../per-volume-iterator').VolumePageChapter[];
  extractVolumeMetadata: (html: string, volumeNumber: number, $loaded?: CheerioAPI) => Partial<VolumePageData>;
  extractChapterSectionsFromVolumePage: (html: string, chapters: import('../per-volume-iterator').VolumePageChapter[], volumeNumber?: number, $loaded?: CheerioAPI) => void;
}

/** Process a single volume page and return structured data */
async function processVolumePage(
  baseUrl: string,
  url: string,
  volNum: number,
  options: Required<PerVolumeIteratorOptions>,
  deps: BatchDeps,
): Promise<VolumePageData | null> {
  const html = await deps.fetchHtml(url, options.timeoutMs, options.userAgent);
  if (!html) return null;

  // Parse the page once and share the DOM across the three extractors —
  // these previously each ran their own cheerio.load on the same HTML
  // (3 full DOM parses per volume page).
  const $ = cheerio.load(html);
  const chapters = deps.extractChaptersFromVolumePage(html, volNum, baseUrl, $);
  const metadata = deps.extractVolumeMetadata(html, volNum, $);
  deps.extractChapterSectionsFromVolumePage(html, chapters, volNum, $);

  const result: VolumePageData = { volumeNumber: volNum, chapters };
  if (metadata.title) result.title = metadata.title;
  if (metadata.description) result.description = metadata.description;
  if (metadata.coverImage) result.coverImage = metadata.coverImage;
  if (metadata.releaseDate) result.releaseDate = metadata.releaseDate;
  if (metadata.pageCount !== undefined) result.pageCount = metadata.pageCount;
  return result;
}

/** Params for pattern-based volume batch processing */
export interface VolumesBatchParams {
  baseUrl: string;
  urlPattern: string;
  startVolume: number;
  endVolume: number;
  options: Required<PerVolumeIteratorOptions>;
}

/**
 * Processes volumes in batches with concurrency control using URL patterns.
 */
export async function processVolumesBatch(
  params: VolumesBatchParams,
  deps: BatchDeps,
): Promise<VolumePageData[]> {
  const { baseUrl, urlPattern, startVolume, endVolume, options } = params;
  const results: VolumePageData[] = [];
  const volumeNumbers = Array.from(
    { length: endVolume - startVolume + 1 },
    (_, i) => startVolume + i,
  );

  for (let i = 0; i < volumeNumbers.length; i += options.concurrency) {
    const batch = volumeNumbers.slice(i, i + options.concurrency);

    // eslint-disable-next-line no-await-in-loop -- Batched parallel processing requires sequential batch awaits
    const batchResults = await Promise.all(
      batch.map((volNum) => {
        const url = `${baseUrl}${deps.formatVolumeNumber(urlPattern, volNum)}`;
        return processVolumePage(baseUrl, url, volNum, options, deps);
      }),
    );

    for (const result of batchResults) {
      if (result) results.push(result);
    }

    if (batchResults.every((r) => r === null)) break;
  }

  return results;
}

/**
 * Processes volumes from an explicit list of page titles (e.g., from allpages discovery).
 * Used when volume pages have subtitle-style names that don't match static patterns.
 */
export async function processVolumesFromTitles(
  baseUrl: string,
  titles: string[],
  options: Required<PerVolumeIteratorOptions>,
  deps: BatchDeps,
): Promise<VolumePageData[]> {
  const results: VolumePageData[] = [];

  for (let i = 0; i < titles.length; i += options.concurrency) {
    const batch = titles.slice(i, i + options.concurrency);

    // eslint-disable-next-line no-await-in-loop -- Batched parallel processing requires sequential batch awaits
    const batchResults = await Promise.all(
      batch.map((title) => {
        const volNum = extractVolumeNumberFromTitle(title);
        if (volNum === null) return Promise.resolve(null);

        const url = `${baseUrl}/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;
        return processVolumePage(baseUrl, url, volNum, options, deps);
      }),
    );

    for (const result of batchResults) {
      if (result) results.push(result);
    }
  }

  logger.info(`[perVolumeIterator] Processed ${results.length}/${titles.length} volume pages from title list`);
  return results;
}
