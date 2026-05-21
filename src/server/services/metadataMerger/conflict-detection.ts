/**
 * Conflict Detection Module
 *
 * Functions for detecting and storing metadata conflicts between
 * different providers. Identifies when providers disagree on field values.
 *
 * Extracted from: metadataMerger.ts
 */


import { Prisma } from '@prisma/client';

import { prisma } from '@/server/db';
import { logger } from '@/utils/logger';


import type { MetadataValues, ExtendedPrismaClient } from './utils';
import type { SearchResult } from '../search/types';

// ============================================================================
// Conflict Detection Functions
// ============================================================================

/**
 * Capture metadata values from different providers for conflict detection
 *
 * @param metadataValues - Object to store metadata values
 * @param metadata - Metadata from a provider
 * @param provider - Provider name
 */
export function captureMetadataValues(
  metadataValues: MetadataValues,
  metadata: SearchResult,
  provider: string
): void {
  // Helper function to add a value to the metadata values object
  const addValue = (field: string, value: unknown): void => {
    if (value === null) return;
    // Normalize empty arrays and strings
    if (Array.isArray(value) && value.length === 0) return;
    if (typeof value === 'string' && value.trim() === '') return;
    // Use Object.assign to avoid no-param-reassign lint errors
    const existingField = metadataValues[field];
    const fieldObj = existingField ?? {};
    if (!existingField) {
      Object.assign(metadataValues, { [field]: fieldObj });
    }
    // Assign provider value to the field object
    Object.assign(fieldObj, { [provider]: value });
  };

  // Capture common fields
  addValue('summary', metadata['description']);
  addValue('genres', metadata['genres']);
  addValue('status', metadata['status']);
  // Using staff field as authors since SearchResult doesn't have authors property
  addValue('authors', metadata.staff);
  addValue('synonyms', metadata['alternativeTitles']);

  // Validate chapters and volumes to ensure they're not date years
  const isValidCount = (value: unknown): boolean => {
    if (typeof value !== 'number') return false;
    // Check if value might be a year (between 1900 and 2100)
    if (value >= 1900 && value <= 2100) {
      logger.warn(`Suspicious count value ${value} detected - might be a year`);
      return false;
    }
    // Check for reasonable manga counts
    if (value < 0 || value > 10000) {
      logger.warn(`Unreasonable count value ${value} detected`);
      return false;
    }
    return true;
  };

  // Only add chapters/volumes if they're valid counts
  if (metadata['chapters'] !== null && isValidCount(metadata['chapters'])) {
    addValue('chapters', metadata['chapters']);
  }
  if (metadata.volumes !== null && isValidCount(metadata.volumes)) {
    addValue('volumes', metadata.volumes);
  }

  // Capture dates
  if (metadata.startDate) {
    try {
      addValue('startDate', new Date(metadata.startDate));
    } catch (_error: unknown) {
      // Ignore invalid dates
    }
  }
  if (metadata.endDate) {
    try {
      addValue('endDate', new Date(metadata.endDate));
    } catch (_error: unknown) {
      // Ignore invalid dates
    }
  }
}

/**
 * Calculate Levenshtein distance between two strings
 *
 * @param str1 - First string
 * @param str2 - Second string
 * @returns Levenshtein distance
 */
export function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;

  // Create distance matrix
  const d: number[][] = Array.from({ length: m + 1 }, () =>
    Array.from({ length: n + 1 }, () => 0)
  );

  // Initialize first row and column
  for (let i = 0; i <= m; i++) {
    const row = d[i];
    if (row !== undefined) {
      row[0] = i;
    }
  }
  for (let j = 0; j <= n; j++) {
    const firstRow = d[0];
    if (firstRow !== undefined) {
      firstRow[j] = j;
    }
  }

  // Calculate distance
  for (let j = 1; j <= n; j++) {
    for (let i = 1; i <= m; i++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      const currentRow = d[i];
      const prevRow = d[i - 1];
      if (currentRow !== undefined && prevRow !== undefined) {
        const prevCol = currentRow[j - 1];
        const prevDiag = prevRow[j - 1];
        const prevRowVal = prevRow[j];
        if (prevCol !== undefined && prevDiag !== undefined && prevRowVal !== undefined) {
          currentRow[j] = Math.min(
            prevRowVal + 1, // deletion
            prevCol + 1, // insertion
            prevDiag + cost // substitution
          );
        }
      }
    }
  }

  const lastRow = d[m];
  const result = lastRow?.[n];
  return result ?? 0;
}

