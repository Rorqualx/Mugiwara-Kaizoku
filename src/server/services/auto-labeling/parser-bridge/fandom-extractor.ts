/**
 * Fandom Extractor
 *
 * Converts Fandom adaptive parser results to extracted entities.
 * Also handles static analysis to entity conversion.
 *
 * @module auto-labeling/parser-bridge/fandom-extractor
 */

import type { EntityType } from '@/server/ml/features/dom-linearizer';
import type { StaticAnalysisResult } from '@/server/services/fandom/adaptive/static-analyzer';
import type { AdaptiveParseResult, FetchedMetadata } from '@/server/services/fandom/adaptive/types';

import { normalizeEntityValue, normalizeStatusValue } from './utils';

import type { ExtractedEntity } from '../types';


/**
 * Convert adaptive parser result to extracted entities.
 */
export function convertParserResultToEntities(
  result: AdaptiveParseResult,
  minConfidence: number
): ExtractedEntity[] {
  const entities: ExtractedEntity[] = [];
  const data = result.data;

  if (!data) return entities;

  // Extract series title from data.title (prioritize over page title)
  if (data.title) {
    entities.push(createEntity('TITLE', data.title, result.confidence * 0.95, 'parser'));
  }

  // Extract metadata if available
  if (data.metadata) {
    entities.push(...extractMetadataFields(data.metadata, result.confidence));
    entities.push(...extractMetadataCounts(data.metadata, result.confidence));
    entities.push(...extractAlternativeTitles(data.metadata, result.confidence));
  }

  // Extract volume/chapter data
  entities.push(...extractVolumeChapterData(data, result.confidence));

  // Filter by minimum confidence
  return entities.filter(e => e.confidence >= minConfidence);
}

/**
 * Extract core metadata fields (author, artist, publisher, magazine, etc.)
 */
function extractMetadataFields(
  metadata: FetchedMetadata,
  baseConfidence: number
): ExtractedEntity[] {
  const entities: ExtractedEntity[] = [];

  if (metadata.author) {
    entities.push(createEntity('AUTHOR', metadata.author, baseConfidence * 0.95, 'parser'));
  }

  if (metadata.artist) {
    entities.push(createEntity('ARTIST', metadata.artist, baseConfidence * 0.95, 'parser'));
  }

  if (metadata.publisher) {
    entities.push(createEntity('PUBLISHER', metadata.publisher, baseConfidence * 0.9, 'parser'));
  }

  // MAGAZINE - where the manga is serialized
  if (metadata.magazine) {
    entities.push(createEntity('MAGAZINE', metadata.magazine, baseConfidence * 0.9, 'parser'));
  }

  if (metadata.status) {
    entities.push({
      type: 'STATUS' as EntityType,
      value: metadata.status,
      normalizedValue: normalizeStatusValue(metadata.status),
      confidence: baseConfidence * 0.85,
      source: 'parser',
    });
  }

  if (metadata.synopsis) {
    entities.push(createEntity('SERIES_SUMMARY', metadata.synopsis, baseConfidence * 0.85, 'parser'));
  }

  if (metadata.demographic) {
    entities.push(createEntity('DEMOGRAPHIC', metadata.demographic, baseConfidence * 0.9, 'parser'));
  }

  if (metadata.coverImage) {
    // Normalize to 'image_present' for comparison (URLs won't match AniList)
    entities.push({
      type: 'COVER_IMAGE' as EntityType,
      value: metadata.coverImage,
      normalizedValue: 'image_present',
      confidence: baseConfidence * 0.95,
      source: 'parser',
    });
  }

  // RELEASE_DATE from startDate
  if (metadata.startDate) {
    entities.push(createEntity('RELEASE_DATE', metadata.startDate, baseConfidence * 0.85, 'parser'));
  }

  // Genres (sample 5 max)
  if (metadata.genres) {
    const genresToSample = metadata.genres.slice(0, 5);
    for (const genre of genresToSample) {
      entities.push(createEntity('GENRE', genre, baseConfidence * 0.8, 'parser'));
    }
  }

  return entities;
}

/**
 * Extract count fields from metadata.
 */
function extractMetadataCounts(
  metadata: FetchedMetadata,
  baseConfidence: number
): ExtractedEntity[] {
  const entities: ExtractedEntity[] = [];

  if (metadata.volumes !== undefined) {
    entities.push({
      type: 'VOLUME_COUNT' as EntityType,
      value: String(metadata.volumes),
      normalizedValue: String(metadata.volumes),
      confidence: baseConfidence * 0.9,
      source: 'parser',
    });
  }

  if (metadata.chapters !== undefined) {
    entities.push({
      type: 'CHAPTER_COUNT' as EntityType,
      value: String(metadata.chapters),
      normalizedValue: String(metadata.chapters),
      confidence: baseConfidence * 0.9,
      source: 'parser',
    });
  }

  return entities;
}

/**
 * Extract alternative titles from metadata.
 */
