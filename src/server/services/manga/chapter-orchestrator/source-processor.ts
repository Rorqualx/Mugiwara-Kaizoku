/**
 * Source Data Processing
 * Processes source data and routes to appropriate chapter creation function
 */

import { logger } from '@/utils/logger';

import { extractIssues, extractVolumeData, extractFandomData, extractChapters } from './data-extractors';
import { getFandomDataFromProvider, extractFandomEnrichment } from './enrichment-extractors';
import { generatePlaceholderChapters } from './placeholder-generator';

import type { ChapterEnrichment, SourceData, ImportProfile, ProviderMetadataRecord, ChapterCreationFunctions } from './types';

/**
 * Process issues data (ComicVine, etc.)
 * Complexity: 4
 */
async function processIssues(
  context: unknown,
  mangaId: number,
  issues: unknown[],
  chapterEnrichmentMap: Record<number, ChapterEnrichment> | undefined,
  chapterCreationFunctions: ChapterCreationFunctions
): Promise<boolean> {
  await chapterCreationFunctions.createChaptersFromVolumes(context, mangaId, issues, chapterEnrichmentMap);
  return true;
}

/**
 * Process ComicVine volume data
 * Complexity: 4
 */
async function processComicVineVolumes(
  context: unknown,
  mangaId: number,
  volumeData: unknown[],
  chapterEnrichmentMap: Record<number, ChapterEnrichment> | undefined,
  chapterCreationFunctions: ChapterCreationFunctions
): Promise<boolean> {
  await chapterCreationFunctions.createChaptersFromVolumes(context, mangaId, volumeData, chapterEnrichmentMap);
  return true;
}

/**
 * Process Fandom data
 * Complexity: 3
 */
async function processFandomData(
  context: unknown,
  mangaId: number,
  sourceData: SourceData,
  chapterCreationFunctions: ChapterCreationFunctions
): Promise<boolean> {
  await chapterCreationFunctions.createFandomChapters(context, mangaId, sourceData);
  return true;
}

/**
 * Process generic chapters
 * Complexity: 3
 */
async function processGenericChapters(
  context: unknown,
  mangaId: number,
  chapters: unknown[],
  chapterCreationFunctions: ChapterCreationFunctions
): Promise<boolean> {
  await chapterCreationFunctions.createGenericChapters(context, mangaId, chapters);
  return true;
}

/**
 * Process placeholder chapters
 * Complexity: 4
 */
async function processPlaceholderChapters(
  context: unknown,
  mangaId: number,
  placeholderChapters: unknown[],
  chapterCreationFunctions: ChapterCreationFunctions
): Promise<boolean> {
  await chapterCreationFunctions.createGenericChapters(context, mangaId, placeholderChapters);
  return true;
}

/**
 * Options for processing source data
 */
export interface ProcessSourceDataOptions {
  context: unknown;
  mangaId: number;
  sourceData: SourceData;
  chapterSource: string;
  importProfile: ImportProfile;
  providerMeta: ProviderMetadataRecord;
  chapterCreationFunctions: ChapterCreationFunctions;
}

/**
 * Try to process data for a specific provider
 * Returns true if data was found and processed, false otherwise
 */
