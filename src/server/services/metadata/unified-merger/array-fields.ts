/**
 * Unified Metadata Merger - Array Fields Module
 *
 * Handles merging of array fields with deduplication.
 * Returns new objects instead of mutating parameters.
 *
 * Extracted from: unified-merger.ts (lines 247-346)
 *
 * @module unified-merger/array-fields
 */

import { toStringId } from '@/utils/id-converters';
import { hasProperty } from '@/utils/type-guards';

import type { PartialUnifiedMetadata, TagInfo } from './types';

// ============================================================================
// Array Field Merging
// ============================================================================

/**
 * Merge array fields from source into target (immutable)
 *
 * Handles string arrays, person arrays, character arrays, and tag arrays.
 * All merging respects the mergeArrays and deduplicateArrays flags.
 *
 * @param target - Base metadata object
 * @param source - Source metadata to merge from
 * @param mergeArrays - Whether to merge or replace arrays
 * @param deduplicateArrays - Whether to deduplicate string arrays
 * @returns New metadata object with merged arrays
 */
export function mergeArrayFields(
  target: PartialUnifiedMetadata,
  source: PartialUnifiedMetadata,
  mergeArrays: boolean,
  deduplicateArrays: boolean
): PartialUnifiedMetadata {
  let merged = { ...target };

  // String arrays (alternativeTitles, genres)
  const stringArrayFields: (keyof PartialUnifiedMetadata)[] = [
    'alternativeTitles',
    'genres',
  ];

  for (const field of stringArrayFields) {
    const targetArray = target[field] as string[] | undefined;
    const sourceArray = source[field] as string[] | undefined;

    if (!sourceArray || sourceArray.length === 0) continue;

    if (!targetArray || targetArray.length === 0) {
      merged = { ...merged, [field]: [...sourceArray] };
    } else if (mergeArrays) {
      const combined = [...targetArray, ...sourceArray];
      merged = {
        ...merged,
        [field]: deduplicateArrays ? Array.from(new Set(combined)) : combined,
      };
    }
  }

  // Person arrays (authors, artists)
  merged = mergePersonArrays(merged, source, 'authors', mergeArrays);
  merged = mergePersonArrays(merged, source, 'artists', mergeArrays);

  // Character array
  merged = mergeCharacterArray(merged, source, mergeArrays);

  // Tag array
  merged = mergeTagArray(merged, source, mergeArrays);

  return merged;
}

// ============================================================================
// Person Array Merging
// ============================================================================

/**
 * Merge person arrays with name-based deduplication (immutable)
 *
 * Deduplicates by lowercase name comparison. Preserves all existing persons
 * and adds new ones that don't match existing names.
 *
 * @param target - Base metadata object
 * @param source - Source metadata to merge from
 * @param field - Which person array to merge (authors or artists)
 * @param mergeArrays - Whether to merge or skip
 * @returns New metadata object with merged person array
 */
export function mergePersonArrays(
  target: PartialUnifiedMetadata,
  source: PartialUnifiedMetadata,
  field: 'authors' | 'artists',
  mergeArrays: boolean
): PartialUnifiedMetadata {
  const targetArray = target[field] as string[] | undefined;
  const sourceArray = source[field] as string[] | undefined;

  if (!sourceArray || sourceArray.length === 0) return target;

  if (!targetArray || targetArray.length === 0) {
    return { ...target, [field]: [...sourceArray] };
  }

  if (!mergeArrays) return target;

  // Merge with deduplication
  const merged = [...targetArray];
  const existingNames = new Set(
    targetArray.map(name =>
      typeof name === 'string' ? name.toLowerCase() : ''
    )
  );

  for (const person of sourceArray) {
    const name =
      typeof person === 'string'
        ? person
        : hasProperty(person, 'name')
        ? String(person['name'])
        : '';
    const nameLower = name.toLowerCase();

    if (name && !existingNames.has(nameLower)) {
      merged.push(name);
      existingNames.add(nameLower);
    }
  }

  return { ...target, [field]: merged };
}

// ============================================================================
// Character Array Merging
// ============================================================================

/**
 * Merge character array with ID-based deduplication (immutable)
 *
 * Deduplicates by character ID. Preserves all existing characters and adds
 * new ones that don't have matching IDs.
 *
 * @param target - Base metadata object
 * @param source - Source metadata to merge from
 * @param mergeArrays - Whether to merge or skip
 * @returns New metadata object with merged character array
 */
export function mergeCharacterArray(
  target: PartialUnifiedMetadata,
  source: PartialUnifiedMetadata,
  mergeArrays: boolean
): PartialUnifiedMetadata {
  if (!source.characters || source.characters.length === 0) return target;

  if (!target.characters || target.characters.length === 0) {
    return { ...target, characters: [...source.characters] };
  }

  if (!mergeArrays) return target;

  const merged = [...target.characters];
  const existingIds = new Set(target.characters.map(c => toStringId(c['id'])));

  for (const character of source.characters) {
    if (!existingIds.has(toStringId(character['id']))) {
      merged.push(character);
      existingIds.add(toStringId(character['id']));
    }
  }

  return { ...target, characters: merged };
}

// ============================================================================
// Tag Array Merging
// ============================================================================

/**
 * Merge tag array with rank preservation (immutable)
 *
 * Deduplicates by lowercase tag name. When duplicate tags exist, keeps the
 * one with the higher rank value.
 *
 * @param target - Base metadata object
 * @param source - Source metadata to merge from
 * @param mergeArrays - Whether to merge or skip
 * @returns New metadata object with merged tag array
 */
export function mergeTagArray(
  target: PartialUnifiedMetadata,
  source: PartialUnifiedMetadata,
  mergeArrays: boolean
): PartialUnifiedMetadata {
  const sourceTags = source['tags'];
  const targetTags = target['tags'];

  if (!sourceTags || sourceTags.length === 0) return target;

  if (!targetTags || targetTags.length === 0) {
    return { ...target, tags: [...sourceTags] };
  }

  if (!mergeArrays) return target;

  const tagMap = new Map<string, TagInfo>();

  // Add target tags
  for (const tag of targetTags) {
    tagMap.set(tag['name'].toLowerCase(), tag);
  }

  // Merge source tags, keeping higher rank
  for (const tag of sourceTags) {
    const key = tag['name'].toLowerCase();
    const existing = tagMap.get(key);

    if (
      !existing ||
      (tag.rank && (!existing.rank || tag.rank > existing.rank))
    ) {
      tagMap.set(key, tag);
    }
  }

  return { ...target, tags: Array.from(tagMap.values()) };
}
