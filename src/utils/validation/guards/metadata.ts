/**
 * Consolidated Metadata Type Guards
 * 
 * This module provides comprehensive type guards for validating metadata objects
 * from various sources including external APIs and internal data structures.
 * 
 * Consolidated from:
 * - src/utils/metadata/type-guards.ts (unified metadata)
 * - src/utils/validation/metadata-type-guards.ts (search results)
 */


import { MangaPublicationStatus } from '@prisma/client';

import type { SearchResult, AniListSearchResult, ComicVineSearchResult, MangaSearchResult, ProviderMetadata, PersonInfo, TagInfo } from '@/types/search.types';
import { toStringId, isValidId } from '@/utils/id-converters';


import { isProviderMetadata } from './domain-guards';

import type { Manga, Chapter } from '@prisma/client';

// Define Author type locally since it's not in Prisma
interface Author {
  id: string | number;
  name: string;
}

// Define missing types locally
type MangaFormat = 'MANGA' | 'NOVEL' | 'ONE_SHOT' | 'DOUJIN' | 'MANHWA' | 'MANHUA' | 'OEL';
interface FandomSearchResult extends MangaSearchResult {
  provider: 'fandom';
}

// PersonInfo now imported from search.types.ts

interface StaffInfo {
  name: string;
  role: string;
  image?: string;
}
interface CharacterInfo {
  name: string;
  role?: string;
  image?: string;
}

// TagInfo now imported from search.types.ts

interface RankingInfo {
  type: string;
  rank: number;
  allTime?: boolean;
  year?: number;
  season?: string;
}
interface ExternalLinkInfo {
  site: string;
  url: string;
  type?: string;
  language?: string;
}
interface CoverImages {
  extraLarge?: string;
  large?: string;
  medium?: string;
  color?: string;
}
interface VolumeInfo {
  number?: number;
  title?: string;
  coverImage?: string;
}
interface ChapterInfo {
  number?: number;
  title?: string;
  volumeNumber?: number;
}
interface ExternalIds {
  [key: string]: string | undefined;
}
interface MetadataQuality {
  completeness: number;
  accuracy: number;
  freshness: number;
  lastUpdated: Date;
}
interface UnifiedMangaMetadata {
  title: string;
  titles?: Record<string, string>;
  description?: string;
  publicationStatus?: MangaPublicationStatus;
  format?: MangaFormat;
  authors?: PersonInfo[];
  artists?: PersonInfo[];
  staff?: StaffInfo[];
  characters?: CharacterInfo[];
  tags?: TagInfo[];
  rankings?: RankingInfo[];
  externalLinks?: ExternalLinkInfo[];
  coverImages?: CoverImages;
  volumes?: VolumeInfo[];
  chapters?: ChapterInfo[];
  externalIds?: ExternalIds;
  quality?: MetadataQuality;
  providerMetadata?: ProviderMetadata[];
}
type PartialUnifiedMetadata = Partial<UnifiedMangaMetadata>;

// ============================================================================
// Basic Type Guards
// ============================================================================

/**
 * Check if value is a non-null object
 */
export function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Check if value is a valid string
 */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Check if value is a valid number
 */
export function isValidNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value) && isFinite(value);
}

/**
 * Check if value is a valid Date
 */
export function isValidDate(value: unknown): value is Date {
  return value instanceof Date && !isNaN(value.getTime());
}

/**
 * Check if array is non-empty
 */
export function isNonEmptyArray<T>(value: unknown, itemGuard?: (item: unknown) => item is T): value is T[] {
  if (!Array.isArray(value) || value.length === 0) {
    return false;
  }
  if (itemGuard) {
    return value.every(item => itemGuard(item));
  }
  return true;
}

// ============================================================================
// ID Conversion Utilities
// ============================================================================

// ============================================================================
// Enum Type Guards
// ============================================================================

/**
 * Check if value is a valid publication status
 */
export function isValidPublicationStatus(value: unknown): value is MangaPublicationStatus {
  return typeof value === 'string' && Object.values(MangaPublicationStatus).includes(value as MangaPublicationStatus);
}

/**
 * Check if value is a valid manga format
 */
