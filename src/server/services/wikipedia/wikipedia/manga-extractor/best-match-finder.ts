/**
 * Wikipedia Best Match Finder
 *
 * High-level orchestration for finding the best matching Wikipedia page for a manga title.
 * This is the main entry point for manga data extraction, coordinating search, extraction,
 * and data enrichment across multiple Wikipedia pages.
 *
 * Phase 3: Business logic orchestration (coordinates all extraction modules).
 *
 * Refactored from: WikipediaService.ts lines 1123-1349 (227 lines)
 */

import { extractTitleVariants } from '@/components/library/library-manager/components/scan-item-detail-view/utils/title-cleaning';
import { logger } from '@/utils/logger';

import {
  selectMainPage,
  extractEnhancedVolumeData,
  mergeAdditionalVolumes,
  fetchEnrichedVolumes,
  processChapterList,
  generateMissingChapterList,
} from './best-match-finder-helpers';

import { getMangaInfo } from './index';

import type {
  WikipediaMangaData,
  WikipediaVolume,
  WikipediaChapter,
  WikipediaSearchResult,
} from '../types';

/**
 * Search for a manga page using title variants with fallback
 * Tries the full title first, then falls back to shorter variants (arc names, etc.)
 *
 * @param mangaTitle - Original manga title
 * @param searchManga - Search function
 * @returns Best matching page or null
 */
async function searchWithVariants(
  mangaTitle: string,
  searchManga: (query: string) => Promise<WikipediaSearchResult[]>
): Promise<WikipediaSearchResult | null> {
  const variants = extractTitleVariants(mangaTitle);

  logger.info(`[WIKIPEDIA] Searching with ${variants.length} title variants:`, variants);

  for (const variant of variants) {
    // eslint-disable-next-line no-await-in-loop -- Intentional: stop at first match, not search all in parallel
    const searchResults = await searchManga(variant);
    logger.info(`[WIKIPEDIA] Search "${variant}" returned ${searchResults.length} results`);

    const mainPage = selectMainPage(searchResults, variant);
    if (mainPage) {
      logger.info(`[WIKIPEDIA] Found page "${mainPage.title}" using variant "${variant}"`);
      return mainPage;
    }
  }

  return null;
}

/**
 * Find best matching Wikipedia page for a manga title
 *
 * Orchestrates the complete manga data extraction process:
 * 1. Search for the manga on Wikipedia
 * 2. Select the most relevant page (avoiding disambiguation/list pages)
 * 3. Extract detailed metadata from the main page
 * 4. Use enhanced volume extractor for rich volume/chapter data
 * 5. Follow volume list URLs for additional volumes
 * 6. Follow chapter list URLs for chapter data
 * 7. Merge and enrich all data sources
 *
 * This is a recursive extraction flow that follows links across multiple pages
 * to build the most complete dataset possible.
 *
 * @param mangaTitle - Manga title to search
 * @param searchManga - Search function to find Wikipedia pages
 * @returns Best matching page data with complete metadata or null
 */
export async function findBestMatch(
  mangaTitle: string,
  searchManga: (query: string) => Promise<WikipediaSearchResult[]>
): Promise<WikipediaMangaData | null> {
  try {
    logger.info(`[WIKIPEDIA] findBestMatch called for: "${mangaTitle}"`);

    // Step 1-2: Search with title variants and select main page
    // This tries the full title first, then falls back to shorter variants
    // (e.g., "JoJo's Bizarre Adventure Phantom Blood" -> "Phantom Blood")
    const mainPage = await searchWithVariants(mangaTitle, searchManga);

    if (!mainPage) {
      logger.info(`[WIKIPEDIA] No main page found for "${mangaTitle}" (tried all variants)`);
      return null;
    }

    logger.info(
      `[WIKIPEDIA] Selected page: "${mainPage.title}" for "${mangaTitle}"`
    );

    // Step 3: Get detailed info from the main page
    const mangaInfo = await getMangaInfo(mainPage.title);
    logger.info(`[WIKIPEDIA] getMangaInfo returned:`, {
      found: Boolean(mangaInfo),
      hasPlot: Boolean(mangaInfo?.plot),
      hasDescription: Boolean(mangaInfo?.description),
      title: mangaInfo?.title,
    });

    if (!mangaInfo) {
      return null;
    }

    // Step 4-7: Extract and enrich volume/chapter data
    const enrichedInfo = await enrichMangaData(mangaInfo, mainPage.title, mangaTitle);

    return enrichedInfo;
  } catch (error: unknown) {
    logger.error(
      `Wikipedia findBestMatch errorMessage for "${mangaTitle}": ${error instanceof Error ? error.message : String(error)}`
    );
    return null;
  }
}

/**
 * Enrich manga info with volume and chapter data from multiple sources
 *
 * @param mangaInfo - Base manga information
 * @param pageTitle - Title of the Wikipedia page
 * @param mangaTitle - Original search title
 * @returns Enriched manga information
 */
