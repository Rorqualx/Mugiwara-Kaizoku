/**
 * BIO Label Types for ML Annotation
 *
 * This file contains only types and constants - no runtime dependencies.
 * Safe to import from client-side code.
 */

// ============================================================================
// BIO Label Types
// ============================================================================

export const BIO_LABELS = {
  // Core metadata (alphabetical)
  ALT_TITLE: 'ALT_TITLE',
  ARTIST: 'ARTIST',
  AUTHOR: 'AUTHOR',
  COVER_IMAGE: 'COVER_IMAGE',
  DEMOGRAPHIC: 'DEMOGRAPHIC',
  FORMAT: 'FORMAT',
  GENRE: 'GENRE',
  MAGAZINE: 'MAGAZINE',
  ORIGINAL_RUN: 'ORIGINAL_RUN', // Publication date range (start – end dates)
  START_DATE: 'START_DATE', // Series serialization start date
  END_DATE: 'END_DATE', // Series serialization end date (or "present")
  PAGE_TYPE: 'PAGE_TYPE', // Page classification: MANGA_PAGE, VOLUMES_PAGE, CHAPTERS_PAGE, etc.
  PUBLISHER: 'PUBLISHER',
  RELEASE_DATE: 'RELEASE_DATE',
  SERIES_SUMMARY: 'SERIES_SUMMARY',
  STATUS: 'STATUS',
  TAGS: 'TAGS',
  THEMES: 'THEMES',
  TITLE: 'TITLE',

  // Counts
  CHAPTER_COUNT: 'CHAPTER_COUNT',
  CHAPTER_RANGE: 'CHAPTER_RANGE', // Range of chapters in a volume (e.g., "12 - 15")
  PAGE_COUNT: 'PAGE_COUNT', // Number of pages in a chapter
  VOLUME_COUNT: 'VOLUME_COUNT',
  VOLUME_PAGE_COUNT: 'VOLUME_PAGE_COUNT', // Number of pages in a volume

  // Chapter-specific
  CHAPTER_ALT_TITLE: 'CHAPTER_ALT_TITLE', // Japanese/alternative title for chapter (in parentheses after title)
  CHAPTER_BELONGS_TO_VOLUME: 'CHAPTER_BELONGS_TO_VOLUME', // Which volume this chapter belongs to (on chapter pages)
  CHAPTER_COVER: 'CHAPTER_COVER',
  CHAPTER_NUMBER: 'CHAPTER_NUMBER', // The chapter's own number (on chapter pages, e.g., "Chapter 1")
  CHAPTER_RELEASE_DATE: 'CHAPTER_RELEASE_DATE',
  CHAPTER_SUMMARY: 'CHAPTER_SUMMARY',
  CHAPTER_TITLE: 'CHAPTER_TITLE',
  CHAPTER_URL: 'CHAPTER_URL',

  // Volume-specific
  ENGLISH_ISBN: 'ENGLISH_ISBN', // English edition ISBN
  ENGLISH_PUBLISHER: 'ENGLISH_PUBLISHER', // English edition publisher
  ENGLISH_RELEASE_DATE: 'ENGLISH_RELEASE_DATE', // English edition release date
  ISBN: 'ISBN', // Book identifier (ISBN-10 or ISBN-13)
  VOLUME_ALT_TITLE: 'VOLUME_ALT_TITLE', // Alternative/Japanese volume title
  VOLUME_COVER: 'VOLUME_COVER',
  VOLUME_NUMBER: 'VOLUME_NUMBER', // The volume's sequence number in series (e.g., Vol. 4)
  VOLUME_RELEASE_DATE: 'VOLUME_RELEASE_DATE',
  VOLUME_SUMMARY: 'VOLUME_SUMMARY',
  VOLUME_TITLE: 'VOLUME_TITLE',
  VOLUME_URL: 'VOLUME_URL', // Link to individual volume page

  // Navigation/Links - URLs to list pages (legacy - prefer CHAPTER_URL and VOLUME_URL)
  CHAPTERS_LIST_URL: 'CHAPTERS_LIST_URL', // Deprecated: use CHAPTER_URL
  GALLERY_URL: 'GALLERY_URL',
  VOLUMES_LIST_URL: 'VOLUMES_LIST_URL', // Deprecated: use VOLUME_URL

  // Table/Data sections - for identifying structured data areas
  CHAPTER_TABLE: 'CHAPTER_TABLE',
  GALLERY_SECTION: 'GALLERY_SECTION',
  VOLUME_CHAPTER_TABLE: 'VOLUME_CHAPTER_TABLE', // Combined volume+chapter table structure
  VOLUME_TABLE: 'VOLUME_TABLE',
} as const;

