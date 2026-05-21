/**
 * Bootstrap Labeler Bridge
 *
 * Bridges the bootstrap labeler to the auto-labeling system.
 * Converts bootstrap labeler output to extracted entities.
 *
 * @module auto-labeling/bootstrap-bridge
 */

import type { EntityType, BIOTag } from '@/server/ml/features/dom-linearizer';
import { bootstrapLabels } from '@/server/ml/training/bootstrap-labeler';
import type { BootstrapResult, TokenSpan } from '@/server/ml/training/bootstrap-labeler/types';
import type { StaticAnalysisResult } from '@/server/services/fandom/adaptive/static-analyzer';
import { createLogger } from '@/utils/logger';

import { normalizeEntityValue } from './parser-bridge';

import type { ExtractedEntity } from './types';


const logger = createLogger('auto-labeling:bootstrap-bridge');

// ============================================================================
// Types
// ============================================================================

/**
 * Result of bootstrap labeling.
 */
export interface BootstrapExtractionResult {
  success: boolean;
  entities: ExtractedEntity[];
  bootstrapResult: BootstrapResult | null;
  error?: string;
  durationMs: number;
}

/**
 * Options for bootstrap extraction.
 */
export interface BootstrapExtractionOptions {
  /** Minimum confidence for entity extraction */
  minConfidence?: number;
  /** Entity types to focus on */
  focusEntities?: EntityType[];
}

const DEFAULT_OPTIONS: Required<BootstrapExtractionOptions> = {
  minConfidence: 0.5,
  focusEntities: [],
};

// ============================================================================
// Main Extraction
// ============================================================================

/**
 * Run bootstrap labeling on a page and extract entities.
 */
export function runBootstrapLabeling(
  html: string,
  url: string,
  options?: BootstrapExtractionOptions
): BootstrapExtractionResult {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const startTime = Date.now();

  try {
    // Run bootstrap labeler
    const result = bootstrapLabels(html, url, {
      minConfidence: opts.minConfidence,
      focusEntities: opts.focusEntities,
    });

    // Extract entities from spans
    const entities = extractEntitiesFromSpans(result, opts.minConfidence);

    return {
      success: true,
      entities,
      bootstrapResult: result,
      durationMs: Date.now() - startTime,
    };
  } catch (error) {
    logger.error('Bootstrap labeling error', error as Error);
    return {
      success: false,
      entities: [],
      bootstrapResult: null,
      error: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - startTime,
    };
  }
}

// ============================================================================
// Entity Extraction
// ============================================================================

/**
 * Extract entities from bootstrap labeler spans.
 */
export function extractEntitiesFromSpans(
  result: BootstrapResult,
  minConfidence: number
): ExtractedEntity[] {
  const entities: ExtractedEntity[] = [];
  const { tokens, spans } = result;

  for (const span of spans) {
    // Skip low confidence spans
    if (span.confidence < minConfidence) continue;

    // Extract text for this span
    const text = extractSpanText(tokens, span);
    if (!text) continue;

    entities.push({
      type: span.entityType,
      value: text,
      normalizedValue: normalizeEntityValue(text),
      confidence: span.confidence,
      source: 'bootstrap',
      tokenIndices: getSpanIndices(span),
    });
  }

  // Also extract from extracted values if available
  const extractedValueEntities = extractFromExtractedValues(result);
  entities.push(...extractedValueEntities);

  // Deduplicate and keep highest confidence
  return deduplicateEntities(entities);
}

/**
 * Get token indices for a span.
 */
function getSpanIndices(span: TokenSpan): number[] {
  const indices: number[] = [];
  for (let i = span.start; i <= span.end; i++) {
    indices.push(i);
  }
  return indices;
}

/**
 * Extract text from a token span.
 */
function extractSpanText(
  tokens: BootstrapResult['tokens'],
  span: TokenSpan
): string {
  const spanTokens = tokens.slice(span.start, span.end + 1);
  const texts = spanTokens.map(t => t.text).filter(Boolean);
  return texts.join(' ').trim();
}

/**
 * Extract entities from the extracted values object.
 */
