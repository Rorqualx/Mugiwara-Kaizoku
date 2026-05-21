/**
 * Helper functions for FandomProvider
 *
 * Provides utility functions for parsing, transforming, and building
 * search result data from Fandom API responses.
 */

import { FandomService } from '@/server/services/fandom/FandomService';
import type { FandomSearchResult, FandomMangaData } from '@/server/services/fandom/types';
import type { SearchResult } from '@/types/search.types';
import { logger } from '@/utils/logger';

import type {
  ExtendedSearchResult,
  ExtendedMetadata,
  BaseResultType,
  BuildMetadataParams
} from './types';

/**
 * Extract metadata property with fallback to root-level property
 */
export function extractMetadataProperty<T>(
  meta: ExtendedMetadata | undefined,
  resultAny: ExtendedSearchResult,
  key: keyof ExtendedMetadata
): T | undefined {
  return (meta?.[key] ?? resultAny[key as keyof ExtendedSearchResult]) as T | undefined;
}

/**
 * Build author and artist arrays from metadata
 */
export function buildAuthorArtistArrays(
  meta: ExtendedMetadata | undefined,
  resultAny: ExtendedSearchResult
): { authors: string[]; artists: string[] } {
  // Build authors array
  const metaAuthors = meta?.authors ?? (meta?.author ? [meta.author] : []);
  const resultAuthors = resultAny.authors ?? (resultAny.author ? [resultAny.author] : []);
  const authors = metaAuthors.length > 0 ? metaAuthors : resultAuthors;

  // Build artists array
  const metaArtists = meta?.artists ?? (meta?.artist ? [meta.artist] : []);
  const resultArtists = resultAny.artists ?? (resultAny.artist ? [resultAny.artist] : []);
  const artists = metaArtists.length > 0 ? metaArtists : resultArtists;

  return { authors, artists };
}

/**
 * Parse numeric field from string or number
 */
export function parseNumericField(value: string | number | undefined): number | null {
  if (value === undefined) return null;

  if (typeof value === 'string') {
    const parsed = parseInt(value.replace(/[^0-9]/g, ''));
    return isNaN(parsed) ? null : parsed;
  }

  return value;
}

/**
 * Parse optional number from string or number value
 */
export function parseOptionalNumber(value: string | number | undefined): number | undefined {
  if (!value) {
    return undefined;
  }

  if (typeof value === 'string') {
    return parseInt(value.replace(/[^0-9]/g, ''));
  }

  return parseInt(String(value));
}

/**
 * Process descriptions from metadata and result
 */
export function processDescriptions(
  meta: ExtendedMetadata | undefined,
  result: FandomSearchResult
): { description: string; synopsis: string } {
  const description = meta?.description && meta.description !== 'No description available'
    ? meta.description
    : (result.abstract ?? '');
  const synopsis = meta?.synopsis ?? description;
  return { description, synopsis };
}

/**
 * Build result properties from metadata and result data
 */
export function buildResultProperties(params: {
  result: FandomSearchResult;
  meta: ExtendedMetadata | undefined;
  resultAny: ExtendedSearchResult;
  wikiKey: string;
  parseStatus: (status?: string) => string;
  extractYear: (published?: string) => number | undefined;
}): Omit<SearchResult, 'metadata'> {
  const { result, meta, resultAny, wikiKey, parseStatus, extractYear } = params;
  const { description } = processDescriptions(meta, result);
  const volumes = parseNumericField(meta?.volumes);
  const chapters = parseNumericField(meta?.chapters);
  const status = meta?.status ?? parseStatus(meta?.status);

  const baseResult = {
    id: `${wikiKey}:${result.id}`,
    title: result.title,
    alternativeTitles: meta?.alternativeTitles ?? resultAny.alternativeTitles ?? [],
    description,
    status,
    format: meta?.format ?? 'MANGA',
    year: extractYear(extractMetadataProperty(meta, resultAny, 'published')),
    startDate: extractMetadataProperty(meta, resultAny, 'startDate'),
    endDate: extractMetadataProperty(meta, resultAny, 'endDate'),
    author: extractMetadataProperty(meta, resultAny, 'author'),
    genres: meta?.genres ?? resultAny.genres ?? [],
    chapters: chapters ?? parseNumericField(resultAny.chapters),
    volumes: volumes ?? parseNumericField(resultAny.volumes),
    score: result.score,
    popularity: undefined,
    provider: 'fandom' as string,
    providerUrl: result.url,
    wikiUrl: result.url,
    url: result.url
  };

  // Add coverImage only if it exists
  const coverImg = meta?.coverImage ?? result.thumbnail;
  if (coverImg !== undefined) {
    (baseResult as Record<string, unknown>)['coverImage'] = coverImg;
  }

  return baseResult as unknown as Omit<SearchResult, 'metadata'>;
}

