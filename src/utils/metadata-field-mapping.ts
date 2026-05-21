/**
 * Unified Metadata Field Mapping Utilities
 *
 * Provides a centralized system for extracting and normalizing metadata fields
 * across different providers and data structures.
 */
import { logger } from './logging';

/**
 * Type definitions for provider-specific metadata structures
 */

// Title structure (AniList, ComicVine)
interface TitleObject {
  english?: string;
  romaji?: string;
  native?: string;
}

// Cover image structure (AniList)
interface CoverImageObject {
  extraLarge?: string;
  large?: string;
  medium?: string;
  small?: string;
}

// Cover image structure (ComicVine)
interface ComicVineImageObject {
  super_url?: string;
  large_url?: string;
  medium_url?: string;
  original_url?: string;
}

// Tag structure (AniList)
interface TagObject {
  name: string;
  rank?: number;
}

// Date structure (AniList, ComicVine)
interface DateObject {
  year?: number;
  month?: number;
  day?: number;
}

// Generic metadata object that can contain any field
interface MetadataRecord extends Record<string, unknown> {
  metadata?: Record<string, unknown>;
}

// Provider-specific metadata types
// Intentionally unused - serves as documentation for all possible metadata fields
// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface ProviderMetadata {
  title?: string | TitleObject;
  name?: string;
  titleEnglish?: string;
  alternativeTitles?: string[];
  synonyms?: string[];
  aliases?: string[];
  altTitles?: string[];
  otherNames?: string[];
  description?: string;
  summary?: string;
  synopsis?: string;
  deck?: string;
  overview?: string;
  coverImage?: string | CoverImageObject;
  cover?: string;
  coverUrl?: string;
  image?: string | ComicVineImageObject;
  thumbnail?: string;
  posterImage?: string;
  bannerImage?: string;
  banner?: string;
  headerImage?: string;
  backgroundImage?: string;
  status?: string;
  publicationStatus?: string;
  releaseStatus?: string;
  state?: string;
  format?: string;
  type?: string;
  mediaType?: string;
  mangaType?: string;
  volumes?: number;
  volumeCount?: number;
  totalVolumes?: number;
  volume_count?: number;
  count_of_issues?: number;
  issues?: unknown[];
  chapters?: number;
  chapterCount?: number;
  totalChapters?: number;
  chapter_count?: number;
  episodeCount?: number;
  releaseYear?: number;
  year?: number;
  startYear?: number;
  start_year?: number;
  publicationYear?: number;
  startDate?: string | DateObject;
  dateStarted?: string | DateObject;
  firstPublished?: string | DateObject;
  start_date?: string | DateObject;
  endDate?: string | DateObject;
  dateEnded?: string | DateObject;
  lastPublished?: string | DateObject;
  end_date?: string | DateObject;
  authors?: string[] | unknown[];
  creators?: string[] | unknown[];
  mangaka?: string[] | unknown[];
  writers?: string[] | unknown[];
  artists?: string[] | unknown[];
  publisher?: string;
  publishers?: string[];
  publisherName?: string;
  publication?: string;
  genres?: string[];
  categories?: string[];
  genre?: string;
  genreList?: string[];
  tags?: string[] | TagObject[];
  themes?: string[];
  keywords?: string[];
  labels?: string[];
  averageScore?: number;
  score?: number;
  meanScore?: number;
  rating?: number;
  average_rating?: number;
  popularity?: number;
  popularityRank?: number;
  views?: number;
  followers?: number;
  favorites?: number;
  favourites?: number;
  likes?: number;
  bookmarks?: number;
  id?: string | number;
  anilistId?: string | number;
  anilist_id?: string | number;
  alId?: string | number;
  malId?: string | number;
  idMal?: string | number;
  myAnimeListId?: string | number;
  mal_id?: string | number;
  comicvineId?: string | number;
  cvId?: string | number;
  comicvine_id?: string | number;
  volumeId?: string | number;
  kitsuId?: string | number;
  kitsu_id?: string | number;
  countryOfOrigin?: string;
  country?: string;
  origin?: string;
  country_of_origin?: string;
  isAdult?: boolean;
  adult?: boolean;
  mature?: boolean;
  nsfw?: boolean;
  is_adult?: boolean;
  externalLinks?: string[];
  links?: string[];
  urls?: string[];
  external_links?: string[];
  staff?: unknown[];
  team?: unknown[];
  contributors?: unknown[];
  characters?: unknown[];
  cast?: unknown[];
  characterList?: unknown[];
  provider?: string;
  source?: string;
  site_detail_url?: string;
  wikiUrl?: string;
  articlePath?: string;
  contentRating?: string;
}
/**
 * Field mapping configuration
 * Maps standard field names to provider-specific alternatives
 */