// eslint-disable-next-line max-params -- Processor function requires provider context, manga ID, source data, enrichment map, and creation functions
async function tryProcessProvider(
  provider: string,
  context: unknown,
  mangaId: number,
  sourceData: SourceData,
  chapterEnrichmentMap: Record<number, ChapterEnrichment> | undefined,
  chapterCreationFunctions: ChapterCreationFunctions
): Promise<boolean> {
  const normalizedProvider = provider.toLowerCase();

  // Fandom-specific processing
  if (normalizedProvider === 'fandom') {
    const fandomSourceData = extractFandomData(sourceData);
    if (fandomSourceData) {
      logger.info(`[processSourceData] Processing chapters from user-preferred source: fandom`);
      await chapterCreationFunctions.createFandomChapters(context, mangaId, sourceData);
      return true;
    }
    return false;
  }

  // ComicVine-specific processing (uses issues or volumeData)
  if (normalizedProvider === 'comicvine') {
    const issues = extractIssues(sourceData);
    if (issues) {
      logger.info(`[processSourceData] Processing chapters from user-preferred source: comicvine (issues)`);
      await chapterCreationFunctions.createChaptersFromVolumes(context, mangaId, issues, chapterEnrichmentMap);
      return true;
    }
    const volumeData = extractVolumeData(sourceData);
    if (volumeData && volumeData.length > 0) {
      logger.info(`[processSourceData] Processing chapters from user-preferred source: comicvine (volumes)`);
      await chapterCreationFunctions.createChaptersFromVolumes(context, mangaId, volumeData, chapterEnrichmentMap);
      return true;
    }
    return false;
  }

  // Wikipedia/AniList/other providers - use volume data if available
  const volumeData = extractVolumeData(sourceData);
  if (volumeData && volumeData.length > 0) {
    logger.info(`[processSourceData] Processing chapters from user-preferred source: ${provider} (volumes)`);
    await chapterCreationFunctions.createChaptersFromVolumes(context, mangaId, volumeData, chapterEnrichmentMap);
    return true;
  }

  // Try generic chapters array
  const chapters = extractChapters(sourceData);
  if (chapters) {
    logger.info(`[processSourceData] Processing chapters from user-preferred source: ${provider} (chapters array)`);
    await chapterCreationFunctions.createGenericChapters(context, mangaId, chapters);
    return true;
  }

  return false;
}

/**
 * Process source data and create chapters using appropriate creation function
 *
 * ROUTING PRIORITY:
 * 1. User's preferred chapterSource from quick start settings (authoritative)
 * 2. If preferred source has no data, fall back to detecting available data
 */
export async function processSourceData(options: ProcessSourceDataOptions): Promise<boolean> {
  const { context, mangaId, sourceData, chapterSource, importProfile, providerMeta, chapterCreationFunctions } = options;

  // Extract Fandom enrichment for ComicVine chapter enrichment (covers, descriptions, etc.)
  const fandomData = getFandomDataFromProvider(providerMeta);
  const chapterEnrichmentMap = extractFandomEnrichment(fandomData);

  logger.info(`[processSourceData] User-preferred chapterSource: ${chapterSource}`);

  // PRIORITY 1: Try user's preferred chapter source first (authoritative)
  if (chapterSource && chapterSource !== 'unknown') {
    const processed = await tryProcessProvider(
      chapterSource,
      context,
      mangaId,
      sourceData,
      chapterEnrichmentMap,
      chapterCreationFunctions
    );
    if (processed) {
      return true;
    }
    logger.warn(`[processSourceData] User-preferred source '${chapterSource}' has no data, falling back to detection`);
  }

  // PRIORITY 2: Fallback detection - try sources in confidence order
  // This handles cases where user preference has no data

  // 2a. Try Fandom (typically has most complete chapter data)
  const fandomSourceData = extractFandomData(sourceData);
  if (fandomSourceData) {
    logger.info(`[processSourceData] Fallback: Using Fandom data`);
    return processFandomData(context, mangaId, sourceData, chapterCreationFunctions);
  }

  // 2b. Try ComicVine issues
  const issues = extractIssues(sourceData);
  if (issues) {
    logger.info(`[processSourceData] Fallback: Using ComicVine issues`);
    return processIssues(context, mangaId, issues, chapterEnrichmentMap, chapterCreationFunctions);
  }

  // 2c. Try volume data (ComicVine, Wikipedia, etc.)
  const volumeData = extractVolumeData(sourceData);
  if (volumeData && volumeData.length > 0) {
    logger.info(`[processSourceData] Fallback: Using volume data (${volumeData.length} volumes)`);
    return processComicVineVolumes(context, mangaId, volumeData, chapterEnrichmentMap, chapterCreationFunctions);
  }

  // 2d. Try generic chapters array
  const chapters = extractChapters(sourceData);
  if (chapters) {
    logger.info(`[processSourceData] Fallback: Using generic chapters array`);
    return processGenericChapters(context, mangaId, chapters, chapterCreationFunctions);
  }

  // PRIORITY 3: Generate placeholder chapters as last resort
  const placeholderChapters = generatePlaceholderChapters(importProfile);
  if (placeholderChapters) {
    logger.info(`[processSourceData] Fallback: Generating placeholder chapters`);
    return processPlaceholderChapters(context, mangaId, placeholderChapters, chapterCreationFunctions);
  }

  return false;
}
