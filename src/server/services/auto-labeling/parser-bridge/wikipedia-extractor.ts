/**
 * Wikipedia Extractor
 *
 * Extracts entities from Wikipedia pages using the adaptive extractor.
 *
 * @module auto-labeling/parser-bridge/wikipedia-extractor
 */

import type { EntityType } from '@/server/ml/features/dom-linearizer';
import { adaptiveExtract } from '@/server/services/wikipedia/wikipedia/manga-extractor';
import type { WikipediaMangaData } from '@/server/services/wikipedia/wikipedia/types';
import { isWikipediaUrl as isWikipediaUrlShared } from '@/server/shared/source-knowledge/source-detection';
import { createLogger } from '@/utils/logger';

import { normalizeEntityValue, normalizeStatusValue } from './utils';

import type { ExtractedEntity } from '../types';


const logger = createLogger('auto-labeling:wikipedia-extractor');

/**
 * Check if a URL is from Wikipedia.
 * Delegates to shared source detection.
 */
export function isWikipediaUrl(url: string): boolean {
  return isWikipediaUrlShared(url);
}

/**
 * Extract entities from Wikipedia using the adaptive extractor.
 */
export async function extractFromWikipedia(url: string): Promise<ExtractedEntity[]> {
  const entities: ExtractedEntity[] = [];

  try {
    const result = await adaptiveExtract(url, {
      useCache: true,
      preferListPage: true,
    });

    if (!result.success || !result.data) {
      logger.warn('Wikipedia extraction failed', { url, error: result.error });
      return entities;
    }

    const data = result.data;
    const confidence = result.confidence;

    // Extract core metadata
    extractCoreMetadata(entities, data, confidence);

    // Extract publication metadata
    extractPublicationMetadata(entities, data, confidence);

    // Extract counts and content
    extractCountsAndContent(entities, data, confidence);

    logger.info('Wikipedia extraction successful', {
      url,
      entityCount: entities.length,
      confidence,
    });

  } catch (error) {
    logger.error('Wikipedia extraction error', {
      url,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return entities;
}

/**
 * Extract core metadata (title, author, artist).
 */
function extractCoreMetadata(
  entities: ExtractedEntity[],
  data: WikipediaMangaData,
  confidence: number
): void {
  if (data.title) {
    entities.push({
      type: 'TITLE' as EntityType,
      value: data.title,
      normalizedValue: normalizeEntityValue(data.title),
      confidence: confidence * 0.95,
      source: 'parser',
    });
  }

  if (data.alternativeTitles) {
    // Sample 5 max - enough to detect patterns
    const altTitlesToSample = data.alternativeTitles.slice(0, 5);
    for (const altTitle of altTitlesToSample) {
      entities.push({
        type: 'ALT_TITLE' as EntityType,
        value: altTitle,
        normalizedValue: normalizeEntityValue(altTitle),
        confidence: confidence * 0.85,
        source: 'parser',
      });
    }
  }

  // author is string[] in WikipediaMangaData
  if (data.author && data.author.length > 0) {
    const authorValue = data.author.join(', ');
    entities.push({
      type: 'AUTHOR' as EntityType,
      value: authorValue,
      normalizedValue: normalizeEntityValue(authorValue),
      confidence: confidence * 0.9,
      source: 'parser',
    });
  }

  // artist is string[] in WikipediaMangaData
  if (data.artist && data.artist.length > 0) {
    const artistValue = data.artist.join(', ');
    entities.push({
      type: 'ARTIST' as EntityType,
      value: artistValue,
      normalizedValue: normalizeEntityValue(artistValue),
      confidence: confidence * 0.9,
      source: 'parser',
    });
  }
}

/**
 * Extract publication metadata (publisher, status, genres).
 */
function extractPublicationMetadata(
  entities: ExtractedEntity[],
  data: WikipediaMangaData,
  confidence: number
): void {
  if (data.publisher) {
    entities.push({
      type: 'PUBLISHER' as EntityType,
      value: data.publisher,
      normalizedValue: normalizeEntityValue(data.publisher),
      confidence: confidence * 0.85,
      source: 'parser',
    });
  }

  if (data.englishPublisher) {
    entities.push({
      type: 'PUBLISHER' as EntityType,
      value: `${data.englishPublisher} (English)`,
      normalizedValue: normalizeEntityValue(data.englishPublisher),
      confidence: confidence * 0.8,
      source: 'parser',
    });
  }

  if (data.status) {
    entities.push({
      type: 'STATUS' as EntityType,
      value: data.status,
      normalizedValue: normalizeStatusValue(data.status),
      confidence: confidence * 0.85,
      source: 'parser',
    });
  }

  if (data.genres) {
    // Sample 5 max - enough to detect patterns
    const genresToSample = data.genres.slice(0, 5);
    for (const genre of genresToSample) {
      entities.push({
        type: 'GENRE' as EntityType,
        value: genre,
        normalizedValue: normalizeEntityValue(genre),
        confidence: confidence * 0.8,
        source: 'parser',
      });
    }
  }

  if (data.demographic) {
    entities.push({
      type: 'DEMOGRAPHIC' as EntityType,
      value: data.demographic,
      normalizedValue: normalizeEntityValue(data.demographic),
      confidence: confidence * 0.85,
      source: 'parser',
    });
  }

  if (data.originalRun) {
    entities.push({
      type: 'RELEASE_DATE' as EntityType,
      value: data.originalRun,
      normalizedValue: normalizeEntityValue(data.originalRun),
      confidence: confidence * 0.8,
      source: 'parser',
    });
  }

  if (data.magazine) {
    entities.push({
      type: 'FORMAT' as EntityType,
      value: `Magazine: ${data.magazine}`,
      normalizedValue: normalizeEntityValue(data.magazine),
      confidence: confidence * 0.8,
      source: 'parser',
    });
  }
}

/**
 * Extract counts and content (volumes, chapters, synopsis).
 */
function extractCountsAndContent(
  entities: ExtractedEntity[],
  data: WikipediaMangaData,
  confidence: number
): void {
  if (data.volumes !== undefined && data.volumes > 0) {
    entities.push({
      type: 'VOLUME_COUNT' as EntityType,
      value: String(data.volumes),
      normalizedValue: String(data.volumes),
      confidence: confidence * 0.9,
      source: 'parser',
    });
  }

  if (data.chapters !== undefined && data.chapters > 0) {
    entities.push({
      type: 'CHAPTER_COUNT' as EntityType,
      value: String(data.chapters),
      normalizedValue: String(data.chapters),
      confidence: confidence * 0.9,
      source: 'parser',
    });
  }

  if (data.coverImage) {
    entities.push({
      type: 'COVER_IMAGE' as EntityType,
      value: data.coverImage,
      normalizedValue: 'image_present',
      confidence: confidence * 0.9,
      source: 'parser',
    });
  }

  const synopsis = data.synopsis ?? data.description;
  if (synopsis) {
    entities.push({
      type: 'SERIES_SUMMARY' as EntityType,
      value: synopsis,
      normalizedValue: normalizeEntityValue(synopsis.substring(0, 100)),
      confidence: confidence * (data.synopsis ? 0.8 : 0.75),
      source: 'parser',
    });
  }
}