function extractAlternativeTitles(
  metadata: FetchedMetadata,
  baseConfidence: number
): ExtractedEntity[] {
  const entities: ExtractedEntity[] = [];

  // Extract alternativeTitles array if available (Japanese, Romaji, etc.)
  if (metadata.alternativeTitles && Array.isArray(metadata.alternativeTitles)) {
    for (const altTitle of metadata.alternativeTitles.slice(0, 5)) {
      if (altTitle && typeof altTitle === 'string' && altTitle.trim()) {
        entities.push(createEntity('ALT_TITLE', altTitle.trim(), baseConfidence * 0.9, 'parser'));
      }
    }
  }

  return entities;
}

/**
 * Extract volume/chapter data from parsed result.
 */
function extractVolumeChapterData(
  data: NonNullable<AdaptiveParseResult['data']>,
  baseConfidence: number
): ExtractedEntity[] {
  const entities: ExtractedEntity[] = [];

  if (data.volumeList && data.volumeList.length > 0) {
    entities.push(...extractFromVolumeList(data.volumeList, baseConfidence));
  }

  if (data.chapterList && data.chapterList.length > 0) {
    entities.push(...extractFromChapterList(data.chapterList, baseConfidence, entities));
  }

  return entities;
}

/**
 * Extract entities from volumeList.
 */
function extractFromVolumeList(
  volumeList: NonNullable<AdaptiveParseResult['data']>['volumeList'],
  baseConfidence: number
): ExtractedEntity[] {
  if (!volumeList) return [];
  const entities: ExtractedEntity[] = [];

  // Volume count
  entities.push({
    type: 'VOLUME_COUNT' as EntityType,
    value: String(volumeList.length),
    normalizedValue: String(volumeList.length),
    confidence: baseConfidence,
    source: 'parser',
  });

  // Sample 2-3 volumes for volume-level entities
  const volumesToSample = volumeList.slice(0, 3);
  for (const volume of volumesToSample) {
    entities.push(...extractVolumeEntities(volume, baseConfidence));
  }

  // Chapter count from all volumes
  const totalChapters = volumeList.reduce((sum, vol) => sum + (vol.chapters?.length ?? 0), 0);
  if (totalChapters > 0) {
    entities.push({
      type: 'CHAPTER_COUNT' as EntityType,
      value: String(totalChapters),
      normalizedValue: String(totalChapters),
      confidence: baseConfidence,
      source: 'parser',
    });
  }

  return entities;
}

/**
 * Extract entities from a single volume.
 */
function extractVolumeEntities(
  volume: { title?: string; coverUrl?: string; coverImage?: string; description?: string; releaseDate?: string; chapters?: unknown[] },
  baseConfidence: number
): ExtractedEntity[] {
  const entities: ExtractedEntity[] = [];

  if (volume.title) {
    entities.push(createEntity('VOLUME_TITLE', volume.title, baseConfidence * 0.9, 'parser'));
  }
  const coverUrl = volume.coverUrl ?? volume.coverImage;
  if (coverUrl) {
    entities.push({ type: 'VOLUME_COVER' as EntityType, value: coverUrl, normalizedValue: 'image_present', confidence: baseConfidence * 0.85, source: 'parser' });
  }
  if (volume.description) {
    entities.push(createEntity('VOLUME_SUMMARY', volume.description, baseConfidence * 0.8, 'parser'));
  }
  if (volume.releaseDate) {
    entities.push(createEntity('VOLUME_RELEASE_DATE', volume.releaseDate, baseConfidence * 0.85, 'parser'));
  }

  return entities;
}

/**
 * Extract entities from chapterList.
 */
function extractFromChapterList(
  chapterList: NonNullable<AdaptiveParseResult['data']>['chapterList'],
  baseConfidence: number,
  existingEntities: ExtractedEntity[]
): ExtractedEntity[] {
  if (!chapterList) return [];
  const entities: ExtractedEntity[] = [];

  // Chapter count if not already present
  const hasChapterCount = existingEntities.some(e => e.type === 'CHAPTER_COUNT');
  if (!hasChapterCount) {
    entities.push({
      type: 'CHAPTER_COUNT' as EntityType,
      value: String(chapterList.length),
      normalizedValue: String(chapterList.length),
      confidence: baseConfidence,
      source: 'parser',
    });
  }

  // Sample 2-3 chapters for chapter-level entities
  const chaptersToSample = chapterList.slice(0, 3);
  for (const chapter of chaptersToSample) {
    entities.push(...extractChapterEntities(chapter, baseConfidence));
  }

  return entities;
}

/**
 * Extract entities from a single chapter.
 */
function extractChapterEntities(
  chapter: { title?: string; coverUrl?: string; coverImage?: string; summary?: string; releaseDate?: string },
  baseConfidence: number
): ExtractedEntity[] {
  const entities: ExtractedEntity[] = [];

  if (chapter.title) {
    entities.push(createEntity('CHAPTER_TITLE', chapter.title, baseConfidence * 0.9, 'parser'));
  }
  const coverUrl = chapter.coverUrl ?? chapter.coverImage;
  if (coverUrl) {
    entities.push({ type: 'CHAPTER_COVER' as EntityType, value: coverUrl, normalizedValue: 'image_present', confidence: baseConfidence * 0.85, source: 'parser' });
  }
  if (chapter.summary) {
    entities.push(createEntity('CHAPTER_SUMMARY', chapter.summary, baseConfidence * 0.8, 'parser'));
  }
  if (chapter.releaseDate) {
    entities.push(createEntity('CHAPTER_RELEASE_DATE', chapter.releaseDate, baseConfidence * 0.85, 'parser'));
  }

  return entities;
}

