/**
 * Result builder for Fandom metadata
 *
 * Assembles the final FandomMetadata object from extracted components
 */

import { logger } from '@/utils/logger';

import type { FandomMetadata } from './types';

/**
 * Build the Fandom metadata result object
 *
 * Only includes optional fields if they have values
 *
 * @param params - Extracted metadata components
 * @returns Assembled FandomMetadata object
 */
export function buildFandomMetadataResult(params: {
  url: string;
  title?: string;
  cover?: string;
  description?: string;
  alternativeTitles?: string[];
  genres?: string[];
  authors?: string[];
  status?: string;
  myAnimeListUrl?: string;
  myAnimeListId?: number;
  startDate?: string;
  endDate?: string;
}): FandomMetadata {
  const result: FandomMetadata = { url: params.url };

  if (params.title) {
    result.title = params.title;
    logger.debug('[Fandom Result Builder] Setting title:', params.title);
  }

  if (params.cover) {
    result.cover = params.cover;
    logger.debug('[Fandom Result Builder] Setting cover:', params.cover);
  }

  if (params.description) {
    result.description = params.description;
  }

  if (params.alternativeTitles && params.alternativeTitles.length > 0) {
    result.alternativeTitles = params.alternativeTitles;
  }

  if (params.genres && params.genres.length > 0) {
    result.genres = params.genres;
  }

  if (params.authors && params.authors.length > 0) {
    result.authors = params.authors;
  }

  if (params.status) {
    result.status = params.status;
  }

  if (params.myAnimeListUrl) {
    result.myAnimeListUrl = params.myAnimeListUrl;
  }

  if (params.myAnimeListId) {
    result.myAnimeListId = params.myAnimeListId;
  }

  if (params.startDate) {
    result.startDate = params.startDate;
  }

  if (params.endDate) {
    result.endDate = params.endDate;
  }

  return result;
}
