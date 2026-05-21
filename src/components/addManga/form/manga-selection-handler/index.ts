/**
 * Manga Selection Handler - Main Orchestrator
 *
 * This is the main entry point for the manga selection handler module.
 * It coordinates all extraction and building functions to process
 * selected manga data and transform it into form values and component state.
 *
 * @module components/addManga/form/manga-selection-handler
 */

import type { MangaSearchResult, ExtendedMangaSearchResult } from '@/types/search.types';
import { toStringId } from '@/utils/id-converters';
import { logger } from '@/utils/logger';

// Re-export all types for backward compatibility
export type {
  VolumeDetail,
  ParsedVolumeData,
  PublisherObject,
  MetadataObject,
  RawDataObject,
  ProviderSpecificObject,
  MangaWithDynamicMetadata,
  FormType,
  MangaSelectionResult,
  ComicVineData,
} from './types';

// Re-export all extraction functions
export {
  extractCoverUrl,
  extractBasicMetadata,
  extractParsedVolumeData,
  extractComicVineData,
} from './extractors';

// Re-export all build functions
export {
  buildFormUpdate,
  buildSelectedManga,
} from './builders';

// Import types and functions needed for the orchestrator
import {
  buildFormUpdate,
  buildSelectedManga,
} from './builders';
import {
  extractCoverUrl,
  extractBasicMetadata,
  extractParsedVolumeData,
  extractComicVineData,
} from './extractors';

import type {
  FormType,
  MangaSelectionResult,
  ComicVineData,
  MangaWithDynamicMetadata,
} from './types';



/**
 * Log manga selection details for debugging
 *
 * @param params - Object containing manga and extracted data
 */
function logMangaSelection(params: {
  manga: MangaSearchResult | ExtendedMangaSearchResult;
  source: string;
  comicVineData: ComicVineData;
}): void {
  const { manga, source, comicVineData } = params;
  const mangaTyped = manga as MangaWithDynamicMetadata;
  const metadataTyped = mangaTyped.metadata;

  logger.info('Form.tsx handleMangaSelect - Received manga:', { data: manga });
  logger.info('Form.tsx handleMangaSelect - Direct issues:', { data: mangaTyped.issues });
  logger.info('Form.tsx handleMangaSelect - Metadata issues:', { data: metadataTyped?.issues });
  logger.info('Form.tsx handleMangaSelect - ProviderSpecific issues:', { data: mangaTyped.providerSpecific?.issues });

  logger.info('Form storing selected manga with data:', {
    title: manga.title,
    source: source,
    hasIssues: Boolean(comicVineData.issues),
    issueCount: Array.isArray(comicVineData.issues) ? comicVineData.issues.length : 0,
    hasCharacters: Boolean(comicVineData.characters),
    charactersCount: Array.isArray(comicVineData.characters) ? comicVineData.characters.length : 0,
    hasCreators: Boolean(comicVineData.creators),
    creatorsCount: Array.isArray(comicVineData.creators) ? comicVineData.creators.length : 0,
    hasPublisher: Boolean(comicVineData.publisher),
    hasMetadata: Boolean('metadata' in manga && manga.metadata),
    hasProviderSpecific: Boolean(mangaTyped.providerSpecific),
    metadataIssues: metadataTyped && Array.isArray(metadataTyped.issues) ? metadataTyped.issues.length : 0,
    providerSpecificIssues: mangaTyped.providerSpecific && Array.isArray(mangaTyped.providerSpecific.issues)
      ? (mangaTyped.providerSpecific.issues as unknown[]).length
      : 0
  });
}

/**
 * Main orchestrator function for processing manga selection
 * Coordinates all extraction functions and builds the final result
 *
 * @param manga - The selected manga object
 * @param currentFormValues - Current form values to merge with
 * @param fallbackSource - Fallback source value if not found in manga
 * @returns MangaSelectionResult containing form update and selected manga
 */
export function processMangaSelection(
  manga: MangaSearchResult | ExtendedMangaSearchResult,
  currentFormValues: FormType,
  fallbackSource: string
): MangaSelectionResult {
  // Validate manga object
  if (typeof manga !== 'object') {
    throw new Error('Invalid manga object provided to processMangaSelection');
  }

  if (!manga.id || !manga.title) {
    throw new Error('Manga object missing required id or title fields');
  }

  logger.info(`Manga selected: "${manga.title}" (ID: ${toStringId(manga.id)})`);

  // Determine the source/provider with type guards
  const source = 'provider' in manga && typeof manga.provider === 'string'
    ? manga.provider
    : 'source' in manga && typeof manga.source === 'string'
      ? manga.source
      : fallbackSource;

  // Extract all data
  const coverUrl = extractCoverUrl(manga);
  const basicMetadata = extractBasicMetadata(manga);
  const parsedVolumeData = extractParsedVolumeData(manga);
  const comicVineData = extractComicVineData(manga);

  // Build form update
  const formUpdate = buildFormUpdate({
    currentFormValues,
    manga,
    source,
    coverUrl,
    basicMetadata,
    parsedVolumeData,
    comicVineData
  });

  // Build selected manga
  const selectedManga = buildSelectedManga({
    manga,
    source,
    basicMetadata,
    comicVineData
  });

  // Log selection details
  logMangaSelection({
    manga,
    source,
    comicVineData
  });

  return { formUpdate, selectedManga };
}
