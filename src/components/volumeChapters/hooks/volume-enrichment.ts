/**
 * Volume Data Enrichment Hook
 *
 * Enriches volume modal data from multiple provider sources.
 * Decomposed from original 232-line function into focused extractors.
 *
 * Extracted from: hooks.ts (lines 306-559)
 */

import { useMemo } from 'react';


import { logger } from '@/utils/logger';

import {
  safeParseProviderMetadata,
  extractVolumeSource,
  createEnrichedChaptersFromDatabase,
  createEnrichedChaptersFromVolumeData,
  createEnrichedChaptersFromProvider
} from './volume-enrichment-types';

import type { VolumeData, ParsedProviderMetadata } from '../types';
import type { EnrichedVolumeData, EnrichedChapter, VolumeEnrichmentParams } from './volume-enrichment-types';
import type { Chapter } from '@prisma/client';

// ============================================================================
// ComicVine Extraction Params
// ============================================================================

/**
 * Parameters for ComicVine extraction
 * Reduces function parameter count from 6 to 1
 */
interface ComicVineExtractionParams {
  metadata: ParsedProviderMetadata;
  volumeNumber: number;
  volumeTitle: string | null | undefined;
  volumeCover: string | null | undefined;
  volumeData: VolumeData | null | undefined;
  chapters: Chapter[];
}

// ============================================================================
// Helper Functions - Fix Index Signature Access (TS4111)
// ============================================================================

/**
 * Safely extract string value from object using bracket notation
 * Fixes TS4111: Property comes from index signature
 * Returns undefined for empty strings to enable proper fallback with ??
 */
function getString(obj: Record<string, unknown>, key: string): string | undefined {
  const value = obj[key];
  if (typeof value === 'string' && value.trim() !== '') {
    return value;
  }
  return undefined;
}

/**
 * Safely extract number value from object using bracket notation
 */
function getNumber(obj: Record<string, unknown>, key: string): number | undefined {
  const value = obj[key];
  return typeof value === 'number' ? value : undefined;
}

/**
 * Safely extract object value from object using bracket notation
 */
