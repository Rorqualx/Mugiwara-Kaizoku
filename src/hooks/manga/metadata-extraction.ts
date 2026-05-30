/**
 * Metadata Extraction Helpers
 *
 * Pure functions for extracting and merging metadata from providerMetadata JSON
 * and the Prisma Metadata relation. Used by useMangaMetadataExtraction hook.
 *
 * @module hooks/manga/metadata-extraction
 */

import type { MangaWithRelations } from '@/types/search-types/core-search.types';

type MetadataRelation = NonNullable<MangaWithRelations['Metadata']>;

// Fields to extract from provider metadata (using correct plural names for arrays)
const METADATA_FIELDS = [
  'title', 'description', 'coverImage', 'summary',
  'authors', 'artists', 'publisher',
  'status', 'format', 'countryOfOrigin', 'language',
  'genres', 'tags', 'themes', 'characters',
  'startDate', 'endDate',
  'volumes', 'chapters',
  'averageScore', 'popularity', 'rating'
] as const;

/** Type guard for plain objects */
function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Extract enrichedFields from providerMetadata, returning only those that fill empty gaps */
function getEnrichedFields(
  existing: Record<string, unknown>,
  providerMetadata: Record<string, unknown>
): Record<string, unknown> {
  const enrichedFields = providerMetadata['enrichedFields'];
  if (!isPlainObject(enrichedFields)) return {};

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(enrichedFields)) {
    if (isMetadataEmpty(existing[key])) {
      result[key] = value;
    }
  }
  return result;
}

/** Check if a metadata field is empty (undefined, null, or empty array) */
export function isMetadataEmpty(val: unknown): boolean {
  if (val === undefined || val === null) return true;
  if (Array.isArray(val) && val.length === 0) return true;
  return false;
}

/** Extract fields from provider metadata */
export function extractProviderFields(providerData: Record<string, unknown>): Record<string, unknown> {
  const metadata: Record<string, unknown> = {};

  for (const field of METADATA_FIELDS) {
    if (field in providerData && providerData[field] !== null && providerData[field] !== undefined) {
      metadata[field] = providerData[field];
    }
  }

  // Handle legacy singular field names (author -> authors, artist -> artists)
  if (!metadata['authors'] && 'author' in providerData) {
    const author = providerData['author'];
    metadata['authors'] = Array.isArray(author) ? author : (author ? [author] : []);
  }
  if (!metadata['artists'] && 'artist' in providerData) {
    const artist = providerData['artist'];
    metadata['artists'] = Array.isArray(artist) ? artist : (artist ? [artist] : []);
  }

  return metadata;
}

/** Get array fields from Metadata relation for empty fields in current metadata */
export function getArrayFieldsFromMetadata(
  metadata: Record<string, unknown>,
  m: MetadataRelation
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  // Phase 1: Metadata.characters dropped (out of app scope).
  // Phase 1: publishers[] (array) now lives alongside genres/tags etc.
  const arrayMappings: Array<{ key: string; source: string[] }> = [
    { key: 'authors', source: m.authors },
    { key: 'artists', source: m.artists },
    { key: 'genres', source: m.genres },
    { key: 'tags', source: m.tags },
    { key: 'themes', source: m.themes },
    { key: 'publishers', source: m.publishers },
  ];

  for (const { key, source } of arrayMappings) {
    if (isMetadataEmpty(metadata[key]) && source.length > 0) {
      result[key] = source;
    }
  }
  return result;
}

/** Get string fields from Metadata relation for empty fields in current metadata */
export function getStringFieldsFromMetadata(
  metadata: Record<string, unknown>,
  m: MetadataRelation
): Record<string, unknown> {
  // Phase 1: language dropped (column removed). publisher → publishers (array).
  const result: Record<string, unknown> = {};
  if (!metadata['description'] && m.summary) result['description'] = m.summary;
  // Status defaults to UNKNOWN in Prisma, only use if it's a meaningful value
  if (!metadata['status'] && m.status !== 'UNKNOWN') result['status'] = m.status;
  if (!metadata['format'] && m.format) result['format'] = m.format;
  if (!metadata['countryOfOrigin'] && m.countryOfOrigin) result['countryOfOrigin'] = m.countryOfOrigin;
  if (!metadata['startDate'] && m.startDate) result['startDate'] = m.startDate;
  if (!metadata['endDate'] && m.endDate) result['endDate'] = m.endDate;
  return result;
}

