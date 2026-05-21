/**
 * Fandom Provider Instance
 * 
 * Creates and exports a singleton instance of the FandomProvider
 * that integrates with the search system to provide manga metadata
 * from various Fandom wikis.
 */

import { FandomProvider } from '@/server/services/search/providers/FandomProvider';
import type { SearchResult as DomainSearchResult } from '@/types/search.types';
import { logger } from '@/utils/logger';

import type { SearchResult as LocalSearchResult, SearchOptions } from '../types';

/**
 * Helper type for accessing dynamic fields on results
 */
type ResultRecord = DomainSearchResult & Record<string, unknown>;
type MetadataRecord = Record<string, unknown>;

/**
 * Safely extract a string value from multiple potential sources
 */
function extractStringField(
  result: ResultRecord,
  metadata: MetadataRecord,
  ...keys: string[]
): string | undefined {
  for (const key of keys) {
    const value = result[key] ?? metadata[key];
    if (typeof value === 'string') {
      return value;
    }
  }
  return undefined;
}

/**
 * Safely extract an array value from multiple potential sources
 */
function extractArrayField<T>(
  result: ResultRecord,
  metadata: MetadataRecord,
  ...keys: string[]
): T[] | undefined {
  for (const key of keys) {
    const value = result[key] ?? metadata[key];
    if (Array.isArray(value)) {
      return value as T[];
    }
  }
  return undefined;
}

/**
 * Safely extract a number value from multiple potential sources
 */
function extractNumberField(
  result: ResultRecord,
  metadata: MetadataRecord,
  ...keys: string[]
): number | null | undefined {
  for (const key of keys) {
    const value = result[key] ?? metadata[key];
    if (typeof value === 'number') {
      return value;
    }
  }
  return undefined;
}

/**
 * Create tags array from raw tag data
 */
function createTags(tags: unknown): Array<{ id: number; name: string; isGeneralSpoiler: boolean; isMediaSpoiler: boolean }> {
  if (!Array.isArray(tags)) {
    return [];
  }

  return tags.map((tag: unknown) => ({
    id: 0,
    name: typeof tag === 'string' ? tag :
         (typeof tag === 'object' && tag !== null && 'name' in tag) ?
         String((tag as { name: unknown }).name) :
         String(tag),
    isGeneralSpoiler: false,
    isMediaSpoiler: false
  }));
}

/**
 * Create external links array from provider URL
 */
function createExternalLinks(providerUrl: string | undefined): Array<{ id: number; url: string; site: string; type: string }> | undefined {
  if (!providerUrl) {
    return undefined;
  }

  return [{
    id: 0,
    url: providerUrl,
    site: 'Fandom',
    type: 'OFFICIAL'
  }];
}

/**
 * Normalize publisher value to string
 */
function normalizePublisher(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return value;
  }
  if (value && typeof value === 'object' && 'name' in value && typeof value.name === 'string') {
    return value.name;
  }
  return undefined;
}

/**
 * Extract field data from result for transformation
 */
function extractFieldData(result: DomainSearchResult): {
  resultRecord: ResultRecord;
  metadata: MetadataRecord;
  startDate: string | undefined;
  endDate: string | undefined;
  chapters: number | null | undefined;
  volumes: number | null | undefined;
  author: string | undefined;
  artist: string | undefined;
  publisher: string | undefined;
  demographic: string | undefined;
  published: string | undefined;
  alternativeTitles: string[] | undefined;
  authorsArray: string[] | undefined;
  artistsArray: string[] | undefined;
  formatValue: string;
} {
  const resultRecord = result as ResultRecord;
  const metadata = (result.metadata ?? {}) as MetadataRecord;

  // Convert startDate from unknown to string
  const rawStartDate = result.startDate;
  const startDate = (typeof rawStartDate === 'string' ? rawStartDate : undefined)
    ?? extractStringField(resultRecord, metadata, 'startDate')
    ?? (result.year ? String(result.year) : undefined);

  // Convert endDate from unknown to string
  const rawEndDate = result.endDate;
  const endDate = (typeof rawEndDate === 'string' ? rawEndDate : undefined)
    ?? extractStringField(resultRecord, metadata, 'endDate');

  const chapters = result.chapters ?? extractNumberField(resultRecord, metadata, 'chapters');
  const volumes = result.volumes ?? extractNumberField(resultRecord, metadata, 'volumes');

  const author = extractStringField(resultRecord, metadata, 'author');
  const artist = extractStringField(resultRecord, metadata, 'artist');
  const rawPublisher = result.publisher ?? resultRecord['publisher'] ?? metadata['publisher'];
  const publisher = normalizePublisher(rawPublisher);
  const demographic = extractStringField(resultRecord, metadata, 'demographic');
  const published = extractStringField(resultRecord, metadata, 'published');

  const alternativeTitles = result.alternativeTitles
    ?? extractArrayField<string>(resultRecord, metadata, 'alternativeTitles');

  const authorsArray = extractArrayField<string>(resultRecord, metadata, 'authors')
    ?? (author ? [author] : undefined);
  const artistsArray = extractArrayField<string>(resultRecord, metadata, 'artists')
    ?? (artist ? [artist] : undefined);

  const formatValue = extractStringField(resultRecord, metadata, 'format', 'type') ?? 'MANGA';

  return {
    resultRecord,
    metadata,
    startDate,
    endDate,
    chapters,
    volumes,
    author,
    artist,
    publisher,
    demographic,
    published,
    alternativeTitles,
    authorsArray,
    artistsArray,
    formatValue
  };
}