/**
 * Build the metadata object for a search result
 */
export function buildSearchResultMetadata(
  result: FandomSearchResult,
  params: BuildMetadataParams
): Record<string, unknown> {
  const { wikiKey, wikiName, synopsis, description, volumes, chapters, authorArtistArrays, meta, resultAny } = params;

  return {
    wiki: wikiName,
    wikiKey,
    originalType: result.type,
    publisher: extractMetadataProperty(meta, resultAny, 'publisher'),
    magazine: extractMetadataProperty(meta, resultAny, 'magazine'),
    demographic: extractMetadataProperty(meta, resultAny, 'demographic'),
    published: extractMetadataProperty(meta, resultAny, 'published'),
    synopsis,
    description,
    author: extractMetadataProperty(meta, resultAny, 'author'),
    artist: extractMetadataProperty(meta, resultAny, 'artist'),
    authors: authorArtistArrays.authors,
    artists: authorArtistArrays.artists,
    alternativeTitles: meta?.alternativeTitles ?? resultAny.alternativeTitles ?? [],
    startDate: extractMetadataProperty(meta, resultAny, 'startDate'),
    endDate: extractMetadataProperty(meta, resultAny, 'endDate'),
    volumes: volumes ?? resultAny.volumes,
    chapters: chapters ?? resultAny.chapters,
    ...meta
  };
}

/**
 * Fetch page metadata and extract cover image
 */
export async function fetchPageMetadataWithCover(
  service: FandomService | undefined,
  title: string
): Promise<{ pageMetadata: Record<string, unknown> | null; coverImage: string | undefined }> {
  let pageMetadata: Record<string, unknown> | null = null;

  if (service) {
    try {
      pageMetadata = await service.getPageMetadata(title) as Record<string, unknown> | null;
    } catch (error) {
      logger.warn(`Failed to get page metadata for ${title}:`, error);
    }
  }

  const coverImage = pageMetadata?.["coverImage"] as string | undefined;

  return { pageMetadata, coverImage };
}

/**
 * Build base manga result object
 */
export function buildMangaBaseResult(params: {
  mangaData: FandomMangaData;
  wikiKey: string;
  wikiName: string;
  wikiUrl: string;
  coverImage: string | undefined;
  pageMetadata: Record<string, unknown> | null;
  parseStatus: (status?: string) => string;
}): BaseResultType {
  const { mangaData, wikiKey, wikiName, wikiUrl, coverImage, pageMetadata, parseStatus } = params;

  const parsedStatus = parseStatus(mangaData["status"]);

  return {
    id: `${wikiKey}:${mangaData["title"]}`,
    title: mangaData["title"],
    alternativeTitles: [],
    description: mangaData.synopsis ?? '',
    coverImage: coverImage ?? mangaData.coverImage ?? '',
    status: parsedStatus,
    format: 'MANGA',
    genres: mangaData["genres"] ?? [],
    provider: 'fandom' as string,
    providerUrl: wikiUrl,
    wikiUrl: wikiUrl,
    url: wikiUrl,
    metadata: {
      wiki: wikiName,
      wikiKey,
      publisher: mangaData.publisher,
      magazine: mangaData.magazine,
      gallery: (pageMetadata?.["gallery"] as string[] | undefined) ?? [],
      demographic: mangaData.demographic,
      description: mangaData.synopsis,
      synopsis: mangaData.synopsis,
      author: mangaData.author,
      authors: mangaData.author ? [mangaData.author] : [],
      characterCount: mangaData.characters?.length
    }
  };
}

/**
 * Add conditional properties to result based on manga data
 */
