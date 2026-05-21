/**
 * Manga Utility Functions
 * 
 * This file contains utility functions for working with manga entities.
 */

import type { MangaMetadata } from '../types/search.types';

/**
 * Gets the best available cover image URL from metadata
 * Falls back to progressively smaller sizes or default image
 * 
 * @param metadata - Manga metadata containing cover URLs
 * @returns URL of the best available cover image
 */
export function getBestAvailableCover(metadata: MangaMetadata | null | undefined): string {
  if (!metadata) return '/cover-not-found.jpg';

  return metadata.coverImage ??
         '/cover-not-found.jpg';
}

/**
 * Gets a thumbnail cover URL from metadata
 * Prefers thumbnail version, falls back to full cover or default
 * 
 * @param metadata - Manga metadata containing cover URLs
 * @returns URL of the thumbnail cover image
 */
export function getThumbnailCover(metadata: MangaMetadata | null | undefined): string {
  if (!metadata) return '/cover-not-found.jpg';

  return metadata.coverImage ??
         '/cover-not-found.jpg';
}

/**
 * Checks if manga has a valid cover image
 * 
 * @param metadata - Manga metadata to check
 * @returns True if manga has a valid cover URL
 */
export function hasCoverImage(metadata: MangaMetadata | null | undefined): boolean {
  if (!metadata) return false;
  
  return Boolean(metadata.coverImage);
}

/**
 * Gets the display title for a manga
 * Falls back to alternative titles if main title is not available
 * 
 * @param metadata - Manga metadata
 * @param preferredLanguage - Preferred language for alternative titles
 * @returns Display title
 */
export function getDisplayTitle(
  metadata: MangaMetadata | null | undefined,
  _preferredLanguage?: string
): string {
  if (!metadata) return 'Unknown Title';
  
  if (metadata["title"]) return metadata["title"];
  
  if (metadata["alternativeTitles"] && metadata["alternativeTitles"].length > 0) {
    // If we have a preferred language, try to find a title in that language
    // This assumes alternativeTitles might have language metadata in the future
    const firstTitle = metadata["alternativeTitles"][0];
    if (firstTitle !== undefined) {
      return firstTitle;
    }
  }
  
  return 'Unknown Title';
}

/**
 * Formats manga status for display
 * 
 * @param status - Manga status
 * @returns Formatted status string
 */
export function formatMangaStatus(status: string | undefined | null): string {
  if (!status) return 'Unknown';
  
  // Convert snake_case or UPPER_CASE to Title Case
  return status
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase());
}
