/**
 * Ground Truth Fetcher
 *
 * Fetches ground truth metadata from AniList for accuracy comparison.
 * Converts AniList metadata to expected entities.
 *
 * @module auto-labeling/ground-truth
 */

import type { EntityType } from '@/server/ml/features/dom-linearizer';
import { createLogger } from '@/utils/logger';

import { normalizeEntityValue } from './parser-bridge';

import type { DiscoveredUrlType, ExpectedEntity } from './types';


const logger = createLogger('auto-labeling:ground-truth');

// ============================================================================
// Types
// ============================================================================

/**
 * AniList staff edge structure.
 */
interface AniListStaffEdge {
  role: string;
  node: {
    name: {
      full: string;
    };
  };
}

/**
 * AniList media response structure.
 */
interface AniListMedia {
  id: number;
  title: {
    romaji: string | null;
    english: string | null;
    native: string | null;
  };
  status: string | null;
  description: string | null;
  volumes: number | null;
  chapters: number | null;
  genres: string[] | null;
  staff: {
    edges: AniListStaffEdge[];
  } | null;
  startDate: {
    year: number | null;
    month: number | null;
    day: number | null;
  } | null;
  coverImage: {
    large: string | null;
    medium: string | null;
  } | null;
  format: string | null;
  isAdult: boolean;
}

/**
 * AniList API response structure.
 */
interface AniListApiResponse {
  data?: { Media?: AniListMedia };
  errors?: Array<{ message: string }>;
}

/**
 * Ground truth metadata from AniList.
 */
export interface GroundTruthMetadata {
  anilistId: number;
  titles: {
    romaji: string | null;
    english: string | null;
    native: string | null;
  };
  author: string | null;
  artist: string | null;
  status: string | null;
  volumeCount: number | null;
  chapterCount: number | null;
  genres: string[];
  summary: string | null;
  releaseYear: number | null;
  format: string | null;
  coverImage: string | null;
}

/**
 * Result of fetching ground truth.
 */
export interface GroundTruthResult {
  success: boolean;
  metadata: GroundTruthMetadata | null;
  expectedEntities: ExpectedEntity[];
  error?: string;
}

// ============================================================================
// AniList API
// ============================================================================

const ANILIST_API_URL = 'https://graphql.anilist.co';

const ANILIST_QUERY = `
query ($id: Int) {
  Media(id: $id, type: MANGA) {
    id
    title { romaji english native }
    status description volumes chapters genres
    staff { edges { role node { name { full } } } }
    startDate { year month day }
    coverImage { large medium }
    format isAdult
  }
}
`;

/**
 * Fetch metadata from AniList by ID.
 * @param anilistId - The AniList ID to fetch
 * @param urlType - Optional URL type to customize expected entities for page-level matching
 */
export async function fetchAnilistMetadata(
  anilistId: number,
  urlType?: DiscoveredUrlType
): Promise<GroundTruthResult> {
  const response = await callAniListApi(anilistId, urlType);
  if (!response.success) {
    return response;
  }
  return response;
}

/**
 * Call AniList GraphQL API.
 */