export type EntityType = (typeof BIO_LABELS)[keyof typeof BIO_LABELS];
export type BIOTag = 'O' | `B-${EntityType}` | `I-${EntityType}`;

export function getAllBIOTags(): BIOTag[] {
  const tags: BIOTag[] = ['O'];
  for (const entity of Object.values(BIO_LABELS)) {
    tags.push(`B-${entity}` as BIOTag);
    tags.push(`I-${entity}` as BIOTag);
  }
  return tags;
}

// ============================================================================
// Type Guards - Runtime validation for BIO types
// ============================================================================

/** Set of valid entity types for O(1) lookup */
const ENTITY_TYPE_SET = new Set<string>(Object.values(BIO_LABELS));

/** Set of valid BIO tags for O(1) lookup (computed once) */
let bioTagSetCache: Set<string> | null = null;
function getBioTagSet(): Set<string> {
  bioTagSetCache ??= new Set(getAllBIOTags());
  return bioTagSetCache;
}

/**
 * Type guard: checks if value is a valid EntityType
 *
 * @example
 * const val: unknown = 'TITLE';
 * if (isEntityType(val)) {
 *   // val is now typed as EntityType
 * }
 */
export function isEntityType(value: unknown): value is EntityType {
  return typeof value === 'string' && ENTITY_TYPE_SET.has(value);
}

/**
 * Type guard: checks if value is a valid BIOTag ('O', 'B-ENTITY', or 'I-ENTITY')
 *
 * @example
 * const val: unknown = 'B-TITLE';
 * if (isBIOTag(val)) {
 *   // val is now typed as BIOTag
 * }
 */
export function isBIOTag(value: unknown): value is BIOTag {
  return typeof value === 'string' && getBioTagSet().has(value);
}

/**
 * Assertion: throws if value is not a valid EntityType
 *
 * @throws Error if value is not a valid EntityType
 */
export function assertEntityType(value: unknown): asserts value is EntityType {
  if (!isEntityType(value)) {
    throw new Error(
      `Invalid EntityType: ${String(value)}. Expected one of: ${Object.values(BIO_LABELS).join(', ')}`
    );
  }
}

/**
 * Assertion: throws if value is not a valid BIOTag
 *
 * @throws Error if value is not a valid BIOTag
 */
export function assertBIOTag(value: unknown): asserts value is BIOTag {
  if (!isBIOTag(value)) {
    throw new Error(
      `Invalid BIOTag: ${String(value)}. Expected 'O' or 'B-ENTITY' or 'I-ENTITY' format.`
    );
  }
}

/**
 * Parse a BIO tag into its components
 *
 * @returns null if invalid, otherwise { prefix, entity } or { prefix: 'O', entity: null }
 */
export function parseBIOTag(
  tag: string
): { prefix: 'O'; entity: null } | { prefix: 'B' | 'I'; entity: EntityType } | null {
  if (tag === 'O') {
    return { prefix: 'O', entity: null };
  }

  const match = tag.match(/^([BI])-(.+)$/);
  if (!match) {
    return null;
  }

  const [, prefix, entity] = match;
  if ((prefix === 'B' || prefix === 'I') && isEntityType(entity)) {
    return { prefix, entity };
  }

  return null;
}
