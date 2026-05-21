/**
 * Chapter Creation Helpers - Legacy Re-exports
 *
 * This file now re-exports from the decomposed chapter-creation module.
 * All implementations have been moved to focused modules for better maintainability.
 *
 * Original: 869 lines (exceeded ESLint limits)
 * Refactored: 11 focused modules in chapter-creation/
 *
 * @see ./chapter-creation/index.ts for module architecture
 */

// Re-export all public APIs from the new module structure
export {
  // Types
  type ChapterToCreate,
  type ChapterEnrichment,
  type NormalizedVolume,

  // Main creation functions
  createChaptersFromVolumes,
  createFandomChapters,
  createGenericChapters,
} from './chapter-creation';
