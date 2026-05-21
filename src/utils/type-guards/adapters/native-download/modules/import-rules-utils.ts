/**
 * Import Rules Validation Utilities
 *
 * Shared validation helper functions for import rule type guards.
 * Extracted from import-rules-types.ts to reduce complexity.
 *
 * @module ImportRulesValidationUtils
 * @category TypeGuards
 * @subcategory Kapowarr
 */

/**
 * Validates libraryId field in ImportActions
 */
export function validateImportActionsLibrary(candidate: Record<string, unknown>): boolean {
  return !('libraryId' in candidate) || typeof candidate['libraryId'] === 'number';
}

/**
 * Validates tags field in ImportActions
 */
export function validateImportActionsTags(candidate: Record<string, unknown>): boolean {
  if (!('tags' in candidate)) {
    return true;
  }
  
  return Array.isArray(candidate['tags']) && 
         candidate['tags'].every((x: unknown) => typeof x === 'string');
}

/**
 * Validates status field in ImportActions
 */
export function validateImportActionsStatus(candidate: Record<string, unknown>): boolean {
  return !('status' in candidate) || typeof candidate['status'] === 'string';
}

/**
 * Validates skip field in ImportActions
 */
export function validateImportActionsSkip(candidate: Record<string, unknown>): boolean {
  return !('skip' in candidate) || typeof candidate['skip'] === 'boolean';
}

/**
 * Validates metadataProvider field in ImportActions
 */
export function validateImportActionsMetadata(candidate: Record<string, unknown>): boolean {
  return !('metadataProvider' in candidate) || typeof candidate['metadataProvider'] === 'string';
}

/**
 * Validates priority field in ImportActions
 */
export function validateImportActionsPriority(candidate: Record<string, unknown>): boolean {
  return !('priority' in candidate) || typeof candidate['priority'] === 'number';
}

/**
 * Validates namingPattern field in ImportActions
 */
export function validateImportActionsNaming(candidate: Record<string, unknown>): boolean {
  return !('namingPattern' in candidate) || typeof candidate['namingPattern'] === 'string';
}

/**
 * Validates destinationFolder field in ImportActions
 */
export function validateImportActionsDestination(candidate: Record<string, unknown>): boolean {
  return !('destinationFolder' in candidate) || typeof candidate['destinationFolder'] === 'string';
}

/**
 * Validates readingDirection field in ImportActions
 */
export function validateImportActionsReadingDirection(candidate: Record<string, unknown>): boolean {
  return !('readingDirection' in candidate) || 'readingDirection' in candidate;
}