export function isValidFormat(value: unknown): value is MangaFormat {
  const validFormats: MangaFormat[] = ['MANGA', 'NOVEL', 'ONE_SHOT', 'DOUJIN', 'MANHWA', 'MANHUA', 'OEL'];
  return typeof value === 'string' && validFormats.includes(value as MangaFormat);
}

// ============================================================================
// Metadata Component Type Guards
// ============================================================================

/**
 * Check if value is PersonInfo
 */
export function isPersonInfo(value: unknown): value is PersonInfo {
  if (!isObject(value)) return false;
  const person = value as Record<string, unknown>;
  return isNonEmptyString(person["name"]) && (person["role"] === null || isNonEmptyString(person["role"])) && (person["image"] === null || typeof person["image"] === 'string');
}

/**
 * Check if value is StaffInfo
 */
export function isStaffInfo(value: unknown): value is StaffInfo {
  if (!isObject(value)) return false;
  const staff = value as Record<string, unknown>;
  return isNonEmptyString(staff["name"]) && isNonEmptyString(staff["role"]) && (staff["image"] === null || typeof staff["image"] === 'string');
}

/**
 * Check if value is CharacterInfo
 */
export function isCharacterInfo(value: unknown): value is CharacterInfo {
  if (!isObject(value)) return false;
  const character = value as Record<string, unknown>;
  return isNonEmptyString(character["name"]) && (character["role"] === null || isNonEmptyString(character["role"])) && (character["image"] === null || typeof character["image"] === 'string');
}

/**
 * Check if value is TagInfo
 */
export function isTagInfo(value: unknown): value is TagInfo {
  if (!isObject(value)) return false;
  const tag = value as Record<string, unknown>;
  return isNonEmptyString(tag["name"]) && (tag["category"] === null || isNonEmptyString(tag["category"])) && (tag["rank"] === null || isValidNumber(tag["rank"])) && (tag["isMediaSpoiler"] === null || typeof tag["isMediaSpoiler"] === 'boolean');
}

/**
 * Check if value is RankingInfo
 */
export function isRankingInfo(value: unknown): value is RankingInfo {
  if (!isObject(value)) return false;
  const ranking = value as Record<string, unknown>;
  return isNonEmptyString(ranking["type"]) && isValidNumber(ranking["rank"]) && (ranking["allTime"] === null || typeof ranking["allTime"] === 'boolean') && (ranking["year"] === null || isValidNumber(ranking["year"])) && (ranking["season"] === null || isNonEmptyString(ranking["season"]));
}

/**
 * Check if value is ExternalLinkInfo
 */
export function isExternalLinkInfo(value: unknown): value is ExternalLinkInfo {
  if (!isObject(value)) return false;
  const link = value as Record<string, unknown>;
  return isNonEmptyString(link["site"]) && isNonEmptyString(link["url"]) && (link["type"] === null || isNonEmptyString(link["type"])) && (link["language"] === null || isNonEmptyString(link["language"]));
}

/**
 * Check if value is CoverImages
 */
export function isCoverImages(value: unknown): value is CoverImages {
  if (!isObject(value)) return false;
  const images = value as Record<string, unknown>;
  return (images["extraLarge"] === null || typeof images["extraLarge"] === 'string') && (images["large"] === null || typeof images["large"] === 'string') && (images["medium"] === null || typeof images["medium"] === 'string') && (images["color"] === null || typeof images["color"] === 'string');
}

/**
 * Check if value is VolumeInfo
 */
export function isVolumeInfo(value: unknown): value is VolumeInfo {
  if (!isObject(value)) return false;
  const volume = value as Record<string, unknown>;
  return (volume["number"] === null || isValidNumber(volume["number"])) && (volume["title"] === null || isNonEmptyString(volume["title"])) && (volume["coverImage"] === null || typeof volume["coverImage"] === 'string');
}

/**
 * Check if value is ChapterInfo
 */
export function isChapterInfo(value: unknown): value is ChapterInfo {
  if (!isObject(value)) return false;
  const chapter = value as Record<string, unknown>;
  return (chapter["number"] === null || isValidNumber(chapter["number"])) && (chapter["title"] === null || isNonEmptyString(chapter["title"])) && (chapter["volumeNumber"] === null || isValidNumber(chapter["volumeNumber"]));
}

