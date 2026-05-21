/**
 * Parser Bridge Utilities
 *
 * Normalization and merge helpers for extracted entities.
 * Normalizers, blacklists, and validators are imported from the shared
 * source-knowledge layer. Merge logic is bridge-specific and stays here.
 *
 * @module auto-labeling/parser-bridge/utils
 */

import {
  isValidEntityContent,
  normalizeDateValue,
} from '@/server/shared/source-knowledge';

import type { ExtractedEntity } from '../types';

// ============================================================================
// Re-exports from shared layer (backward compatibility)
// ============================================================================

export { isValidEntityContent } from '@/server/shared/source-knowledge/validation';
export { normalizeEntityValue } from '@/server/shared/source-knowledge/normalizers/entity-normalizer';
export { normalizeStatusValue } from '@/server/shared/source-knowledge/normalizers/status-normalizer';
export { normalizeDateValue } from '@/server/shared/source-knowledge/normalizers/date-normalizer';

// ============================================================================
// Merge Logic (bridge-specific)
// ============================================================================

/**
 * Merge extractions from multiple sources.
 * Filters out blacklisted/noise content before merging.
 */
export function mergeExtractions(
  parserEntities: ExtractedEntity[],
  bootstrapEntities: ExtractedEntity[],
  staticEntities: ExtractedEntity[]
): ExtractedEntity[] {
  const seen = new Map<string, ExtractedEntity>();

  // Process all entities, keeping the highest confidence for each type+value
  const allEntities = [...parserEntities, ...bootstrapEntities, ...staticEntities];

  for (const entity of allEntities) {
    // Filter out blacklisted/noise content
    if (!isValidEntityContent(entity.value, entity.type)) {
      continue;
    }

    // Apply type-specific normalizations
    let processedEntity = entity;
    if (entity.type === 'RELEASE_DATE') {
      const normalizedDate = normalizeDateValue(entity.value);
      processedEntity = {
        ...entity,
        value: normalizedDate,
        normalizedValue: normalizedDate,
      };
    }

    const key = `${processedEntity.type}:${processedEntity.normalizedValue}`;
    const existing = seen.get(key);

    if (!existing || processedEntity.confidence > existing.confidence) {
      seen.set(key, {
        ...processedEntity,
        source: existing ? 'merged' : processedEntity.source,
      });
    }
  }

  const merged = [...seen.values()];

  // Sort by type and confidence
  merged.sort((a, b) => {
    if (a.type !== b.type) return a.type.localeCompare(b.type);
    return b.confidence - a.confidence;
  });

  return merged;
}

/**
 * Merge source-specific entities with general parser entities.
 * Source-specific extraction takes precedence for overlapping entity types.
 */
export function mergeSourceSpecificEntities(
  parserEntities: ExtractedEntity[],
  sourceEntities: ExtractedEntity[]
): ExtractedEntity[] {
  // Source-specific entity types that should override parser results
  const sourceTypes = new Set(sourceEntities.map(e => e.type));

  // Filter out parser entities that conflict with source extraction
  const filteredParser = parserEntities.filter(e => !sourceTypes.has(e.type));

  // Combine: source entities first (higher priority), then filtered parser entities
  return [...sourceEntities, ...filteredParser];
}
