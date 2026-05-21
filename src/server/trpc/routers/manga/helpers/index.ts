/**
 * Manga Router Helpers - Main Aggregator
 *
 * This module aggregates all manga router helper utilities into a single
 * unified export. All functions and types from the sub-modules are exposed
 * at the top level for backward compatibility.
 *
 * Architecture:
 * - types.ts - Core type definitions, interfaces, and constants
 * - schemas.ts - Zod validation schemas for input validation
 * - type-guards.ts - Type guards, safe getters, and relation helpers
 * - normalizers.ts - Data normalization functions
 * - chapter-operations.ts - Chapter extraction and creation operations
 * - chapter-creation.ts - Generic chapter creation utilities
 *
 * Original file: 838 lines → Refactored: 6 modules (max ~310 lines each)
 */

// ============================================================================
// Types Module
// ============================================================================
export {
  DEFAULT_CHAPTER_LIMIT,
  type MangaWithRelations,
  type MangaMetadata,
  type MangaSearchResult,
  type NormalizedVolume,
  type ChapterToCreate,
  type ChapterEnrichment,
} from './types';

// ============================================================================
// Schemas Module
// ============================================================================
export {
  includeSchema,
  idSchema,
  mangaIdSchema,
  bindSchema,
  downloadSchema,
  searchSchema,
  providerConfirmationSearchSchema,
  bindProviderSchema,
  mergeMetadataFromProvidersSchema,
  addMangaSchema,
  updateProviderPreferencesSchema,
} from './schemas';

// ============================================================================
// Type Guards Module
// ============================================================================
export {
  isMangaLike,
  isRecord,
  safeGet,
  safeGetString,
  safeGetNumber,
  safeGetStringOptional,
  parseNumber,
  createMangaRelations,
  includeMangaRelations,
} from './type-guards';

// ============================================================================
// Normalizers Module
// ============================================================================
export {
  normalizeVolumeData,
  parseReleaseDate,
} from './normalizers';

// ============================================================================
// Chapter Operations Module
// ============================================================================
export {
  mergeMissingChaptersFromEnrichment,
  sortAndAssignSequentialIndices,
  batchCreateChaptersInDatabase,
  extractChaptersFromFandomVolumes,
  extractChaptersFromFandomArray,
  createFandomChapters,
} from './chapter-operations';

// ============================================================================
// Chapter Creation Module
// ============================================================================
export {
  createGenericChapters,
} from './chapter-creation';