export const FIELD_MAPPINGS: Record<string, string[]> = {
  // Basic Information
  title: ['title', 'name', 'titleEnglish', 'title.english', 'title.romaji'],
  alternativeTitles: ['alternativeTitles', 'synonyms', 'aliases', 'altTitles', 'otherNames'],
  description: ['description', 'summary', 'synopsis', 'deck', 'overview'],
  // Images
  coverImage: ['coverImage', 'cover', 'coverUrl', 'image', 'thumbnail', 'posterImage', 'coverImage.large', 'coverImage.medium'],
  bannerImage: ['bannerImage', 'banner', 'headerImage', 'backgroundImage'],
  // Publication Info
  status: ['status', 'publicationStatus', 'releaseStatus', 'state'],
  format: ['format', 'type', 'mediaType', 'mangaType'],
  volumes: ['volumes', 'volumeCount', 'totalVolumes', 'volume_count', 'count_of_issues'],
  chapters: ['chapters', 'chapterCount', 'totalChapters', 'chapter_count', 'episodeCount'],
  releaseYear: ['releaseYear', 'year', 'startYear', 'start_year', 'publicationYear'],
  startDate: ['startDate', 'dateStarted', 'firstPublished', 'start_date'],
  endDate: ['endDate', 'dateEnded', 'lastPublished', 'end_date'],
  // Authors & Publishers
  authors: ['authors', 'creators', 'mangaka', 'writers', 'artists'],
  publisher: ['publisher', 'publishers', 'publisherName', 'publication'],
  // Categories & Tags
  genres: ['genres', 'categories', 'genre', 'genreList'],
  tags: ['tags', 'themes', 'keywords', 'labels'],
  // Ratings & Popularity
  averageScore: ['averageScore', 'score', 'meanScore', 'rating', 'average_rating'],
  popularity: ['popularity', 'popularityRank', 'views', 'followers'],
  favorites: ['favorites', 'favourites', 'likes', 'bookmarks'],
  // External IDs
  anilistId: ['id', 'anilistId', 'anilist_id', 'alId'],
  malId: ['malId', 'idMal', 'myAnimeListId', 'mal_id'],
  comicvineId: ['comicvineId', 'cvId', 'comicvine_id', 'volumeId'],
  kitsuId: ['kitsuId', 'kitsu_id'],
  wikipediaUrl: ['wikipediaUrl', 'wikiUrl', 'wikipedia_url'],
  // Additional Metadata
  countryOfOrigin: ['countryOfOrigin', 'country', 'origin', 'country_of_origin'],
  isAdult: ['isAdult', 'adult', 'mature', 'nsfw', 'is_adult'],
  externalLinks: ['externalLinks', 'links', 'urls', 'external_links'],
  // Staff & Characters
  staff: ['staff', 'creators', 'team', 'contributors'],
  characters: ['characters', 'cast', 'characterList']
};
/**
 * Helper type guard functions
 */
function isTitleObject(value: unknown): value is TitleObject {
  return typeof value === 'object' && value !== null &&
    ('english' in value || 'romaji' in value || 'native' in value);
}

function isCoverImageObject(value: unknown): value is CoverImageObject {
  return typeof value === 'object' && value !== null &&
    ('extraLarge' in value || 'large' in value || 'medium' in value || 'small' in value);
}

function isComicVineImageObject(value: unknown): value is ComicVineImageObject {
  return typeof value === 'object' && value !== null &&
    ('super_url' in value || 'large_url' in value || 'medium_url' in value || 'original_url' in value);
}

function isTagObject(value: unknown): value is TagObject {
  return typeof value === 'object' && value !== null && 'name' in value;
}

function isDateObject(value: unknown): value is DateObject {
  return typeof value === 'object' && value !== null && 'year' in value;
}