async function callAniListApi(
  anilistId: number,
  urlType?: DiscoveredUrlType
): Promise<GroundTruthResult> {
  try {
    const response = await fetch(ANILIST_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query: ANILIST_QUERY, variables: { id: anilistId } }),
    });

    if (!response.ok) {
      return createErrorResult(`AniList API error: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as AniListApiResponse;
    return parseAniListData(data, anilistId, urlType);
  } catch (error) {
    logger.error('Failed to fetch AniList metadata', error as Error, { anilistId });
    return createErrorResult(error instanceof Error ? error.message : String(error));
  }
}

/**
 * Parse AniList API response data.
 */
function parseAniListData(
  data: AniListApiResponse,
  anilistId: number,
  urlType?: DiscoveredUrlType
): GroundTruthResult {
  if (data.errors && data.errors.length > 0) {
    const errorMsg = data.errors.map(e => e.message).join(', ');
    return createErrorResult(`AniList GraphQL error: ${errorMsg}`);
  }

  const media = data.data?.Media;
  if (!media) {
    return createErrorResult(`No media found for AniList ID ${anilistId}`);
  }

  const metadata = convertToMetadata(media);
  // Use URL-type-aware entity building if urlType provided, otherwise default to series-level
  const expectedEntities = urlType
    ? buildExpectedEntitiesForUrlType(metadata, urlType)
    : buildExpectedEntities(metadata);

  return { success: true, metadata, expectedEntities };
}

/**
 * Create an error result.
 */
function createErrorResult(error: string): GroundTruthResult {
  return { success: false, metadata: null, expectedEntities: [], error };
}

/**
 * Convert AniList media to ground truth metadata.
 */
function convertToMetadata(media: AniListMedia): GroundTruthMetadata {
  const { author, artist } = extractStaffRoles(media.staff?.edges ?? []);

  return {
    anilistId: media.id,
    titles: {
      romaji: media.title.romaji,
      english: media.title.english,
      native: media.title.native,
    },
    author,
    artist,
    status: normalizeAnilistStatus(media.status),
    volumeCount: media.volumes,
    chapterCount: media.chapters,
    genres: media.genres ?? [],
    summary: cleanDescription(media.description),
    releaseYear: media.startDate?.year ?? null,
    format: media.format,
    coverImage: media.coverImage?.large ?? media.coverImage?.medium ?? null,
  };
}

/**
 * Extract author and artist from staff edges.
 */
function extractStaffRoles(
  edges: AniListStaffEdge[]
): { author: string | null; artist: string | null } {
  let author: string | null = null;
  let artist: string | null = null;

  for (const edge of edges) {
    const role = edge.role.toLowerCase();
    const name = edge.node.name.full;

    if (role.includes('story') || role.includes('original creator') || role === 'author') {
      author = name;
    }
    if (role.includes('art') || role.includes('illustrator')) {
      artist = name;
    }
  }

  return { author, artist };
}

/**
 * Normalize AniList status to standard format.
 */
function normalizeAnilistStatus(status: string | null): string | null {
  if (!status) return null;

  const statusMap: Record<string, string> = {
    releasing: 'ongoing',
    finished: 'completed',
    hiatus: 'hiatus',
    cancelled: 'cancelled',
    not_yet_released: 'upcoming',
  };

  const normalized = status.toLowerCase();
  return statusMap[normalized] ?? normalized;
}

/**
 * Clean HTML from AniList description.
 */
function cleanDescription(description: string | null): string | null {
  if (!description) return null;

  return description
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

// ============================================================================
// Expected Entity Building
// ============================================================================

/**
 * Build expected entities from ground truth metadata.
 * Default series-level entity building.
 */
export function buildExpectedEntities(metadata: GroundTruthMetadata): ExpectedEntity[] {
  const entities: ExpectedEntity[] = [];

  addTitleEntities(entities, metadata);
  addCoreMetadataEntities(entities, metadata);
  addGenreEntities(entities, metadata.genres);
  addOptionalMetadataEntities(entities, metadata);

  return entities;
}

/**
 * Build expected entities based on URL type.
 * Different page types have different semantic expectations:
 * - MANGA_PAGE: Full series-level entities (title, author, status, counts, genres)
 * - VOLUMES: Volume-specific entities (volume count, titles) + PAGE_TYPE
 * - CHAPTERS: Chapter-specific entities (chapter count) + PAGE_TYPE
 * - Other: Minimal entities with PAGE_TYPE
 */
export function buildExpectedEntitiesForUrlType(
  metadata: GroundTruthMetadata,
  urlType: DiscoveredUrlType
): ExpectedEntity[] {
  switch (urlType) {
    case 'MANGA_PAGE':
      return buildSeriesLevelEntities(metadata);
    case 'VOLUMES':
      return buildVolumeLevelEntities(metadata, urlType);
    case 'CHAPTERS':
      return buildChapterLevelEntities(metadata, urlType);
    case 'CHAPTERS_VOLUMES':
      return buildChaptersVolumesEntities(metadata, urlType);
    case 'ARCS':
      return buildArcsEntities(metadata, urlType);
    default:
      return buildMinimalEntities(metadata, urlType);
  }
}

/**
 * Build series-level entities for MANGA_PAGE URLs.
 * These pages should have full metadata.
 */
function buildSeriesLevelEntities(metadata: GroundTruthMetadata): ExpectedEntity[] {
  const entities: ExpectedEntity[] = [];

  // Add PAGE_TYPE for classification
  entities.push(createExpectedEntity('PAGE_TYPE', 'MANGA_PAGE', true));

  // Full series metadata
  addTitleEntities(entities, metadata);
  addCoreMetadataEntities(entities, metadata);
  addGenreEntities(entities, metadata.genres);
  addOptionalMetadataEntities(entities, metadata);

  return entities;
}

/**
 * Build volume-level entities for VOLUMES page URLs.
 * Focus on volume count, volume titles, release dates.
 */
function buildVolumeLevelEntities(
  metadata: GroundTruthMetadata,
  urlType: DiscoveredUrlType
): ExpectedEntity[] {
  const entities: ExpectedEntity[] = [];

  // PAGE_TYPE is required
  entities.push(createExpectedEntity('PAGE_TYPE', urlType, true));

  // Title (to confirm we're on the right manga)
  addTitleEntities(entities, metadata);

  // Volume count is the key metric for volume pages
  if (metadata.volumeCount !== null) {
    entities.push(createExpectedEntity('VOLUME_COUNT', String(metadata.volumeCount), true));
  }

  // Release dates are common on volume pages (not required)
  if (metadata.releaseYear !== null) {
    entities.push(createExpectedEntity('RELEASE_DATE', String(metadata.releaseYear), false));
  }

  return entities;
}

/**
 * Build chapter-level entities for CHAPTERS page URLs.
 * Focus on chapter count, chapter titles.
 */
function buildChapterLevelEntities(
  metadata: GroundTruthMetadata,
  urlType: DiscoveredUrlType
): ExpectedEntity[] {
  const entities: ExpectedEntity[] = [];

  // PAGE_TYPE is required
  entities.push(createExpectedEntity('PAGE_TYPE', urlType, true));

  // Title (to confirm we're on the right manga)
  addTitleEntities(entities, metadata);

  // Chapter count is the key metric for chapter pages
  if (metadata.chapterCount !== null) {
    entities.push(createExpectedEntity('CHAPTER_COUNT', String(metadata.chapterCount), true));
  }

  return entities;
}

/**
 * Build entities for combined CHAPTERS_VOLUMES pages.
 */
function buildChaptersVolumesEntities(
  metadata: GroundTruthMetadata,
  urlType: DiscoveredUrlType
): ExpectedEntity[] {
  const entities: ExpectedEntity[] = [];

  // PAGE_TYPE is required
  entities.push(createExpectedEntity('PAGE_TYPE', urlType, true));

  // Title (to confirm we're on the right manga)
  addTitleEntities(entities, metadata);

  // Both counts are relevant
  if (metadata.volumeCount !== null) {
    entities.push(createExpectedEntity('VOLUME_COUNT', String(metadata.volumeCount), false));
  }
  if (metadata.chapterCount !== null) {
    entities.push(createExpectedEntity('CHAPTER_COUNT', String(metadata.chapterCount), false));
  }

  return entities;
}

/**
 * Build entities for ARCS pages.
 */
function buildArcsEntities(
  metadata: GroundTruthMetadata,
  urlType: DiscoveredUrlType
): ExpectedEntity[] {
  const entities: ExpectedEntity[] = [];

  // PAGE_TYPE is required
  entities.push(createExpectedEntity('PAGE_TYPE', urlType, true));

  // Title (to confirm we're on the right manga)
  addTitleEntities(entities, metadata);

  return entities;
}

/**
 * Build minimal entities for unknown/other page types.
 */
function buildMinimalEntities(
  metadata: GroundTruthMetadata,
  urlType: DiscoveredUrlType
): ExpectedEntity[] {
  const entities: ExpectedEntity[] = [];

  // PAGE_TYPE helps identify what kind of page this is
  entities.push(createExpectedEntity('PAGE_TYPE', urlType, false));

  // Just the title to confirm manga identity
  if (metadata.titles.romaji) {
    entities.push(createExpectedEntity('TITLE', metadata.titles.romaji, false));
  } else if (metadata.titles.english) {
    entities.push(createExpectedEntity('TITLE', metadata.titles.english, false));
  }

  return entities;
}

/**
 * Add title entities to the list.
 * IMPORTANT: Wikis typically have English titles, while AniList provides Japanese romaji.
 * We add BOTH as acceptable TITLE matches to handle cross-language extraction.
 * Order: English first (wikis), then romaji, with native as ALT_TITLE.
 */
function addTitleEntities(entities: ExpectedEntity[], metadata: GroundTruthMetadata): void {
  // Primary TITLE: Prefer English (what wikis typically have)
  if (metadata.titles.english) {
    entities.push(createExpectedEntity('TITLE', metadata.titles.english, true));
  }

  // Also accept romaji as TITLE (for wikis that use Japanese names)
  // This allows matching either English OR romaji title
  if (metadata.titles.romaji) {
    if (metadata.titles.english) {
      // If we already have English as TITLE, add romaji as ALT_TITLE
      entities.push(createExpectedEntity('ALT_TITLE', metadata.titles.romaji, false));
    } else {
      // No English title, use romaji as primary
      entities.push(createExpectedEntity('TITLE', metadata.titles.romaji, true));
    }
  }

  // Native (Japanese characters) as ALT_TITLE
  if (metadata.titles.native) {
    entities.push(createExpectedEntity('ALT_TITLE', metadata.titles.native, false));
  }
}

/**
 * Add core metadata entities (author, status, counts).
 */
function addCoreMetadataEntities(entities: ExpectedEntity[], metadata: GroundTruthMetadata): void {
  if (metadata.author) {
    entities.push(createExpectedEntity('AUTHOR', metadata.author, true));
  }
  if (metadata.artist && metadata.artist !== metadata.author) {
    entities.push(createExpectedEntity('ARTIST', metadata.artist, false));
  }
  if (metadata.status) {
    entities.push(createExpectedEntity('STATUS', metadata.status, true));
  }
  if (metadata.volumeCount !== null) {
    entities.push(createExpectedEntity('VOLUME_COUNT', String(metadata.volumeCount), true));
  }
  if (metadata.chapterCount !== null) {
    entities.push(createExpectedEntity('CHAPTER_COUNT', String(metadata.chapterCount), true));
  }
}

/**
 * Add genre entities.
 */
function addGenreEntities(entities: ExpectedEntity[], genres: string[]): void {
  for (const genre of genres) {
    entities.push(createExpectedEntity('GENRE', genre, false));
  }
}

/**
 * Add optional metadata entities.
 * Note: FORMAT is excluded as wikis rarely have this field consistently.
 * COVER_IMAGE is included - label if an image exists on the page.
 */
function addOptionalMetadataEntities(entities: ExpectedEntity[], metadata: GroundTruthMetadata): void {
  if (metadata.summary) {
    // Use first 100 chars for summary matching (more lenient)
    entities.push(createExpectedEntity('SERIES_SUMMARY', metadata.summary.substring(0, 100), false));
  }
  if (metadata.releaseYear !== null) {
    entities.push(createExpectedEntity('RELEASE_DATE', String(metadata.releaseYear), false));
  }
  // COVER_IMAGE - label if an image exists on the page (wiki URLs differ from AniList)
  if (metadata.coverImage) {
    entities.push(createExpectedEntity('COVER_IMAGE', 'image_present', false));
  }
  // FORMAT excluded - wikis rarely have consistent format metadata
}

/**
 * Create an expected entity with normalization.
 */
function createExpectedEntity(type: EntityType, value: string, required: boolean): ExpectedEntity {
  return { type, value, normalizedValue: normalizeEntityValue(value), required };
}

// ============================================================================
// Comparison Utilities
// ============================================================================

/**
 * Normalize a value for comparison.
 */
export function normalizeForComparison(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s-]/g, '')
    .replace(/\b(the|a|an)\b/g, '')
    .trim();
}

/**
 * Check if two values are similar (fuzzy match).
 */
export function areSimilar(a: string, b: string, threshold: number = 0.8): boolean {
  const normA = normalizeForComparison(a);
  const normB = normalizeForComparison(b);

  if (normA === normB) return true;

  const similarity = calculateSimilarity(normA, normB);
  return similarity >= threshold;
}

/**
 * Calculate Levenshtein distance between two strings.
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= a.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 1; j <= b.length; j++) {
    const firstRow = matrix[0];
    if (firstRow) firstRow[j] = j;
  }

  for (let i = 1; i <= a.length; i++) {
    fillLevenshteinRow(matrix, a, b, i);
  }

  return matrix[a.length]?.[b.length] ?? Math.max(a.length, b.length);
}

/**
 * Fill a single row of the Levenshtein matrix.
 */
function fillLevenshteinRow(matrix: number[][], a: string, b: string, i: number): void {
  const currentRow = matrix[i];
  const prevRow = matrix[i - 1];
  if (!currentRow || !prevRow) return;

  for (let j = 1; j <= b.length; j++) {
    const cost = a[i - 1] === b[j - 1] ? 0 : 1;
    const deletion = (prevRow[j] ?? 0) + 1;
    const insertion = (currentRow[j - 1] ?? 0) + 1;
    const substitution = (prevRow[j - 1] ?? 0) + cost;
    currentRow[j] = Math.min(deletion, insertion, substitution);
  }
}

/**
 * Calculate similarity score between two strings (0-1).
 */
export function calculateSimilarity(a: string, b: string): number {
  const normA = normalizeForComparison(a);
  const normB = normalizeForComparison(b);

  if (normA === normB) return 1.0;
  if (normA.length === 0 || normB.length === 0) return 0.0;

  const distance = levenshteinDistance(normA, normB);
  const maxLen = Math.max(normA.length, normB.length);

  return 1 - distance / maxLen;
}