async function enrichMangaData(
  mangaInfo: WikipediaMangaData,
  pageTitle: string,
  mangaTitle: string
): Promise<WikipediaMangaData> {
  let volumesWithDetails: WikipediaVolume[] = [];
  let allChapters: WikipediaChapter[] = [];
  let updatedMangaInfo = mangaInfo;

  // Step 4: Try enhanced volume extractor
  const extractorTitle = mangaInfo.title || pageTitle || mangaTitle;
  const enhancedResult = await extractEnhancedVolumeData(extractorTitle, mangaInfo);

  if (enhancedResult.volumes.length > 0) {
    volumesWithDetails = enhancedResult.volumes;
    allChapters = enhancedResult.chapters;
    updatedMangaInfo = enhancedResult.updatedMangaInfo;

    // Step 5: Merge additional volumes from list URL if available
    if (updatedMangaInfo.volumeListUrl) {
      volumesWithDetails = await mergeAdditionalVolumes(
        volumesWithDetails,
        updatedMangaInfo.volumeListUrl
      );
    }
  } else if (mangaInfo.volumeListUrl) {
    // Step 5 (fallback): No enhanced data, fetch from volume list URL
    const enrichedVolumes = await fetchEnrichedVolumes(mangaInfo.volumeListUrl);
    volumesWithDetails = enrichedVolumes;

    // Extract chapters from enriched volumes
    enrichedVolumes.forEach((vol) => {
      if (vol.chapters.length > 0) {
        allChapters.push(...vol.chapters);
      }
    });
  }

  // Step 6: Process chapter list
  const chapterResult = await processChapterList(mangaTitle, volumesWithDetails);
  if (chapterResult.chapters.length > 0) {
    allChapters = chapterResult.chapters;
    volumesWithDetails = chapterResult.updatedVolumes;
  }

  // Step 7: Finalize manga info with all collected data
  return finalizeMangaInfo(updatedMangaInfo, volumesWithDetails, allChapters);
}

/**
 * Finalize manga info by setting volume and chapter data
 *
 * @param mangaInfo - Base manga information
 * @param volumes - Final list of volumes
 * @param chapters - Final list of chapters
 * @returns Finalized manga information
 */
/**
 * Calculate accurate chapter count from chapter list
 * Uses max chapter number + 1 (to account for chapter 0) instead of array length
 * This avoids counting duplicates and properly handles epilogues
 *
 * @param chapters - Array of chapters
 * @returns Accurate chapter count
 */
function calculateAccurateChapterCount(chapters: WikipediaChapter[]): number {
  if (chapters.length === 0) return 0;

  let maxRegularChapter = 0;
  let maxEpilogueOffset = 0;

  chapters.forEach((ch) => {
    const chNum = String(ch.number);

    // Handle epilogue chapters: "Epilogue 1", "Epilogue 2", etc.
    const epilogueMatch = chNum.match(/Epilogue\s*(\d+)?/i);
    if (epilogueMatch) {
      const epilogueNum = epilogueMatch[1] ? parseInt(epilogueMatch[1], 10) : 1;
      if (epilogueNum > maxEpilogueOffset) {
        maxEpilogueOffset = epilogueNum;
      }
      return;
    }

    // Handle regular numeric chapters
    const parsed = parseInt(chNum, 10);
    if (!isNaN(parsed) && parsed > maxRegularChapter) {
      maxRegularChapter = parsed;
    }
  });

  // Total = max regular chapter + epilogues + 1 (for chapter 0 if present)
  const total = maxRegularChapter + maxEpilogueOffset + 1;

  logger.info(`[Wikipedia] Calculated chapter count: maxRegular=${maxRegularChapter}, epilogues=${maxEpilogueOffset}, total=${total}`);

  return total;
}

function finalizeMangaInfo(
  mangaInfo: WikipediaMangaData,
  volumes: WikipediaVolume[],
  chapters: WikipediaChapter[]
): WikipediaMangaData {
  // Create a new object instead of mutating the parameter
  const result = { ...mangaInfo };

  // Set chapter list if we have chapters
  if (chapters.length > 0) {
    result.chapterList = chapters;
    // Use accurate chapter count based on max chapter number, not array length
    result.chapters = calculateAccurateChapterCount(chapters);
  } else if (volumes.length > 0) {
    // Generate chapter list from volumes if needed
    const generatedChapters = generateMissingChapterList(volumes);
    if (generatedChapters.length > 0) {
      result.chapterList = generatedChapters;
      result.chapters = calculateAccurateChapterCount(generatedChapters);
    }
  }

  // Set volume list and count
  if (volumes.length > 0) {
    logger.info(
      `📚 [WikipediaService] Setting volumeList with ${volumes.length} volumes`
    );
    volumes.slice(0, 3).forEach((vol, idx) => {
      logger.info(
        `  Volume ${idx + 1}: hasDescription=${!!vol.description}, descLength=${vol.description?.length ?? 0}`
      );
    });

    result.volumeList = volumes;
    result.volumes = volumes.length;
  }

  return result;
}