/**
 * Check if value is ExternalIds
 */
export function isExternalIds(value: unknown): value is ExternalIds {
  if (!isObject(value)) return false;
  const ids = value as Record<string, unknown>;
  // All properties are optional strings
  for (const key in ids) {
    if (ids[key] !== null && typeof ids[key] !== 'string') {
      return false;
    }
  }
  return true;
}

/**
 * Check if value is MetadataQuality
 */
export function isMetadataQuality(value: unknown): value is MetadataQuality {
  if (!isObject(value)) return false;
  const quality = value as Record<string, unknown>;
  return isValidNumber(quality["completeness"]) && quality["completeness"] >= 0 && quality["completeness"] <= 1 && isValidNumber(quality["accuracy"]) && quality["accuracy"] >= 0 && quality["accuracy"] <= 1 && isValidNumber(quality["freshness"]) && quality["freshness"] >= 0 && quality["freshness"] <= 1 && isValidDate(quality["lastUpdated"]);
}

// isProviderMetadata is exported from domain-guards.ts to avoid duplication

// ============================================================================
// Metadata Validation Helpers
// ============================================================================

/**
 * Validates a single optional field using a provided validator function.
 *
 * This helper reduces complexity in metadata type guards by providing a
 * consistent way to validate optional fields. It returns `true` for
 * null/undefined values (treating them as valid absences), and otherwise
 * delegates to the provided validator function.
 *
 * @template T - The expected type of the field after validation
 * @param value - The value to validate (can be null, undefined, or any type)
 * @param validator - A type guard function that validates the value
 * @returns `true` if value is null/undefined OR if it passes the validator, `false` otherwise
 *
 * @remarks
 * Complexity: 3 (single conditional with OR logic)
 * Use this helper to avoid repetitive null checks in type guards.
 *
 * @example
 * ```typescript
 * // Validate optional string field
 * if (!validateOptionalField(metadata.description, isNonEmptyString)) {
 *   return false;
 * }
 *
 * // Validate optional array field with item validator
 * if (!validateOptionalField(metadata.authors, (v) => isNonEmptyArray(v, isPersonInfo))) {
 *   return false;
 * }
 * ```
 */
function validateOptionalField<T>(
  value: unknown,
  validator: (v: unknown) => v is T
): boolean {
  return value === null || value === undefined || validator(value);
}

/**
 * Map of field names to their corresponding validation functions.
 * Used to validate all optional fields in UnifiedMangaMetadata.
 *
 * Each validator is a type guard function that returns `true` if the value
 * matches the expected type for that field. The map contains validators for
 * all 17 optional fields in UnifiedMangaMetadata (excluding the required `title` field).
 *
 * @remarks
 * This constant serves as the single source of truth for metadata field
 * validation logic, promoting consistency and reducing code duplication.
 *
 * Fields included:
 * - titles: Record<string, string>
 * - description: string
 * - publicationStatus: MangaPublicationStatus enum
 * - format: MangaFormat enum
 * - authors, artists: PersonInfo[]
 * - staff: StaffInfo[]
 * - characters: CharacterInfo[]
 * - tags: TagInfo[]
 * - rankings: RankingInfo[]
 * - externalLinks: ExternalLinkInfo[]
 * - coverImages: CoverImages
 * - volumes: VolumeInfo[]
 * - chapters: ChapterInfo[]
 * - externalIds: ExternalIds
 * - quality: MetadataQuality
 * - providerMetadata: ProviderMetadata[]
 */
