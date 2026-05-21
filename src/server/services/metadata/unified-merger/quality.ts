/**
 * Unified Metadata Merger - Quality Calculation Module
 *
 * Calculates quality metrics, confidence scores, and completeness ratings
 * for merged metadata.
 *
 * Extracted from: unified-merger.ts (lines 532-603)
 */

// ============================================================================
// Imports
// ============================================================================

import type {
  PartialUnifiedMetadata,
  MetadataQuality,
} from './types';

// ============================================================================
// Quality Calculation
// ============================================================================

/**
 * Calculate merged confidence score with provider priority weighting
 *
 * Weights confidence scores from multiple sources by their provider priority,
 * returning a normalized score that reflects both source quality and priority.
 *
 * @param sources - Array of partial metadata from different providers
 * @param getProviderPriority - Function to retrieve priority for a provider
 * @returns Confidence score between 0 and 1
 *
 * @example
 * const confidence = calculateMergedConfidence(sources, (provider) => {
 *   const config = priorities.find(p => p.provider === provider);
 *   return config?.priority ?? 0;
 * });
 */
export function calculateMergedConfidence(
  sources: PartialUnifiedMetadata[],
  getProviderPriority: (provider: string) => number,
): number {
  if (sources.length === 0) {
    return 0;
  }

  // Weight confidence by provider priority
  let totalWeight = 0;
  let weightedSum = 0;

  for (const source of sources) {
    const priority = getProviderPriority(source.primarySource ?? '');
    const confidence = source.metadataQuality?.overall ?? 0.5;
    totalWeight += priority;
    weightedSum += confidence * priority;
  }

  return totalWeight > 0 ? weightedSum / totalWeight : 0.5;
}

/**
 * Merge metadata quality information from multiple sources
 *
 * Aggregates quality metrics (completeness, accuracy, freshness) from
 * multiple sources and calculates an overall quality score.
 *
 * @param sources - Array of partial metadata from different providers
 * @returns Aggregated metadata quality metrics
 *
 * @example
 * const quality = mergeMetadataQuality(sources);
 * console.log(quality.overall); // 0.75
 * console.log(quality.sources); // 2
 */
export function mergeMetadataQuality(
  sources: PartialUnifiedMetadata[],
): MetadataQuality {
  let totalCompleteness = 0;
  let totalAccuracy = 0;
  let totalFreshness = 0;
  let sourceCount = 0;

  for (const source of sources) {
    if (source.metadataQuality) {
      totalCompleteness += source.metadataQuality.completeness;
      totalAccuracy += source.metadataQuality.accuracy;
      totalFreshness += source.metadataQuality.freshness;
      sourceCount++;
    }
  }

  const count = sourceCount > 0 ? sourceCount : 1;
  const completeness = totalCompleteness / count;
  const accuracy = totalAccuracy / count;
  const freshness = totalFreshness / count;

  return {
    completeness,
    accuracy,
    freshness,
    sources: sourceCount,
    overall: (completeness + accuracy + freshness) / 3,
  };
}

/**
 * Calculate metadata completeness based on important fields
 *
 * Evaluates the completeness of metadata by checking the presence and
 * validity of critical fields. Returns a score between 0 and 1 representing
 * the percentage of important fields that are populated.
 *
 * @param metadata - Partial unified metadata to evaluate
 * @returns Completeness score between 0 and 1
 *
 * @example
 * const completeness = calculateCompleteness(metadata);
 * // 0.8 means 8 out of 10 important fields are filled
 */
export function calculateCompleteness(
  metadata: PartialUnifiedMetadata,
): number {
  const importantFields: (keyof PartialUnifiedMetadata)[] = [
    'title',
    'description',
    'covers',
    'status',
    'format',
    'volumes',
    'chapters',
    'authors',
    'genres',
    'startDate',
  ];

  let filledFields = 0;

  for (const field of importantFields) {
    const value = metadata[field];

    if (value !== null && value !== undefined) {
      if (Array.isArray(value) && value.length > 0) {
        filledFields++;
      } else if (typeof value === 'object' && Object.keys(value).length > 0) {
        filledFields++;
      } else if (typeof value === 'string' && value.trim() !== '') {
        filledFields++;
      } else if (typeof value === 'number' || typeof value === 'boolean') {
        filledFields++;
      } else if (value instanceof Date) {
        filledFields++;
      }
    }
  }

  return filledFields / importantFields.length;
}
