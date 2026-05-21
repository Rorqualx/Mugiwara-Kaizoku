/**
 * Unified Metadata Merger - Simple Fields Module
 *
 * Handles merging of simple scalar fields (strings, numbers, booleans, dates).
 * Returns new objects instead of mutating parameters.
 *
 * Extracted from: unified-merger.ts (lines 200-243)
 */

import type { PartialUnifiedMetadata, MetadataMergeConflict } from './types';

// ============================================================================
// Simple Field Merging
// ============================================================================

/**
 * Merge simple fields from source into target (immutable)
 *
 * Returns a new object with merged fields. Tracks conflicts when
 * multiple providers have different values for the same field.
 *
 * @param target - Base metadata to merge into
 * @param source - Source metadata to merge from
 * @param conflicts - Array to track field conflicts
 * @param preferNonNull - Whether to prefer non-null values
 * @returns New metadata object with merged fields and updated conflicts array
 *
 * @example
 * ```typescript
 * const { merged, conflicts } = mergeSimpleFields(
 *   { title: 'One Piece', status: 'ONGOING' },
 *   { title: 'One Piece', volumeCount: 100 },
 *   [],
 *   true
 * );
 * // merged = { title: 'One Piece', status: 'ONGOING', volumeCount: 100 }
 * // conflicts = []
 * ```
 */
export function mergeSimpleFields(
  target: PartialUnifiedMetadata,
  source: PartialUnifiedMetadata,
  conflicts: MetadataMergeConflict[],
  _preferNonNull: boolean
): { merged: PartialUnifiedMetadata; conflicts: MetadataMergeConflict[] } {
  const simpleFields: (keyof PartialUnifiedMetadata)[] = [
    'title',
    'description',
    'status',
    'format',
    'chapterCount',
    'volumeCount',
    'startDate',
    'endDate',
    'year',
    'publisher',
    'bannerImage',
    'coverImage',
  ];

  let merged = { ...target };
  const updatedConflicts = [...conflicts];

  for (const field of simpleFields) {
    const targetValue = target[field];
    const sourceValue = source[field];

    // Skip if source doesn't have this field
    if (sourceValue === undefined) continue;

    // If target doesn't have it, use source
    if (targetValue === null || targetValue === undefined) {
      merged = { ...merged, [field]: sourceValue };
      continue;
    }

    // Both have values - check for conflict
    if (targetValue !== sourceValue) {
      // Record conflict (without mutating original array)
      const existingConflictIndex = updatedConflicts.findIndex(c => c.field === field);

      if (existingConflictIndex !== -1) {
        const existingConflict = updatedConflicts[existingConflictIndex];

        if (!existingConflict) {
          continue;
        }

        const existingValue = existingConflict.values.find(
          v => v.provider === (source.primarySource ?? 'unknown')
        );

        if (!existingValue) {
          // Create new conflict object with updated values
          updatedConflicts[existingConflictIndex] = {
            ...existingConflict,
            values: [
              ...existingConflict.values,
              {
                provider: source.primarySource ?? 'unknown',
                value: sourceValue,
              },
            ],
          };
        }
      } else {
        // Add new conflict
        updatedConflicts.push({
          field: field as string,
          values: [
            {
              provider: target.primarySource ?? 'unknown',
              value: targetValue,
            },
            {
              provider: source.primarySource ?? 'unknown',
              value: sourceValue,
            },
          ],
        });
      }
    }
  }

  return { merged, conflicts: updatedConflicts };
}
