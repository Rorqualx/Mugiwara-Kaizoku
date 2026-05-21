/**
 * Metadata Validator Utility
 * 
 * This utility provides functions to validate and repair manga metadata,
 * ensuring that required fields like volumes and chapters are always set
 * with valid values.
 */

import { logger } from '@/utils/logger';

/**
 * Interface for metadata with required fields for chapter table generation
 */
export interface MangaMetadataBase {
  volumes?: number | null;
  chapters?: number | null;
  [key: string]: unknown;
}

/**
 * Validates and repairs manga metadata to ensure it has valid volume and chapter counts
 * 
 * @param metadata The metadata object to validate and repair
 * @param source Optional source of the manga (e.g., 'anilist', 'comicvine')
 * @param mangaId Optional manga ID for logging purposes
 * @returns The validated and repaired metadata object
 */
export function validateAndRepairMetadata(
  metadata: MangaMetadataBase | null | undefined,
  source?: string | null,
  mangaId?: number | string
): MangaMetadataBase {
  // Create a new metadata object if none exists
  if (!metadata) {
    logger.warn(`Creating default metadata for manga${mangaId ? ` ID ${mangaId}` : ''}`);
    return {
      volumes: 1,
      chapters: 1,
      // Other default fields can be added here as needed
      coverLarge: '/cover-not-found.jpg',
      coverMedium: '/cover-not-found.jpg',
      coverSmall: '/cover-not-found.jpg',
      summary: '',
      genres: [],
      status: 'UNKNOWN',
    };
  }

  // Create a copy of the metadata to avoid mutating the original
  const repairedMetadata = { ...metadata };
  let wasRepaired = false;

  // Validate and repair volume count
  if (repairedMetadata.volumes === null || repairedMetadata.volumes === undefined || repairedMetadata.volumes <= 0) {
    logger.warn(`Repairing invalid volume count (${repairedMetadata.volumes}) for manga${mangaId ? ` ID ${mangaId}` : ''}`);
    repairedMetadata.volumes = 1;
    wasRepaired = true;
  }

  // Validate and repair chapter count
  const chaptersValue = repairedMetadata["chapters"];
  if (chaptersValue === null || chaptersValue === undefined || (typeof chaptersValue === 'number' && chaptersValue <= 0)) {
    logger.warn(`Repairing invalid chapter count (${chaptersValue}) for manga${mangaId ? ` ID ${mangaId}` : ''}`);
    repairedMetadata["chapters"] = 1;
    wasRepaired = true;
  }

  // Source-specific adjustments
  if (source) {
    // For ComicVine, use count_of_issues as chapters if available
    if (source.toLowerCase() === 'comicvine' && repairedMetadata['count_of_issues']) {
      const issueCount = repairedMetadata['count_of_issues'] as number;
      logger.debug(`Using ComicVine count_of_issues (${issueCount}) as chapter count for manga${mangaId ? ` ID ${mangaId}` : ''}`);
      repairedMetadata["chapters"] = issueCount > 0 ? issueCount : 1;
      wasRepaired = true;
    }
  }

  // Log if repairs were made
  if (wasRepaired) {
    logger.info(`Metadata repaired for manga${mangaId ? ` ID ${mangaId}` : ''}: volumes=${repairedMetadata.volumes}, chapters=${repairedMetadata["chapters"]}`);
  }

  return repairedMetadata;
}

/**
 * Checks if metadata needs repair (missing or invalid volume/chapter counts)
 * 
 * @param metadata The metadata object to check
 * @returns True if the metadata needs repair, false otherwise
 */
export function needsMetadataRepair(metadata: MangaMetadataBase | null | undefined): boolean {
  if (!metadata) {
    return true;
  }

  const volumesValue = metadata.volumes;
  const chaptersValue = metadata["chapters"];

  return (
    volumesValue === null ||
    volumesValue === undefined ||
    volumesValue <= 0 ||
    chaptersValue === null ||
    chaptersValue === undefined ||
    (typeof chaptersValue === 'number' && chaptersValue <= 0)
  );
}