/**
 * Provider-specific field transformations
 */
export const PROVIDER_TRANSFORMS: Record<string, Record<string, (value: unknown) => unknown>> = {
  anilist: {
    title: (value: unknown) => {
      if (isTitleObject(value)) {
        return value.english ?? value.romaji ?? value.native ?? 'Unknown';
      }
      return value;
    },
    coverImage: (value: unknown) => {
      if (isCoverImageObject(value)) {
        return value.extraLarge ?? value.large ?? value.medium ?? value.small;
      }
      return value;
    },
    tags: (value: unknown) => {
      if (Array.isArray(value)) {
        return value.map((tag: unknown) => {
          if (isTagObject(tag)) {
            return { name: tag.name, rank: tag.rank ?? 0 };
          }
          return tag;
        });
      }
      return value;
    },
    startDate: (value: unknown) => {
      if (isDateObject(value) && value.year) {
        return new Date(value.year, (value.month ?? 1) - 1, value.day ?? 1).toISOString();
      }
      return value;
    }
  },
  comicvine: {
    volumes: (value: unknown) => {
      // ComicVine uses count_of_issues for volumes
      return value;
    },
    coverImage: (value: unknown) => {
      if (isComicVineImageObject(value)) {
        return value.super_url ?? value.large_url ?? value.medium_url ?? value.original_url;
      }
      return value;
    }
  }
};
/**
 * Helper type guard for MetadataRecord
 */
function isMetadataRecord(value: unknown): value is MetadataRecord {
  return typeof value === 'object' && value !== null;
}

/**
 * Extract a field value from a data source using multiple strategies
 */
export function extractField(source: unknown, fieldName: string, provider?: string): unknown {
  if (!isMetadataRecord(source)) {
    return null;
  }

  // Try direct field access
  const directValue = source[fieldName];
  if (directValue !== null) {
    return applyTransform(directValue, fieldName, provider);
  }

  // Try metadata object
  const metadata = source.metadata;
  if (isMetadataRecord(metadata)) {
    const metadataValue = metadata[fieldName];
    if (metadataValue !== null) {
      return applyTransform(metadataValue, fieldName, provider);
    }
  }

  // Try field mappings
  const mappings = FIELD_MAPPINGS[fieldName];
  if (mappings) {
    for (const mapping of mappings) {
      // Handle nested path notation (e.g., "title.english")
      const value = getNestedValue(source, mapping);
      if (value !== null) {
        return applyTransform(value, fieldName, provider);
      }
      // Also check in metadata
      if (isMetadataRecord(metadata)) {
        const metadataValue = getNestedValue(metadata, mapping);
        if (metadataValue !== null) {
          return applyTransform(metadataValue, fieldName, provider);
        }
      }
    }
  }
  return null;
}
/**
 * Apply provider-specific transformations
 */
function applyTransform(value: unknown, fieldName: string, provider?: string): unknown {
  if (!provider) {
    return value;
  }

  const providerTransforms = PROVIDER_TRANSFORMS[provider];
  if (!providerTransforms) {
    return value;
  }

  const transform = providerTransforms[fieldName];
  if (transform) {
    try {
      return transform(value);
    }
    catch (error: unknown) {
      logger.warn(`Failed to transform field ${fieldName} for provider ${provider}:`, error);
      return value;
    }
  }
  return value;
}
/**
 * Get nested value from object using dot notation
 */
function getNestedValue(obj: unknown, path: string): unknown {
  const keys = path.split('.');
  let current: unknown = obj;

  for (const key of keys) {
    if (!isMetadataRecord(current)) {
      return undefined;
    }
    current = current[key];
    if (current === null) {
      return undefined;
    }
  }

  return current;
}
/**
 * Extract all standard fields from a source
 */
export function extractAllFields(source: unknown, provider?: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const fieldName of Object.keys(FIELD_MAPPINGS)) {
    const value = extractField(source, fieldName, provider);
    if (value !== null) {
      // Skip empty arrays and strings
      if (Array.isArray(value) && value.length === 0) {
        continue;
      }
      if (typeof value === 'string' && value.trim() === '') {
        continue;
      }
      result[fieldName] = value;
    }
  }
  return result;
}
/**
 * Calculate metadata completeness score
 */
