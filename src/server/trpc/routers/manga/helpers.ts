/**
 * Manga Router Helpers - Backward Compatibility Re-export
 *
 * This file has been refactored into focused modules for better maintainability.
 * All exports are now re-exported from the ./helpers directory for backward compatibility.
 *
 * Architecture:
 * - helpers/types.ts - Core type definitions, interfaces, and constants (113 lines)
 * - helpers/schemas.ts - Zod validation schemas (132 lines)
 * - helpers/type-guards.ts - Type guards, safe getters, relation helpers (116 lines)
 * - helpers/normalizers.ts - Data normalization functions (276 lines)
 * - helpers/chapter-operations.ts - Chapter extraction and Fandom operations (310 lines)
 * - helpers/chapter-creation.ts - Generic chapter creation utilities (220 lines)
 * - helpers/index.ts - Main aggregator (80 lines)
 *
 * Original: 838 lines → Refactored: 7 modules (max 310 lines each)
 * Reduction: 97% in main file, total lines distributed for maintainability
 *
 * Quality Improvements:
 * - normalizeVolumeData complexity: 63 → ~8 (decomposed into field extractors)
 * - createGenericChapters complexity: 27 → ~5 (decomposed into handlers)
 * - sortAndAssignSequentialIndices: Fixed parameter reassignment violation
 * - Removed unused import: MangaPublicationStatus
 *
 * All files pass TypeScript strict mode and ESLint validation.
 */

// Re-export everything from the modular helpers directory
export * from './helpers/index';