/**
 * Build image and description related fields
 */
function buildMediaFields(result: DomainSearchResult): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  if (result.coverImage) {
    fields['cover'] = result.coverImage;
    fields['coverImage'] = result.coverImage;
  }
  if (result.description) {
    fields['description'] = result.description;
  }
  if (result.status) {
    fields['status'] = result.status;
  }
  if (result.genres !== undefined) {
    fields['genres'] = result.genres;
  }
  return fields;
}

/**
 * Build score and popularity fields
 */
function buildScoreFields(result: DomainSearchResult): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  if (result.score) {
    fields['score'] = result.score;
    fields['meanScore'] = result.score;
  }
  if (result.popularity) {
    fields['popularity'] = result.popularity;
  }
  return fields;
}

/**
 * Build date related fields
 */
function buildDateFields(fieldData: ReturnType<typeof extractFieldData>): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  if (fieldData.startDate) {
    fields['startDate'] = fieldData.startDate;
  }
  if (fieldData.endDate) {
    fields['endDate'] = fieldData.endDate;
  }
  return fields;
}

/**
 * Build chapter and volume fields
 */
function buildContentFields(fieldData: ReturnType<typeof extractFieldData>): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  if (fieldData.chapters) {
    fields['chapters'] = fieldData.chapters;
  }
  if (fieldData.volumes) {
    fields['volumes'] = fieldData.volumes;
  }
  if (fieldData.alternativeTitles !== undefined) {
    fields['alternativeTitles'] = fieldData.alternativeTitles;
  }
  return fields;
}

/**
 * Build author and artist fields
 */
function buildCreatorFields(fieldData: ReturnType<typeof extractFieldData>): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  if (fieldData.authorsArray !== undefined) {
    fields['authors'] = fieldData.authorsArray;
  }
  if (fieldData.artistsArray !== undefined) {
    fields['artists'] = fieldData.artistsArray;
  }
  if (fieldData.author) {
    fields['author'] = fieldData.author;
  }
  if (fieldData.artist) {
    fields['artist'] = fieldData.artist;
  }
  return fields;
}

/**
 * Build publisher and metadata fields
 */
function buildMetadataFields(fieldData: ReturnType<typeof extractFieldData>): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  if (fieldData.publisher) {
    fields['publisher'] = fieldData.publisher;
  }
  if (fieldData.demographic) {
    fields['demographic'] = fieldData.demographic;
  }
  if (fieldData.published) {
    fields['published'] = fieldData.published;
  }
  if (Object.keys(fieldData.metadata).length > 0) {
    fields['metadata'] = fieldData.metadata;
  }
  return fields;
}

/**
 * Build URL fields
 */
function buildUrlFields(result: DomainSearchResult): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  if (result.providerUrl) {
    fields['siteDetailUrl'] = result.providerUrl;
  }
  const wikiUrl = result.wikiUrl ?? result.providerUrl;
  if (wikiUrl !== undefined) {
    fields['wikiUrl'] = wikiUrl;
  }
  const url = result.url ?? result.wikiUrl ?? result.providerUrl;
  if (url !== undefined) {
    fields['url'] = url;
  }
  return fields;
}

/**
 * Build tag and external link fields
 */
function buildSupplementalFields(result: DomainSearchResult): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  if (result.tags !== undefined) {
    fields['tags'] = createTags(result.tags);
  }
  if (result.providerUrl !== undefined) {
    fields['externalLinks'] = createExternalLinks(result.providerUrl);
  }
  return fields;
}

/**
 * Transform a provider result to LocalSearchResult format
 */