export function calculateCompleteness(metadata: Record<string, unknown>): {
  score: number;
  percentage: number;
  quality: 'high' | 'medium' | 'low';
  missingFields: string[];
} {
  const weights: Record<string, number> = {
    // Required fields (weight: 3)
    title: 3,
    coverImage: 3,
    description: 3,
    // Important fields (weight: 2)
    status: 2,
    volumes: 2,
    chapters: 2,
    genres: 2,
    alternativeTitles: 2,
    authors: 2,
    // Nice to have (weight: 1)
    bannerImage: 1,
    tags: 1,
    averageScore: 1,
    popularity: 1,
    startDate: 1,
    endDate: 1,
    publisher: 1,
    externalLinks: 1
  };
  let totalWeight = 0;
  let achievedWeight = 0;
  const missingFields: string[] = [];
  for (const [field, weight] of Object.entries(weights)) {
    totalWeight += weight;
    const value = metadata[field];
    if (value !== null) {
      // Check for meaningful values
      if (Array.isArray(value) && value.length > 0) {
        achievedWeight += weight;
      } else if (typeof value === 'string' && value.trim() !== '' && value !== 'Unknown' && value !== '/cover-not-found.jpg') {
        achievedWeight += weight;
      } else if (typeof value === 'number') {
        achievedWeight += weight;
      } else if (typeof value === 'boolean') {
        achievedWeight += weight;
      }
    } else {
      missingFields.push(field);
    }
  }
  const percentage = Math.round(achievedWeight / totalWeight * 100);
  const quality = percentage >= 80 ? 'high' : percentage >= 50 ? 'medium' : 'low';
  return {
    score: achievedWeight,
    percentage,
    quality,
    missingFields
  };
}
/**
 * Merge metadata from multiple sources with priority
 */
export function mergeMetadata(sources: Array<{
  data: unknown;
  provider?: string;
  priority?: number;
}>): Record<string, unknown> {
  // Sort by priority (higher first)
  const sortedSources = sources.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  const merged: Record<string, unknown> = {};
  const fieldSources: Record<string, string> = {};
  for (const fieldName of Object.keys(FIELD_MAPPINGS)) {
    for (const source of sortedSources) {
      const value = extractField(source.data, fieldName, source.provider);
      if (value !== null) {
        // Skip if we already have a better value
        if (merged[fieldName] !== undefined && !shouldReplaceValue(fieldName, value, merged[fieldName])) {
          continue;
        }

        merged[fieldName] = value;
        fieldSources[fieldName] = source.provider ?? 'UNKNOWN';
      }
    }
  }
  // Add metadata about sources
  merged["_fieldSources"] = fieldSources;
  return merged;
}
/**
 * Validate and clean a string value
 */
function validateStringValue(value: string, fieldName: string): {
  valid: boolean;
  cleaned?: string;
  warning?: string;
} {
  const trimmed = value.trim();
  if (trimmed === '' || trimmed === 'Unknown' || trimmed === 'N/A') {
    return { valid: false, warning: `${fieldName} has no meaningful value` };
  }
  return { valid: true, cleaned: trimmed };
}

/**
 * Validate and clean an array value
 */
function validateArrayValue(value: unknown[], fieldName: string): {
  valid: boolean;
  cleaned?: unknown[];
  warning?: string;
} {
  const filtered = value.filter((item: unknown) => item !== null);
  if (filtered.length === 0) {
    return { valid: false, warning: `${fieldName} is an empty array` };
  }
  return { valid: true, cleaned: filtered };
}

/**
 * Validate a number value
 */
function validateNumberValue(value: number, fieldName: string): {
  valid: boolean;
  warning?: string;
} {
  if (isNaN(value) || !isFinite(value)) {
    return { valid: false, warning: `${fieldName} has invalid number value` };
  }
  return { valid: true };
}

/**
 * Validate and clean metadata
 */