function extractFromExtractedValues(result: BootstrapResult): ExtractedEntity[] {
  const entities: ExtractedEntity[] = [];
  const { extractedValues, confidence } = result;

  // Title
  if (extractedValues.title) {
    entities.push(createBootstrapEntity('TITLE', extractedValues.title, confidence));
  }

  // Alt titles
  if (extractedValues.altTitles) {
    for (const title of extractedValues.altTitles) {
      entities.push(createBootstrapEntity('ALT_TITLE', title, confidence * 0.9));
    }
  }

  // Author
  if (extractedValues.author) {
    entities.push(createBootstrapEntity('AUTHOR', extractedValues.author, confidence));
  }

  // Artist
  if (extractedValues.artist) {
    entities.push(createBootstrapEntity('ARTIST', extractedValues.artist, confidence));
  }

  // Status
  if (extractedValues.status) {
    entities.push(createBootstrapEntity('STATUS', extractedValues.status, confidence));
  }

  // Genres
  if (extractedValues.genres) {
    for (const genre of extractedValues.genres) {
      entities.push(createBootstrapEntity('GENRE', genre, confidence * 0.8));
    }
  }

  // Summary
  if (extractedValues.summary) {
    entities.push(createBootstrapEntity('SERIES_SUMMARY', extractedValues.summary, confidence));
  }

  // Volume count
  if (extractedValues.volumeCount !== undefined) {
    entities.push(
      createBootstrapEntity('VOLUME_COUNT', String(extractedValues.volumeCount), confidence)
    );
  }

  // Chapter count
  if (extractedValues.chapterCount !== undefined) {
    entities.push(
      createBootstrapEntity('CHAPTER_COUNT', String(extractedValues.chapterCount), confidence)
    );
  }

  // Publisher
  if (extractedValues.publisher) {
    entities.push(createBootstrapEntity('PUBLISHER', extractedValues.publisher, confidence));
  }

  // Magazine
  if (extractedValues.magazine) {
    entities.push(createBootstrapEntity('MAGAZINE', extractedValues.magazine, confidence));
  }

  // Demographic
  if (extractedValues.demographic) {
    entities.push(createBootstrapEntity('DEMOGRAPHIC', extractedValues.demographic, confidence));
  }

  // Release date
  if (extractedValues.releaseDate) {
    entities.push(createBootstrapEntity('RELEASE_DATE', extractedValues.releaseDate, confidence));
  }

  // Cover image - normalize to 'image_present' for matching (URLs differ across sources)
  if (extractedValues.coverImage) {
    entities.push({
      type: 'COVER_IMAGE' as EntityType,
      value: extractedValues.coverImage,
      normalizedValue: 'image_present',
      confidence,
      source: 'bootstrap',
    });
  }

  return entities;
}

/**
 * Create a bootstrap entity with standard normalization.
 */
function createBootstrapEntity(
  type: EntityType,
  value: string,
  confidence: number
): ExtractedEntity {
  return {
    type,
    value,
    normalizedValue: normalizeEntityValue(value),
    confidence,
    source: 'bootstrap',
  };
}

/**
 * Deduplicate entities, keeping highest confidence for each type+value.
 */
function deduplicateEntities(entities: ExtractedEntity[]): ExtractedEntity[] {
  const seen = new Map<string, ExtractedEntity>();

  for (const entity of entities) {
    const key = `${entity.type}:${entity.normalizedValue}`;
    const existing = seen.get(key);

    if (!existing || entity.confidence > existing.confidence) {
      seen.set(key, entity);
    }
  }

  return [...seen.values()];
}

// ============================================================================
// Enhancement with Static Analysis
// ============================================================================

/**
 * Enhance bootstrap entities with static analysis findings.
 */
export function enhanceWithStaticAnalysis(
  entities: ExtractedEntity[],
  analysis: StaticAnalysisResult
): ExtractedEntity[] {
  const enhanced = [...entities];

  for (const entity of enhanced) {
    const boost = getStaticAnalysisBoost(entity, analysis);
    entity.confidence = Math.min(1.0, entity.confidence + boost);
  }

  return enhanced;
}

/**
 * Get confidence boost based on static analysis.
 */
function getStaticAnalysisBoost(
  entity: ExtractedEntity,
  analysis: StaticAnalysisResult
): number {
  let boost = 0;

  // Boost counts if relevant tables detected
  if (entity.type === 'VOLUME_COUNT' || entity.type === 'CHAPTER_COUNT') {
    if (analysis.tables.tablesWithVolumeData > 0) {
      boost += 0.1;
    }
    if (analysis.tables.tablesWithChapterLinks > 0) {
      boost += 0.05;
    }
  }

  // Boost volume titles if volume headers detected
  if (entity.type === 'VOLUME_TITLE' && analysis.headers.volumeHeaders > 0) {
    boost += 0.1;
  }

  // Boost author/artist if infobox detected
  if (entity.type === 'AUTHOR' || entity.type === 'ARTIST') {
    // Check if content has structured data
    if (analysis.content.hasIsbn) {
      boost += 0.05;
    }
  }

  return boost;
}

// ============================================================================
// BIO Tag Utilities
// ============================================================================

/**
 * Count entities by type from BIO labels.
 */
export function countEntitiesFromLabels(labels: BIOTag[]): Record<string, number> {
  const counts: Record<string, number> = {};

  for (const label of labels) {
    if (label.startsWith('B-')) {
      const entityType = label.substring(2);
      counts[entityType] = (counts[entityType] ?? 0) + 1;
    }
  }

  return counts;
}

/**
 * Extract entity spans from BIO labels.
 */
export function extractSpansFromLabels(labels: BIOTag[]): Array<{
  start: number;
  end: number;
  entityType: string;
}> {
  const spans: Array<{ start: number; end: number; entityType: string }> = [];
  let currentSpan: { start: number; end: number; entityType: string } | null = null;

  for (let i = 0; i < labels.length; i++) {
    const label = labels[i];
    if (!label) continue;

    if (label.startsWith('B-')) {
      // Start new span (close previous if exists)
      if (currentSpan) {
        spans.push(currentSpan);
      }
      currentSpan = {
        start: i,
        end: i,
        entityType: label.substring(2),
      };
    } else if (label.startsWith('I-') && currentSpan) {
      // Continue current span
      const entityType = label.substring(2);
      if (entityType === currentSpan.entityType) {
        currentSpan.end = i;
      } else {
        // Type mismatch - close current and start new
        spans.push(currentSpan);
        currentSpan = null;
      }
    } else {
      // O tag - close current span
      if (currentSpan) {
        spans.push(currentSpan);
        currentSpan = null;
      }
    }
  }

  // Close final span
  if (currentSpan) {
    spans.push(currentSpan);
  }

  return spans;
}
