/**
 * Volume Data Normalizer
 *
 * Normalizes volume/issue data from any provider into a common structure.
 * Supports: ComicVine, Fandom, AniList, Wikipedia, and other providers.
 */

import {
  extractVolumeNumber,
  extractTitle,
  extractCoverImage,
  extractDownloadUrl,
  extractReleaseDate,
  extractDescription,
  extractChapters,
} from './field-extractors';

/**
 * Normalized volume data interface
 * Provides a common structure regardless of provider
 */
export interface NormalizedVolume {
  volumeNumber: number;
  title?: string;
  coverImage?: string;
  downloadUrl?: string;
  releaseDate?: string;
  description?: string;
  chapters?: unknown[];
}

/**
 * Normalize volume/issue data from any provider into a common structure
 *
 * This function takes raw volume data from various providers (ComicVine, Fandom,
 * AniList, Wikipedia, etc.) and normalizes it into a common structure by
 * extracting fields using multiple fallback field names.
 *
 * @param volume - The raw volume data object from any provider
 * @param index - The index in the volumes array (used as fallback for volume number)
 * @returns Normalized volume data with consistent field names
 */
export function normalizeVolumeData(
  volume: Record<string, unknown>,
  index: number
): NormalizedVolume {
  const volumeNumber = extractVolumeNumber(volume, index);
  const title = extractTitle(volume);
  const coverImage = extractCoverImage(volume);
  const downloadUrl = extractDownloadUrl(volume);
  const releaseDate = extractReleaseDate(volume);
  const description = extractDescription(volume);
  const chapters = extractChapters(volume);

  return {
    volumeNumber,
    ...(title !== undefined ? { title } : {}),
    ...(coverImage !== undefined ? { coverImage } : {}),
    ...(downloadUrl !== undefined ? { downloadUrl } : {}),
    ...(releaseDate !== undefined ? { releaseDate } : {}),
    ...(description !== undefined ? { description } : {}),
    ...(chapters !== undefined ? { chapters } : {}),
  };
}

// Re-export field extractors for direct use if needed
export {
  extractVolumeNumber,
  extractTitle,
  extractCoverImage,
  extractDownloadUrl,
  extractReleaseDate,
  extractDescription,
  extractChapters,
};