export function validateMetadata(metadata: Record<string, unknown>): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  cleaned: Record<string, unknown>;
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  const cleaned: Record<string, unknown> = {};
  // Required fields
  if (!metadata["title"] || typeof metadata["title"] === 'string' && metadata["title"].trim() === '') {
    errors.push('Title is required');
  } else
  {
    cleaned["title"] = typeof metadata["title"] === 'string' ? metadata["title"].trim() : metadata["title"];
  }
  // Validate and clean each field
  for (const [field, value] of Object.entries(metadata)) {
    if (field === '_fieldSources') {
      cleaned[field] = value;
      continue;
    }
    if (value === null) {
      continue;
    }
    // Delegate to type-specific validators
    if (typeof value === 'string') {
      const result = validateStringValue(value, field);
      if (result.warning) warnings.push(result.warning);
      if (result.cleaned) cleaned[field] = result.cleaned;
    } else if (Array.isArray(value)) {
      const result = validateArrayValue(value, field);
      if (result.warning) warnings.push(result.warning);
      if (result.cleaned) cleaned[field] = result.cleaned;
    } else if (typeof value === 'number') {
      const result = validateNumberValue(value, field);
      if (result.warning) warnings.push(result.warning);
      else cleaned[field] = value;
    } else {
      cleaned[field] = value;
    }
  }
  // Validate image URLs
  if (cleaned["coverImage"] && typeof cleaned["coverImage"] === 'string') {
    if (cleaned["coverImage"] === '/cover-not-found.jpg' || !cleaned["coverImage"].match(/^https?:\/\/.+/)) {
      warnings.push('Cover image URL may be invalid');
    }
  }
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    cleaned
  };
}
/**
 * Provider detection from data structure
 */
export function detectProvider(source: unknown): string | null {
  if (!isMetadataRecord(source)) {
    return null;
  }

  // Check explicit provider field
  const provider = source["provider"];
  if (typeof provider === 'string') {
    return provider.toLowerCase();
  }

  const sourceField = source["source"];
  if (typeof sourceField === 'string') {
    return sourceField.toLowerCase();
  }

  // Detect by unique fields - AniList
  if ('idMal' in source || 'meanScore' in source || 'isAdult' in source) {
    return 'anilist';
  }

  // Detect by unique fields - ComicVine
  if ('site_detail_url' in source || 'deck' in source || 'count_of_issues' in source) {
    return 'comicvine';
  }

  // Detect by unique fields - Fandom
  if ('wikiUrl' in source || 'articlePath' in source) {
    return 'fandom';
  }

  return null;
}
/**
 * Compare two metadata objects and return differences
 */
export function compareMetadata(metadata1: Record<string, unknown>, metadata2: Record<string, unknown>): {
  added: Record<string, unknown>;
  removed: Record<string, unknown>;
  changed: Record<string, {
    old: unknown;
    new: unknown;
  }>;
  unchanged: string[];
} {
  const added: Record<string, unknown> = {};
  const removed: Record<string, unknown> = {};
  const changed: Record<string, {
    old: unknown;
    new: unknown;
  }> = {};
  const unchanged: string[] = [];
  const allKeys = new Set([...Object.keys(metadata1), ...Object.keys(metadata2)]);
  for (const key of allKeys) {
    if (key === '_fieldSources')
    continue;
    const value1 = metadata1[key];
    const value2 = metadata2[key];
    if (value1 === undefined && value2 !== undefined) {
      added[key] = value2;
    } else
    if (value1 !== null && value2 === undefined) {
      removed[key] = value1;
    } else
    if (JSON.stringify(value1) !== JSON.stringify(value2)) {
      changed[key] = { old: value1, new: value2 };
    } else
    {
      unchanged.push(key);
    }
  }
  return { added, removed, changed, unchanged };
}

/**
 * Determine if new value should replace existing value
 *
 * @param fieldName - The name of the field being compared
 * @param newValue - The new value to potentially use
 * @param existingValue - The current value
 * @returns True if the new value should replace the existing value
 */
function shouldReplaceValue(
  fieldName: string,
  newValue: unknown,
  existingValue: unknown
): boolean {
  // Prefer longer descriptions
  if (fieldName === 'description' && typeof newValue === 'string' && typeof existingValue === 'string') {
    return newValue.length > existingValue.length;
  }

  // Prefer arrays with more items
  if (Array.isArray(newValue) && Array.isArray(existingValue)) {
    return newValue.length > existingValue.length;
  }

  // Prefer higher resolution images
  if (fieldName === 'coverImage' && typeof newValue === 'string' && typeof existingValue === 'string') {
    return newValue.includes('large') || !existingValue.includes('large');
  }

  // Don't replace otherwise
  return false;
}