function transformToSearchResult(result: DomainSearchResult): LocalSearchResult {
  const fieldData = extractFieldData(result);

  // Explicitly construct with proper types
  const transformed: LocalSearchResult = {
    // Core fields
    id: result.id,
    title: result.title,
    provider: 'fandom',
    format: fieldData.formatValue,
    source: 'fandom',
    resourceType: 'manga',

    // Media fields
    ...buildMediaFields(result),

    // Score fields
    ...buildScoreFields(result),

    // Date fields
    ...buildDateFields(fieldData),

    // Content fields
    ...buildContentFields(fieldData),

    // Creator fields
    ...buildCreatorFields(fieldData),

    // Metadata fields
    ...buildMetadataFields(fieldData),

    // URL fields
    ...buildUrlFields(result),

    // Supplemental fields
    ...buildSupplementalFields(result)
  };

  return transformed;
}

class FandomSearchProvider {
  name = 'fandom';
  type = 'FANDOM';
  private provider: FandomProvider;
  private log = logger.child('FandomSearchProvider');

  // Add search method to satisfy the provider interface
  search = (query: string, options?: SearchOptions): Promise<LocalSearchResult[]> => {
    return this.searchInternal(query, options);
  }

  constructor() {
    this.provider = new FandomProvider();
  }

  /**
   * Search for manga across Fandom wikis (internal implementation)
   */
  private async searchInternal(query: string, options?: SearchOptions): Promise<LocalSearchResult[]> {
    try {
      this.log.info('Searching Fandom wikis', { query, options });
      
      const results = await this.provider.search(query, {
        limit: options?.limit ?? 20,
        offset: options?.offset ?? 0
      });

      this.log.info('🔍 [FANDOM INSTANCE] Raw provider results:', {
        count: results.length,
        firstResult: results[0] ? {
          hasWikiUrl: !!results[0].wikiUrl,
          wikiUrl: results[0].wikiUrl,
          hasUrl: !!results[0].url,
          url: results[0].url,
          hasProviderUrl: !!results[0].providerUrl,
          providerUrl: results[0].providerUrl,
          title: results[0].title
        } : null
      });

      // Transform results to match the expected format
      // IMPORTANT: Preserve ALL fields from FandomProvider for validation
      const transformedResults = results.map((result) => transformToSearchResult(result));
      
      this.log.info('🔍 [FANDOM INSTANCE] Transformed results:', {
        count: transformedResults.length,
        firstResult: transformedResults[0] ? {
          hasWikiUrl: !!transformedResults[0].wikiUrl,
          wikiUrl: transformedResults[0].wikiUrl,
          hasUrl: !!transformedResults[0].url,
          url: transformedResults[0].url,
          title: transformedResults[0].title,
          hasAuthors: !!(transformedResults[0] as LocalSearchResult & { authors?: string[] }).authors,
          authors: (transformedResults[0] as LocalSearchResult & { authors?: string[] }).authors,
          hasArtists: !!(transformedResults[0] as LocalSearchResult & { artists?: string[] }).artists,
          artists: (transformedResults[0] as LocalSearchResult & { artists?: string[] }).artists,
          hasStartDate: !!transformedResults[0].startDate,
          startDate: transformedResults[0].startDate,
          hasEndDate: !!transformedResults[0].endDate,
          endDate: transformedResults[0].endDate,
          hasAlternativeTitles: !!transformedResults[0].alternativeTitles,
          alternativeTitles: transformedResults[0].alternativeTitles,
          hasPublisher: !!transformedResults[0].publisher,
          publisher: transformedResults[0].publisher,
          volumes: transformedResults[0].volumes,
          chapters: transformedResults[0].chapters,
          hasMetadata: !!transformedResults[0].metadata,
          metadataKeys: transformedResults[0].metadata ? Object.keys(transformedResults[0].metadata) : []
        } : null
      });
      
      return transformedResults;
    } catch (error: unknown) {
      this.log.error('Fandom search failed', {
        query,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Get metadata for a specific manga
   */
  async getMetadata(id: string, title?: string): Promise<LocalSearchResult> {
    try {
      this.log.info('Getting Fandom metadata', { id, title });

      const result = await this.provider.getMangaDetails(id, title);

      if (!result) {
        throw new Error(`Manga not found: ${id}`);
      }

      // Use the shared transformation function
      const transformed = transformToSearchResult(result);

      // Override id and title if they were provided as parameters
      return {
        ...transformed,
        id: result.id || id,
        title: result.title || title || transformed.title
      };
    } catch (error: unknown) {
      this.log.error('Failed to get Fandom metadata', {
        id,
        title,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }
}

// Export singleton instance
export const fandomProvider = new FandomSearchProvider();