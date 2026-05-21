/**
 * Metadata Extraction Utilities
 *
 * Functions for extracting provider-specific metadata.
 *
 * @module components/addManga/steps/wizard/volumes-chapters/utils/metadata-extraction
 */

import { isRecord } from '../types';

/**
 * Extract Fandom metadata with case-insensitive key check
 */
export function extractFandomMetadata(
  selectedSourcesMetadata: Record<string, unknown>
): Record<string, unknown> | undefined {
  const meta =
    selectedSourcesMetadata['fandom'] ??
    selectedSourcesMetadata['FANDOM'] ??
    selectedSourcesMetadata['Fandom'];
  return isRecord(meta) ? meta : undefined;
}

/**
 * Extract ComicVine metadata with case-insensitive key check
 */
export function extractComicVineMetadata(
  selectedSourcesMetadata: Record<string, unknown>
): Record<string, unknown> | undefined {
  const meta =
    selectedSourcesMetadata['comicvine'] ??
    selectedSourcesMetadata['COMICVINE'] ??
    selectedSourcesMetadata['ComicVine'];

  return isRecord(meta) ? meta : undefined;
}

/**
 * Extract Wikipedia metadata with case-insensitive key check
 */
export function extractWikipediaMetadata(
  selectedSourcesMetadata: Record<string, unknown>
): Record<string, unknown> | undefined {
  const meta =
    selectedSourcesMetadata['wikipedia'] ??
    selectedSourcesMetadata['WIKIPEDIA'] ??
    selectedSourcesMetadata['Wikipedia'];
  return isRecord(meta) ? meta : undefined;
}

/**
 * Extract MangaDex metadata with case-insensitive key check
 */
export function extractMangaDexMetadata(
  selectedSourcesMetadata: Record<string, unknown>
): Record<string, unknown> | undefined {
  const meta =
    selectedSourcesMetadata['mangadex'] ??
    selectedSourcesMetadata['MANGADEX'] ??
    selectedSourcesMetadata['MangaDex'];
  return isRecord(meta) ? meta : undefined;
}