export function addConditionalProperties(
  baseResult: BaseResultType,
  mangaData: FandomMangaData,
  extractYear: (published?: string) => number | undefined
): SearchResult {
  const { status, ...baseWithoutStatus } = baseResult;
  const result: SearchResult = {
    ...baseWithoutStatus,
    type: 'manga',
    ...(status !== 'UNKNOWN' ? { status } : {})
  };
  const mangaDataRecord = mangaData as unknown as Record<string, unknown>;

  const author = mangaDataRecord['author'];
  if (typeof author === 'string') {
    result.author = author;
  }

  const published = mangaDataRecord['published'];
  const year = extractYear(typeof published === 'string' ? published : undefined);
  if (year !== undefined) {
    result.year = year;
  }

  const chaptersValue = mangaDataRecord['chapters'];
  const chapters = parseOptionalNumber(
    typeof chaptersValue === 'string' || typeof chaptersValue === 'number' ? chaptersValue : undefined
  );
  if (chapters !== undefined) {
    result.chapters = chapters;
  }

  const volumesValue = mangaDataRecord['volumes'];
  const volumes = parseOptionalNumber(
    typeof volumesValue === 'string' || typeof volumesValue === 'number' ? volumesValue : undefined
  );
  if (volumes !== undefined) {
    result.volumes = volumes;
  }

  return result;
}

/**
 * Normalize a title for deduplication comparison.
 * Strips common disambiguation suffixes and normalizes whitespace/punctuation.
 */
function normalizeTitleForDedup(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/\s*\((manga|series|anime|manhwa|manhua|comic|webtoon|light novel)\)\s*$/i, '')
    .replace(/['\u2018\u2019]/g, "'")
    .replace(/["\u201C\u201D]/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Score a SearchResult based on metadata completeness.
 * Higher score = more fields populated = more useful result.
 */
function computeMetadataScore(result: SearchResult): number {
  let score = 0;
  const meta = result.metadata as Record<string, unknown> | undefined;

  if (result.coverImage ?? (meta !== undefined && typeof meta['coverImage'] === 'string' && (meta['coverImage'] as string).length > 0)) score += 10;
  if (result.description !== undefined && result.description.length > 20) score += 5;
  if (result.chapters !== undefined && result.chapters > 0) score += 3;
  if (result.volumes !== undefined && result.volumes > 0) score += 3;
  if (result.year !== undefined) score += 2;
  if (result.status !== undefined && result.status !== 'UNKNOWN') score += 2;
  if (result.author !== undefined) score += 2;
  if (result.genres !== undefined && result.genres.length > 0) score += 1;
  if (result.alternativeTitles !== undefined && result.alternativeTitles.length > 0) score += 1;

  return score;
}

/**
 * Deduplicate Fandom results by normalized title.
 * When the same manga appears from multiple wikis (or with suffixes like "(manga)"),
 * keeps only the result with the most complete metadata.
 */
export function deduplicateByTitle(results: SearchResult[]): SearchResult[] {
  if (results.length <= 1) return results;

  const titleMap = new Map<string, { result: SearchResult; score: number }>();

  for (const result of results) {
    const normalizedTitle = normalizeTitleForDedup(result.title);
    const score = computeMetadataScore(result);
    const existing = titleMap.get(normalizedTitle);

    if (existing === undefined || score > existing.score) {
      titleMap.set(normalizedTitle, { result, score });
    }
  }

  return Array.from(titleMap.values()).map(entry => entry.result);
}

/**
 * Map type filter to Fandom type
 */
export function mapTypeFilter(type?: string): 'all' | 'manga' | 'character' {
  if (type === 'MANGA') return 'manga';
  if (type === 'CHARACTER') return 'character';
  return 'all';
}

/**
 * Parse status from string
 */
export function parseStatus(status?: string): string {
  if (!status) return 'UNKNOWN';

  const statusLower = status.toLowerCase();

  if (statusLower.includes('ongoing') || statusLower.includes('publishing')) {
    return 'ONGOING';
  }
  if (statusLower.includes('completed') || statusLower.includes('finished')) {
    return 'COMPLETED';
  }
  if (statusLower.includes('hiatus') || statusLower.includes('on hold')) {
    return 'HIATUS';
  }
  if (statusLower.includes('cancelled') || statusLower.includes('discontinued')) {
    return 'CANCELLED';
  }

  return 'UNKNOWN';
}

/**
 * Extract year from published string
 */
export function extractYear(published?: string): number | undefined {
  if (!published) return undefined;

  const yearMatch = published.match(/\b(19|20)\d{2}\b/);

  if (yearMatch) {
    return parseInt(yearMatch[0]);
  }

  return undefined;
}