const UNIFIED_METADATA_FIELD_VALIDATORS = new Map<string, (v: unknown) => boolean>([
  ['titles', isObject],
  ['description', isNonEmptyString],
  ['publicationStatus', isValidPublicationStatus],
  ['format', isValidFormat],
  ['authors', (v: unknown) => isNonEmptyArray(v, isPersonInfo)],
  ['artists', (v: unknown) => isNonEmptyArray(v, isPersonInfo)],
  ['staff', (v: unknown) => isNonEmptyArray(v, isStaffInfo)],
  ['characters', (v: unknown) => isNonEmptyArray(v, isCharacterInfo)],
  ['tags', (v: unknown) => isNonEmptyArray(v, isTagInfo)],
  ['rankings', (v: unknown) => isNonEmptyArray(v, isRankingInfo)],
  ['externalLinks', (v: unknown) => isNonEmptyArray(v, isExternalLinkInfo)],
  ['coverImages', isCoverImages],
  ['volumes', (v: unknown) => isNonEmptyArray(v, isVolumeInfo)],
  ['chapters', (v: unknown) => isNonEmptyArray(v, isChapterInfo)],
  ['externalIds', isExternalIds],
  ['quality', isMetadataQuality],
  ['providerMetadata', (v: unknown) => isNonEmptyArray(v, isProviderMetadata)],
]);

/**
 * Validates multiple fields from a metadata object using a validation map.
 *
 * This helper iterates through a validation map and validates each corresponding
 * field in the metadata object. It uses fail-fast behavior, returning `false`
 * immediately upon encountering the first validation failure.
 *
 * @param metadata - The metadata object to validate (should be a Record<string, unknown>)
 * @param validationMap - A Map of field names to validation functions
 * @returns `true` if all fields pass validation (or are null/undefined), `false` on first failure
 *
 * @remarks
 * Complexity: 4 (for-of loop with single conditional check)
 * This helper significantly reduces complexity when validating multiple fields.
 *
 * @example
 * ```typescript
 * const metadata = { title: 'Example', authors: [...], tags: [...] };
 * const isValid = validateFieldsFromMap(metadata, UNIFIED_METADATA_FIELD_VALIDATORS);
 * if (!isValid) {
 *   return false; // One or more fields failed validation
 * }
 * ```
 */
function validateFieldsFromMap(
  metadata: Record<string, unknown>,
  validationMap: Map<string, (v: unknown) => boolean>
): boolean {
  for (const [fieldName, validator] of validationMap) {
    if (!validateOptionalField(metadata[fieldName], validator as (v: unknown) => v is unknown)) {
      return false;
    }
  }
  return true;
}

/**
 * Check if value is UnifiedMangaMetadata
 */
export function isUnifiedMangaMetadata(value: unknown): value is UnifiedMangaMetadata {
  if (!isObject(value)) return false;
  const metadata = value as Record<string, unknown>;

  // Check required fields
  if (!isNonEmptyString(metadata["title"])) return false;

  // Validate all optional fields using helper
  return validateFieldsFromMap(metadata, UNIFIED_METADATA_FIELD_VALIDATORS);
}

// ============================================================================
// Search Result Type Guards
// ============================================================================

/**
 * Check if value is a SearchResult
 */
export function isSearchResult(result: unknown): result is SearchResult {
  if (!isObject(result)) return false;
  const obj = result as Record<string, unknown>;
  return isValidId(obj["id"]) && isNonEmptyString(obj["title"]) && isNonEmptyString(obj["provider"]);
}

/**
 * Check if value is a MangaSearchResult
 */
export function isMetadataSearchResult(result: unknown): result is MangaSearchResult {
  if (!isSearchResult(result)) return false;
  const obj = result as unknown as Record<string, unknown>;
  return (obj["coverImage"] === null || typeof obj["coverImage"] === 'string') && (obj["author"] === null || typeof obj["author"] === 'string') && (obj["status"] === null || typeof obj["status"] === 'string');
}

/**
 * Check if value is an AniListSearchResult
 */
export function isAniListSearchResult(result: unknown): result is AniListSearchResult {
  if (!isSearchResult(result)) return false;
  const obj = result as unknown as Record<string, unknown>;
  return obj["provider"] === 'anilist';
}

/**
 * Check if value is a ComicVineSearchResult
 */
export function isComicVineSearchResult(result: unknown): result is ComicVineSearchResult {
  if (!isSearchResult(result)) return false;
  const obj = result as unknown as Record<string, unknown>;
  return obj["provider"] === 'comicvine';
}

/**
 * Check if value is a FandomSearchResult
 */
export function isFandomSearchResult(result: unknown): result is FandomSearchResult {
  if (!isSearchResult(result)) return false;
  const obj = result as unknown as Record<string, unknown>;
  return obj["provider"] === 'fandom';
}