/**
 * Calculate similarity between two strings (0 to 1)
 *
 * @param str1 - First string
 * @param str2 - Second string
 * @returns Similarity score (0 to 1)
 */
export function calculateStringSimilarity(str1: string, str2: string): number {
  if (str1 === str2) return 1;
  if (str1.length === 0 || str2.length === 0) return 0;

  // Use Levenshtein distance for string similarity
  const dist = levenshteinDistance(str1, str2);
  const maxLength = Math.max(str1.length, str2.length);
  return 1 - dist / maxLength;
}

/**
 * Detect conflicts between metadata values from different providers
 *
 * @param metadataValues - Object containing metadata values from different providers
 * @returns Object containing fields with conflicts
 */
export function detectMetadataConflicts(
  metadataValues: MetadataValues
): Record<string, unknown> {
  const conflicts: Record<string, unknown> = {};

  // Helper function to check if values are significantly different
  const areValuesDifferent = (values: Record<string, unknown>): boolean => {
    const providers = Object.keys(values);
    if (providers.length <= 1) return false;

    // Get value from first provider as reference
    const referenceProvider = providers[0];
    if (referenceProvider === undefined) return false;
    const referenceValue = values[referenceProvider];

    // Check if any other provider has a significantly different value
    for (let i = 1; i < providers.length; i++) {
      const provider = providers[i];
      if (provider === undefined) continue;
      const value = values[provider];

      // Compare based on value type
      if (Array.isArray(referenceValue) && Array.isArray(value)) {
        // For arrays, check if they're significantly different
        // (allow some items to be the same, but require at least 50% difference)
        const commonItems = referenceValue.filter((item) => value.includes(item));
        const maxLength = Math.max(referenceValue.length, value.length);
        if (commonItems.length < maxLength * 0.5) {
          return true;
        }
      } else if (typeof referenceValue === 'string' && typeof value === 'string') {
        // For strings, check if they're significantly different
        // (allow some similarity, but require at least 50% difference)
        if (calculateStringSimilarity(referenceValue, value) < 0.5) {
          return true;
        }
      } else if (referenceValue instanceof Date && value instanceof Date) {
        // For dates, check if they differ by more than 30 days
        const diffInDays = Math.abs(
          (referenceValue.getTime() - value.getTime()) / (1000 * 60 * 60 * 24)
        );
        if (diffInDays > 30) {
          return true;
        }
      } else if (typeof referenceValue === 'number' && typeof value === 'number') {
        // For numbers, check if they differ by more than 10%
        const maxValue = Math.max(Math.abs(referenceValue), Math.abs(value));
        if (maxValue > 0 && Math.abs(referenceValue - value) / maxValue > 0.1) {
          return true;
        }
      } else {
        // For other types, check if they're strictly not equal
        if (referenceValue !== value) {
          return true;
        }
      }
    }
    return false;
  };

  // Check each field for conflicts
  for (const [field, values] of Object.entries(metadataValues)) {
    if (areValuesDifferent(values)) {
      conflicts[field] = values;
    }
  }

  return conflicts;
}

/**
 * Store metadata conflicts in the database
 *
 * @param mangaId - Manga ID
 * @param conflicts - Object containing fields with conflicts
 */
export async function storeMetadataConflicts(
  mangaId: number,
  conflicts: Record<string, unknown>
): Promise<void> {
  try {
    // Use typed extended client for optional MetadataConflict model
    const extendedPrisma = prisma as unknown as ExtendedPrismaClient;

    // Check if the model exists before using it
    if (!extendedPrisma.metadataConflict) {
      logger.warn('MetadataConflict model not available in schema, skipping conflict storage');
      return;
    }

    // Clear existing unresolved conflicts for this manga
    await extendedPrisma.metadataConflict.deleteMany({
      where: {
        mangaId,
        resolved: false
      }
    });

    // Store new conflicts
    const conflictData = Object.entries(conflicts).map(([fieldName, values]) => ({
      mangaId,
      fieldName,
      values: values as Prisma.InputJsonValue,
      resolved: false
    }));

    if (conflictData.length > 0) {
      await extendedPrisma.metadataConflict.createMany({
        data: conflictData,
        skipDuplicates: true
      });
      logger.debug(`Stored ${conflictData.length} conflicts for manga ${mangaId}`);
    }
  } catch (error: unknown) {
    logger.error(
      `Error storing metadata conflicts: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
