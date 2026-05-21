/**
 * Wizard to Manga Input Mapper - Types & Validation
 */

import { logger } from '@/utils/logger';

/**
 * Input type for the manga.add mutation (matches addMangaSchema)
 */
export interface MangaAddInput {
  title: string;
  source: string;
  libraryId: number;
  interval?: 'never' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'custom';
  mangaId: string;
  searchProvider?: string;
  metadata?: {
    cover?: string;
    coverLarge?: string;
    bannerImage?: string | null;
    description?: string;
    status?: string;
    genres?: string[];
    volumes?: number | null;
    chapters?: number | null;
    urls?: string[];
    authors?: string[];
    artists?: string[];
    alternativeTitles?: string[];
    synonyms?: string[];
    tags?: string[];
    format?: string;
    idMal?: number;
    averageScore?: number;
    popularity?: number;
    startDate?: string;
    endDate?: string;
    countryOfOrigin?: string;
    publisher?: string;
    externalLinks?: Array<{ url: string; site: string }>;
    dynamicSections?: unknown;
  };
  rawProviderData?: unknown;
  providerMetadata?: unknown;
  mlCorrected?: boolean;
  selectedSourceId?: string;
  metadataConfidence?: number;
  downloadConfig?: unknown;
}

/**
 * Validate manga input before submission
 */
export function validateMangaInput(input: MangaAddInput): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!input["title"] || input["title"].trim() === '') {
    errors.push('Title is required');
  }

  if (!input["source"] || input["source"].trim() === '') {
    errors.push('Source is required');
  }

  if (!input.libraryId || input.libraryId <= 0) {
    errors.push('Valid library ID is required');
  }

  if (!input.mangaId || input.mangaId.trim() === '') {
    errors.push('Manga ID is required');
  }

  if (input["metadata"]?.volumes && input["metadata"].volumes > 10000) {
    errors.push('Volume count seems suspiciously high (might be a year value)');
  }

  if (input["metadata"]?.chapters && input["metadata"]["chapters"] > 100000) {
    errors.push('Chapter count seems suspiciously high');
  }

  if (input["metadata"]?.volumes && input["metadata"]["chapters"]) {
    if (input["metadata"]["chapters"] < input["metadata"].volumes) {
      errors.push('Chapter count cannot be less than volume count');
    }
  }

  logger.debug('Manga input validation result', { isValid: errors.length === 0, errorCount: errors.length });

  return {
    isValid: errors.length === 0,
    errors
  };
}