function getObject(obj: Record<string, unknown>, key: string): Record<string, unknown> | undefined {
  const value = obj[key];
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

/**
 * Safely extract array value from object using bracket notation
 */
function getArray(obj: Record<string, unknown>, key: string): unknown[] | undefined {
  const value = obj[key];
  return Array.isArray(value) ? value : undefined;
}

// ============================================================================
// Extractor Functions
// ============================================================================

/**
 * Extract cover image from ComicVine issue object
 */
function extractCoverFromComicVineIssue(
  issue: Record<string, unknown>,
  volumeCover: string | null | undefined
): string | undefined {
  const coverImage = getString(issue, 'coverImage');
  if (coverImage) return volumeCover ?? coverImage;

  const image = getObject(issue, 'image');
  if (image) {
    return (
      volumeCover ??
      getString(image, 'medium_url') ??
      getString(image, 'screen_url') ??
      getString(image, 'original_url')
    );
  }
  return volumeCover ?? undefined;
}

/**
 * Build volume title from ComicVine issue data
 */
function buildComicVineTitle(
  issue: Record<string, unknown>,
  volumeTitle: string | null | undefined,
  volumeNumber: number
): string {
  if (volumeTitle) return volumeTitle;

  const explicitTitle = getString(issue, 'volumeTitle');
  if (explicitTitle) return explicitTitle;

  const name = getString(issue, 'name');
  if (name) {
    const issueNum = getNumber(issue, 'issue_number') ?? getNumber(issue, 'volumeNumber');
    return `#${issueNum ?? volumeNumber}: ${name}`;
  }

  return `Volume ${volumeNumber}`;
}

/**
 * Extract volume data from ComicVine issues array
 * Uses params object to reduce parameter count (max-params: 5)
 */
// eslint-disable-next-line complexity -- ComicVine data extraction with multiple fallback paths for issues, chapters, and metadata
function extractFromComicVine(params: ComicVineExtractionParams): EnrichedVolumeData | null {
  const { metadata, volumeNumber, volumeTitle, volumeCover, volumeData, chapters } = params;

  // Try multiple paths for ComicVine issues
  const issues =
    metadata.comicvine?.rawData?.issues ??
    metadata.comicvine?.metadata?.issues ??
    metadata.comicvine?.volumeData;

  if (!Array.isArray(issues)) return null;

  const issueIndex = volumeNumber - 1;
  const rawIssue = issues[issueIndex];

  if (!rawIssue || typeof rawIssue !== 'object') return null;

  const issue = rawIssue as Record<string, unknown>;

  // Build chapters array - prefer database chapters if they have more entries
  // This handles the case where volumeData comes from ComicVine (with fewer chapters)
  // but the database has merged chapters from Fandom (with more chapters)
  const volumeDataChaptersCount = volumeData?.chapters?.length ?? 0;
  const databaseChaptersCount = chapters.length;

  logger.debug(`[Volume Enrichment] Chapter source selection for volume ${volumeNumber}:`, {
    volumeDataChaptersCount,
    databaseChaptersCount,
    usingSource: databaseChaptersCount > volumeDataChaptersCount ? 'database' : 'volumeData'
  });

  const enrichedChapters: EnrichedChapter[] =
    databaseChaptersCount > volumeDataChaptersCount
      ? createEnrichedChaptersFromDatabase(chapters)
      : volumeData?.chapters
        ? createEnrichedChaptersFromVolumeData(volumeData.chapters)
        : createEnrichedChaptersFromDatabase(chapters);

  return {
    volumeNumber,
    title: buildComicVineTitle(issue, volumeTitle, volumeNumber),
    coverImage: extractCoverFromComicVineIssue(issue, volumeCover),
    description:
      getString(issue, 'volumeSummary') ?? getString(issue, 'description') ?? getString(issue, 'deck'),
    releaseDate: getString(issue, 'cover_date') ?? getString(issue, 'releaseDate'),
    storeDate: getString(issue, 'store_date') ?? getString(issue, 'storeDate'),
    issueNumber: getNumber(issue, 'issue_number') ?? getNumber(issue, 'issueNumber'),
    sourceUrl: getString(issue, 'site_detail_url') ?? getString(issue, 'sourceUrl'),
    chapters: enrichedChapters
  };
}

/**
 * Extract title from VolumeData with fallbacks
 */
function extractVolumeDataTitle(
  volumeData: VolumeData,
  volumeTitle: string | null | undefined,
  volumeNumber: number
): string {
  return (
    volumeTitle ??
    volumeData.volumeTitle ??
    volumeData.name ??
    volumeData.volumeName ??
    volumeData.title ??
    `Volume ${volumeNumber}`
  );
}

/**
 * Extract cover image from VolumeData with fallbacks
 */
function extractVolumeDataCover(
  volumeData: VolumeData,
  volumeCover: string | null | undefined
): string | undefined {
  return (
    volumeData.coverImage ??
    volumeData.coverImageUrl ??
    volumeData.coverUrl ??
    volumeData.cover ??
    volumeCover ??
    undefined
  );
}

/**
 * Extract from wizard VolumeData
 * Decomposed to reduce complexity (max-complexity: 20)
 */
function extractFromVolumeData(
  volumeData: VolumeData,
  volumeNumber: number,
  volumeTitle: string | null | undefined,
  volumeCover: string | null | undefined,
  databaseChapters?: Chapter[]
): EnrichedVolumeData {
  // Prefer database chapters if they have more entries than volumeData chapters
  const volumeDataChaptersCount = volumeData.chapters?.length ?? 0;
  const databaseChaptersCount = databaseChapters?.length ?? 0;

  let enrichedChapters: EnrichedChapter[] | undefined;
  if (databaseChaptersCount > volumeDataChaptersCount && databaseChapters) {
    enrichedChapters = createEnrichedChaptersFromDatabase(databaseChapters);
  } else if (volumeData.chapters) {
    enrichedChapters = createEnrichedChaptersFromVolumeData(volumeData.chapters);
  }

  return {
    volumeNumber,
    title: extractVolumeDataTitle(volumeData, volumeTitle, volumeNumber),
    coverImage: extractVolumeDataCover(volumeData, volumeCover),
    description:
      volumeData.volumeSummary ?? volumeData.description ?? volumeData.summary ?? volumeData.synopsis,
    releaseDate:
      volumeData.releaseDate ?? volumeData.publishDate ?? volumeData.publish_date ?? volumeData.cover_date,
    storeDate: volumeData.storeDate ?? volumeData.store_date,
    issueNumber: volumeData.issueNumber ?? volumeData.issue_number,
    chapters: enrichedChapters,
    publisher: volumeData.publisher,
    pageCount: volumeData.pageCount ?? volumeData.page_count,
    sourceUrl: volumeData.sourceUrl ?? volumeData.url ?? volumeData.site_detail_url
  };
}

/**
 * Extract from generic provider (Fandom, etc.)
 */
function extractFromGenericProvider(
  metadata: Record<string, unknown>,
  sourceKey: string,
  volumeNumber: number,
  volumeTitle: string | null | undefined,
  chapters: Chapter[]
): EnrichedVolumeData | null {
  const sourceData = getObject(metadata, sourceKey);
  const volumesArray =
    getArray(metadata, `${sourceKey}_volumes`) ??
    (sourceData ? getArray(sourceData, 'volumeData') : undefined) ??
    (sourceData ? getArray(sourceData, 'volumes') : undefined);

  if (!Array.isArray(volumesArray)) return null;

  const volumeDataItem = volumesArray.find((v) => {
    if (!v || typeof v !== 'object') return false;
    const vObj = v as Record<string, unknown>;
    return getNumber(vObj, 'volumeNumber') === volumeNumber || getNumber(vObj, 'number') === volumeNumber;
  });

  if (!volumeDataItem || typeof volumeDataItem !== 'object') return null;

  const vDataObj = volumeDataItem as Record<string, unknown>;
  const vDataChapters = getArray(vDataObj, 'chapters');

  // Prefer database chapters if they have more entries than provider chapters
  const providerChaptersCount = vDataChapters?.length ?? 0;
  const databaseChaptersCount = chapters.length;

  let enrichedChapters: EnrichedChapter[];
  if (databaseChaptersCount > providerChaptersCount) {
    enrichedChapters = createEnrichedChaptersFromDatabase(chapters);
  } else if (vDataChapters) {
    enrichedChapters = createEnrichedChaptersFromProvider(vDataChapters);
  } else {
    enrichedChapters = createEnrichedChaptersFromDatabase(chapters);
  }

  return {
    volumeNumber,
    title: volumeTitle ?? getString(vDataObj, 'title') ?? `Volume ${volumeNumber}`,
    coverImage: getString(vDataObj, 'coverImageUrl') ?? getString(vDataObj, 'coverImage'),
    description: getString(vDataObj, 'description') ?? getString(vDataObj, 'summary'),
    releaseDate: getString(vDataObj, 'releaseDate'),
    chapters: enrichedChapters
  };
}

/**
 * Extract from Wikipedia volume list
 */
function extractFromWikipedia(
  metadata: ParsedProviderMetadata,
  volumeNumber: number,
  volumeTitle: string | null | undefined,
  chapters: Chapter[]
): EnrichedVolumeData | null {
  const volumeList = metadata.wikipedia_chapters?.volumeList;
  if (!Array.isArray(volumeList)) return null;

  const volumeDataItem = volumeList.find((v) => {
    if (!v || typeof v !== 'object') return false;
    const vObj = v as Record<string, unknown>;
    return getNumber(vObj, 'volumeNumber') === volumeNumber;
  });

  if (!volumeDataItem || typeof volumeDataItem !== 'object') return null;

  const vDataObj = volumeDataItem as Record<string, unknown>;
  const vDataChapters = getArray(vDataObj, 'chapters');

  // Prefer database chapters if they have more entries than Wikipedia chapters
  const wikipediaChaptersCount = vDataChapters?.length ?? 0;
  const databaseChaptersCount = chapters.length;

  let enrichedChapters: EnrichedChapter[];
  if (databaseChaptersCount > wikipediaChaptersCount) {
    enrichedChapters = createEnrichedChaptersFromDatabase(chapters);
  } else if (vDataChapters) {
    // Map Wikipedia chapters with string/number handling
    enrichedChapters = vDataChapters.map((ch) => {
      if (!ch || typeof ch !== 'object') {
        return { index: 0, title: 'Unknown', number: 0 };
      }
      const chObj = ch as Record<string, unknown>;
      const numValue = chObj['number'];
      const chapterNum =
        typeof numValue === 'string'
          ? parseInt(numValue, 10)
          : typeof numValue === 'number'
            ? numValue
            : 0;
      return {
        index: chapterNum,
        title: getString(chObj, 'title') ?? `Chapter ${chapterNum}`,
        number: chapterNum
      };
    });
  } else {
    enrichedChapters = createEnrichedChaptersFromDatabase(chapters);
  }

  return {
    volumeNumber,
    title: volumeTitle ?? `Volume ${volumeNumber}`,
    releaseDate: getString(vDataObj, 'releaseDate'),
    chapters: enrichedChapters
  };
}

// ============================================================================
// Main Hook
// ============================================================================

/**
 * Enriches volume modal data from multiple provider sources
 *
 * Combines data from:
 * - Volume title/cover props
 * - VolumeData from wizard
 * - Provider metadata (ComicVine, Fandom, Wikipedia, etc.)
 */
export function useEnrichedVolumeModalData(params: VolumeEnrichmentParams): EnrichedVolumeData {
  const { volumeNumber, volumeTitle, volumeCover, volumeData, providerMetadata, selectedSource, chapters } =
    params;

  return useMemo((): EnrichedVolumeData => {
    // Parse metadata once
    const metadata = safeParseProviderMetadata(providerMetadata);
    const effectiveSource = selectedSource ?? 'fandom';

    // Get volume source from import profile
    const volumeSource = extractVolumeSource(metadata);

    // PRIORITY 1: ComicVine is volume source
    if (volumeSource === 'comicvine' && metadata) {
      const result = extractFromComicVine({
        metadata: metadata as ParsedProviderMetadata,
        volumeNumber,
        volumeTitle,
        volumeCover,
        volumeData,
        chapters
      });
      if (result) return result;
    }

    // PRIORITY 2: Use wizard VolumeData
    if (volumeData) {
      return extractFromVolumeData(volumeData, volumeNumber, volumeTitle, volumeCover, chapters);
    }

    // PRIORITY 3: Simple title/cover fallback without metadata
    if (!metadata) {
      if (volumeTitle ?? volumeCover) {
        return {
          volumeNumber,
          title: volumeTitle ?? undefined,
          coverImage: volumeCover ?? undefined
        };
      }
      return { volumeNumber };
    }

    // PRIORITY 4: Try ComicVine from metadata
    try {
      const comicvineResult = extractFromComicVine({
        metadata: metadata as ParsedProviderMetadata,
        volumeNumber,
        volumeTitle,
        volumeCover,
        volumeData,
        chapters
      });
      if (comicvineResult) return comicvineResult;

      // PRIORITY 5: Try generic provider
      const genericResult = extractFromGenericProvider(
        metadata,
        effectiveSource.toLowerCase(),
        volumeNumber,
        volumeTitle,
        chapters
      );
      if (genericResult) return genericResult;

      // PRIORITY 6: Try Wikipedia
      const wikipediaResult = extractFromWikipedia(
        metadata as ParsedProviderMetadata,
        volumeNumber,
        volumeTitle,
        chapters
      );
      if (wikipediaResult) return wikipediaResult;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Error extracting volume data from providerMetadata:', errorMessage);
    }

    // Fallback
    return {
      volumeNumber,
      title: volumeTitle ?? `Volume ${volumeNumber}`,
      chapters: createEnrichedChaptersFromDatabase(chapters)
    };
  }, [volumeNumber, volumeTitle, volumeCover, volumeData, providerMetadata, selectedSource, chapters]);
}
