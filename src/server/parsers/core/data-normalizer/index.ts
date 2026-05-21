/**
 * Data Normalizer - Main Module
 *
 * The DataNormalizer engine normalizes extracted content into consistent
 * domain models. This module composes all specialized normalization modules.
 *
 * Architecture:
 * - types.ts        - Type definitions (~220 lines)
 * - utils.ts        - Helper utilities (~150 lines)
 * - metadata.ts     - Metadata normalization (~120 lines)
 * - volumes.ts      - Volume processing (~100 lines)
 * - chapters.ts     - Chapter processing (~100 lines)
 * - images-links.ts - Image/link processing (~80 lines)
 * - post-process.ts - Post-processing & validation (~150 lines)
 *
 * Original: 865 lines -> Refactored: ~100 lines (88% reduction in main file)
 */

// Re-export all types for backward compatibility
export * from './types';

// Import types

// Import normalization functions
import { normalizeChapters } from './chapters';
import { normalizeImages, normalizeLinks } from './images-links';
import { normalizeMetadata } from './metadata';
import { postProcess, validate } from './post-process';
import { detectSourceType } from './utils';
import { normalizeVolumes } from './volumes';

import type {
  NormalizedMangaData,
  NormalizationOptions,
  ExtractedContent,
} from './types';

// ============================================================================
// Circular Reference Detection and Removal
// ============================================================================

/**
 * Remove circular references from an object by creating a clean copy
 * Uses a WeakMap to track visited objects and skip circular references
 */
function removeCircularReferences<T>(obj: T, seen = new WeakMap<object, unknown>()): T {
  // Handle primitives and null
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  // Check if we've already seen this object
  const existing = seen.get(obj as object);
  if (existing !== undefined) {
    // Skip this property - it's a circular reference
    return undefined as T;
  }

  // Handle arrays
  if (Array.isArray(obj)) {
    const result: unknown[] = [];
    seen.set(obj as object, result);
    for (const item of obj) {
      const cleaned: unknown = removeCircularReferences(item, seen);
      if (cleaned !== undefined) {
        result.push(cleaned);
      }
    }
    return result as T;
  }

  // Handle objects
  const result: Record<string, unknown> = {};
  seen.set(obj as object, result);

  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const value = (obj as Record<string, unknown>)[key];
      const cleaned = removeCircularReferences(value, seen);
      // Only skip the property if it's undefined AND it's a circular reference
      // (not if the original value was undefined)
      if (cleaned !== undefined || value === undefined) {
        result[key] = cleaned;
      }
    }
  }

  return result as T;
}

// ============================================================================
// Main DataNormalizer Class
// ============================================================================

/**
 * Data Normalization Engine
 * Normalizes extracted data into consistent domain models
 */
export class DataNormalizer {
  /**
   * Normalize extracted content into domain model
   */
  normalize(content: ExtractedContent, options: NormalizationOptions = {}): NormalizedMangaData {
    // Remove any circular references before processing
    const cleanContent = removeCircularReferences(content);
    return this.normalizeContent(cleanContent, options);
  }

  /**
   * Internal method to normalize content
   */
  private normalizeContent(content: ExtractedContent, options: NormalizationOptions): NormalizedMangaData {
    // Start with metadata
    const normalized: NormalizedMangaData = normalizeMetadata(content.metadata, options);

    // Add volumes and chapters
    normalized.volumes = normalizeVolumes(content.volumes, options);
    normalized.chapters = normalizeChapters(content.chapters, options);

    // Add images
    normalized.images = normalizeImages(content.images);

    // Add external links
    if (Array.isArray(content.links)) {
      normalized.externalLinks = normalizeLinks(content.links);
    } else if (typeof content.links === 'object') {
      // Handle ExtractedLinks object format
      const allLinks = [
        ...(content.links.internal ?? []),
        ...(content.links.external ?? []),
        ...(content.links.chapters ?? []),
        ...(content.links.volumes ?? [])
      ];
      normalized.externalLinks = normalizeLinks(allLinks);
    }

    // Add source info
    /* eslint-disable @typescript-eslint/no-unnecessary-condition -- Runtime safety for malformed input */
    normalized.source = {
      type: content.format?.primary?.name ? detectSourceType(content.format.primary.name) : 'other',
      extractedAt: new Date(),
      confidence: content.format?.confidence ?? 0
    };
    /* eslint-enable @typescript-eslint/no-unnecessary-condition */

    // Post-process
    postProcess(normalized, options);

    // Validate
    if (options.validateDates ?? options.validateNumbers ?? options.validate ?? options.validateUrls) {
      validate(normalized, options);
    }

    return normalized;
  }
}
