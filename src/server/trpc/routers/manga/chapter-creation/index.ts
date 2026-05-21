/**
 * Chapter Creation Module
 *
 * Modular chapter creation system refactored from monolithic chapterCreationHelpers.ts.
 *
 * Architecture:
 * - types.ts - Type definitions (ChapterToCreate, ChapterEnrichment, NormalizedVolume)
 * - helpers.ts - Utility functions (safeGet*, parseNumber, isRecord, parseReleaseDate)
 * - normalizer/ - Volume data normalization with field extractors
 * - enrichment.ts - Chapter merging and index assignment
 * - database.ts - Batch database operations
 * - fandom-extractors.ts - Fandom-specific extraction
 * - volume-creation/ - Main volume-based chapter creation
 * - fandom-creation.ts - Fandom chapter creation
 * - generic-creation.ts - Generic/placeholder chapter creation
 *
 * Original: 869 lines -> Refactored: 11 modules (max ~150 lines each)
 *
 * Exports:
 * - createChaptersFromVolumes: Main entry for volume-based creation
 * - createFandomChapters: Fandom-specific chapter creation
 * - createGenericChapters: Generic/placeholder chapter creation
 */

// Types
export type {
  ChapterToCreate,
  ChapterEnrichment,
  NormalizedVolume,
  PreParsedHandlerResult,
  FallbackHandlerResult,
  ParseChaptersFromDescriptionFn
} from './types';

// Main creation functions
export { createChaptersFromVolumes } from './volume-creation';
export { createFandomChapters } from './fandom-creation';
export { createGenericChapters } from './generic-creation';

// Utilities (for internal use or testing)
export { normalizeVolumeData } from './normalizer';
export {
  mergeMissingChaptersFromEnrichment,
  sortAndAssignSequentialIndices
} from './enrichment';
export { batchCreateChaptersInDatabase } from './database';
export {
  extractChaptersFromFandomVolumes,
  extractChaptersFromFandomArray
} from './fandom-extractors';

// Helper functions (commonly needed)
export {
  safeGet,
  safeGetString,
  safeGetNumber,
  safeGetStringOptional,
  parseNumber,
  isRecord,
  parseReleaseDate
} from './helpers';