/**
 * Create an entity with standard normalization.
 */
function createEntity(
  type: EntityType,
  value: string,
  confidence: number,
  source: ExtractedEntity['source']
): ExtractedEntity {
  return {
    type,
    value,
    normalizedValue: normalizeEntityValue(value),
    confidence,
    source,
  };
}

// ============================================================================
// Static Analysis
// ============================================================================

/**
 * Convert static analysis results to label suggestions.
 */
export function staticAnalysisToLabels(
  analysis: StaticAnalysisResult
): ExtractedEntity[] {
  const entities: ExtractedEntity[] = [];

  // Extract from table analysis
  entities.push(...extractFromTableAnalysis(analysis.tables));

  // Extract from header analysis
  entities.push(...extractFromHeaderAnalysis(analysis.headers));

  // Extract from content analysis
  entities.push(...extractFromContentAnalysis(analysis.content));

  return entities;
}

/**
 * Extract entities from table analysis.
 */
function extractFromTableAnalysis(
  tables: StaticAnalysisResult['tables']
): ExtractedEntity[] {
  const entities: ExtractedEntity[] = [];

  // Detect volume/chapter tables
  if (tables.tablesWithVolumeData > 0) {
    entities.push({
      type: 'VOLUME_TABLE' as EntityType,
      value: 'detected',
      normalizedValue: 'volume_table_detected',
      confidence: 0.8,
      source: 'static_analysis',
    });
  }

  if (tables.tablesWithChapterLinks > 0) {
    entities.push({
      type: 'CHAPTER_TABLE' as EntityType,
      value: 'detected',
      normalizedValue: 'chapter_table_detected',
      confidence: 0.8,
      source: 'static_analysis',
    });
  }

  return entities;
}

/**
 * Extract entities from header analysis.
 */
function extractFromHeaderAnalysis(
  headers: StaticAnalysisResult['headers']
): ExtractedEntity[] {
  const entities: ExtractedEntity[] = [];

  // Note: volumeHeaders is a count, not an array
  if (headers.volumeHeaders > 0) {
    entities.push({
      type: 'VOLUME_TITLE' as EntityType,
      value: `${headers.volumeHeaders} volume headers detected`,
      normalizedValue: 'volume_headers_detected',
      confidence: 0.6,
      source: 'static_analysis',
    });
  }

  return entities;
}

/**
 * Extract entities from content analysis.
 */
function extractFromContentAnalysis(
  content: StaticAnalysisResult['content']
): ExtractedEntity[] {
  const entities: ExtractedEntity[] = [];

  // Extract ISBN if found
  if (content.hasIsbn) {
    entities.push({
      type: 'FORMAT' as EntityType,
      value: 'ISBN detected',
      normalizedValue: 'isbn',
      confidence: 0.9,
      source: 'static_analysis',
    });
  }

  // Extract date formats
  for (const dateFormat of content.dateFormats) {
    entities.push({
      type: 'RELEASE_DATE' as EntityType,
      value: dateFormat,
      normalizedValue: normalizeEntityValue(dateFormat),
      confidence: 0.6,
      source: 'static_analysis',
    });
  }

  return entities;
}

/**
 * Enhance entities with static analysis findings.
 */
export function enhanceWithStaticAnalysis(
  entities: ExtractedEntity[],
  analysis: StaticAnalysisResult
): ExtractedEntity[] {
  const enhanced = [...entities];

  // Boost confidence for entities that match static analysis
  for (const entity of enhanced) {
    const boost = getConfidenceBoost(entity, analysis);
    entity.confidence = Math.min(1.0, entity.confidence + boost);
  }

  // Add static analysis entities that aren't duplicates
  const staticEntities = staticAnalysisToLabels(analysis);
  for (const staticEntity of staticEntities) {
    const isDuplicate = entities.some(
      e => e.type === staticEntity.type && e.normalizedValue === staticEntity.normalizedValue
    );
    if (!isDuplicate) {
      enhanced.push(staticEntity);
    }
  }

  return enhanced;
}

/**
 * Get confidence boost based on static analysis.
 */
function getConfidenceBoost(
  entity: ExtractedEntity,
  analysis: StaticAnalysisResult
): number {
  let boost = 0;

  // Boost volume/chapter counts if tables detected
  if (entity.type === 'VOLUME_COUNT' || entity.type === 'CHAPTER_COUNT') {
    const hasRelevantTables =
      analysis.tables.tablesWithVolumeData > 0 ||
      analysis.tables.tablesWithChapterLinks > 0;
    if (hasRelevantTables) {
      boost += 0.1;
    }
  }

  // Boost volume titles if volume headers detected
  if (entity.type === 'VOLUME_TITLE' && analysis.headers.volumeHeaders > 0) {
    boost += 0.1;
  }

  return boost;
}