/** Get numeric fields from Metadata relation for undefined fields in current metadata */
export function getNumericFieldsFromMetadata(
  metadata: Record<string, unknown>,
  m: MetadataRelation
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  if (metadata['volumes'] === undefined && m.volumes !== null) result['volumes'] = m.volumes;
  if (metadata['chapters'] === undefined && m.chapters !== null) result['chapters'] = m.chapters;
  if (metadata['averageScore'] === undefined && m.averageScore !== null) result['averageScore'] = m.averageScore;
  if (metadata['popularity'] === undefined && m.popularity !== null) result['popularity'] = m.popularity;
  return result;
}

/** Build metadata from the Metadata model when source is 'merged' (primary source of truth) */
export function buildFromMergedMetadata(m: MetadataRelation): Record<string, unknown> {
  const metadata: Record<string, unknown> = {};
  if (m.authors.length > 0) metadata['authors'] = m.authors;
  if (m.artists.length > 0) metadata['artists'] = m.artists;
  if (m.genres.length > 0) metadata['genres'] = m.genres;
  if (m.tags.length > 0) metadata['tags'] = m.tags;
  if (m.themes.length > 0) metadata['themes'] = m.themes;
  // Phase 1: characters dropped (out of scope). publishers[] replaces publisher.
  if (m.publishers.length > 0) metadata['publishers'] = m.publishers;
  if (m.summary) metadata['description'] = m.summary;
  if (m.status !== 'UNKNOWN') metadata['status'] = m.status;
  if (m.format) metadata['format'] = m.format;
  // Phase 1: language dropped.
  if (m.countryOfOrigin) metadata['countryOfOrigin'] = m.countryOfOrigin;
  if (m.startDate) metadata['startDate'] = m.startDate;
  if (m.endDate) metadata['endDate'] = m.endDate;
  if (m.volumes !== null) metadata['volumes'] = m.volumes;
  if (m.chapters !== null) metadata['chapters'] = m.chapters;
  if (m.averageScore !== null) metadata['averageScore'] = m.averageScore;
  if (m.popularity !== null) metadata['popularity'] = m.popularity;
  return metadata;
}

/**
 * Extract and merge metadata from a manga entity.
 *
 * When Metadata.source === 'merged', Metadata model is the primary source of truth.
 * Otherwise, providerMetadata JSON takes priority and Metadata fills gaps.
 */
export function extractMergedMetadata(manga: MangaWithRelations): Record<string, unknown> | null {
  // Merged: Metadata model is source of truth
  if (manga.Metadata?.source === 'merged') {
    const metadata = buildFromMergedMetadata(manga.Metadata);
    if (manga.providerMetadata && isPlainObject(manga.providerMetadata)) {
      const providerFields = extractProviderFields(manga.providerMetadata);
      for (const [key, value] of Object.entries(providerFields)) {
        if (isMetadataEmpty(metadata[key])) metadata[key] = value;
      }
      Object.assign(metadata, getEnrichedFields(metadata, manga.providerMetadata));
    }
    return Object.keys(metadata).length > 0 ? metadata : null;
  }

  // Non-merged: providerMetadata first, then Metadata fills gaps
  let metadata: Record<string, unknown> = {};
  if (manga.providerMetadata && isPlainObject(manga.providerMetadata)) {
    metadata = extractProviderFields(manga.providerMetadata);
    metadata = { ...metadata, ...getEnrichedFields(metadata, manga.providerMetadata) };
  }
  if (manga.Metadata) {
    const arrayFields = getArrayFieldsFromMetadata(metadata, manga.Metadata);
    const stringFields = getStringFieldsFromMetadata(metadata, manga.Metadata);
    const numericFields = getNumericFieldsFromMetadata(metadata, manga.Metadata);
    metadata = { ...metadata, ...arrayFields, ...stringFields, ...numericFields };
  }
  return Object.keys(metadata).length > 0 ? metadata : null;
}