// ============================================================================
// Entity Type Guards
// ============================================================================

/**
 * Check if value is a Manga entity
 */
export function isManga(manga: unknown): manga is Manga {
  if (!isObject(manga)) return false;
  const obj = manga as Record<string, unknown>;
  return isValidId(obj["id"]) && isNonEmptyString(obj["title"]) && (obj["status"] === null || typeof obj["status"] === 'string');
}

/**
 * Check if value is a Chapter entity
 */
export function isChapter(chapter: unknown): chapter is Chapter {
  if (!isObject(chapter)) return false;
  const obj = chapter as Record<string, unknown>;
  return isValidId(obj["id"]) && (typeof obj["number"] === 'number' || typeof obj["number"] === 'string') && isValidId(obj["mangaId"]);
}

/**
 * Check if value is an Author entity
 */
export function isAuthor(author: unknown): author is Author {
  if (!isObject(author)) return false;
  const obj = author as Record<string, unknown>;
  return isValidId(obj["id"]) && isNonEmptyString(obj["name"]);
}

// ============================================================================
// Array Type Guards
// ============================================================================

/**
 * Check if value is a valid Manga array
 */
export function isValidMangaArray(array: unknown): array is Manga[] {
  return Array.isArray(array) && array.every(item => isManga(item));
}

/**
 * Check if value is a valid Chapter array
 */
export function isValidChapterArray(array: unknown): array is Chapter[] {
  return Array.isArray(array) && array.every(item => isChapter(item));
}

/**
 * Check if value is a valid Author array
 */
export function isValidAuthorArray(array: unknown): array is Author[] {
  return Array.isArray(array) && array.every(item => isAuthor(item));
}

/**
 * Check if value is a valid SearchResult array
 */
export function isValidSearchResultArray(array: unknown): array is SearchResult[] {
  return Array.isArray(array) && array.every(item => isSearchResult(item));
}

/**
 * Check if value is a string array
 */
export function isStringArray(array: unknown): array is string[] {
  return Array.isArray(array) && array.every(item => typeof item === 'string');
}

/**
 * Check if value is a number array
 */
export function isNumberArray(array: unknown): array is number[] {
  return Array.isArray(array) && array.every(item => typeof item === 'number');
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Extract provider ID from a search result
 */
export function extractProviderIdFromResult(result: SearchResult | MangaSearchResult): string {
  return toStringId(result["id"]);
}

/**
 * Convert value to a valid Date or undefined
 */
export function toValidDate(value: unknown): Date | undefined {
  if (value instanceof Date) {
    return isValidDate(value) ? value : undefined;
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    return isValidDate(date) ? date : undefined;
  }
  return undefined;
}

/**
 * Safely get nested property from an object
 */
export function safelyGetNestedProperty<T>(obj: unknown, path: string[], defaultValue?: T): T | undefined {
  if (!isObject(obj)) return defaultValue;
  let current: unknown = obj;
  for (const key of path) {
    if (!isObject(current) || !(key in current)) {
      return defaultValue;
    }
    current = current[key];
  }
  return current as T;
}

/**
 * Check if value is a partial UnifiedMangaMetadata
 * Refactored to reduce cyclomatic complexity from 56 to ~10
 */
export function isPartialUnifiedMetadata(value: unknown): value is PartialUnifiedMetadata {
  if (!isObject(value)) return false;

  const metadata = value as Record<string, unknown>;

  // Check if at least one valid field exists using Array.some()
  const knownFields = ['title', ...Array.from(UNIFIED_METADATA_FIELD_VALIDATORS.keys())];
  const hasAtLeastOneField = knownFields.some(field => metadata[field] !== undefined);
  if (!hasAtLeastOneField) return false;

  // Validate title separately (not in map because it's required in isUnifiedMangaMetadata)
  if (metadata["title"] !== undefined && !validateOptionalField(metadata["title"], isNonEmptyString)) {
    return false;
  }

  // Validate all other fields using helper
  return validateFieldsFromMap(metadata, UNIFIED_METADATA_FIELD_VALIDATORS);
}