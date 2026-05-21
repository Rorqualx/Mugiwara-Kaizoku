/**
 * Wikipedia Fallback Enrichment - Barrel Exports
 *
 * Phase 3.5: Wikipedia fallback enrichment (gap-fill only).
 * Fills gaps left by Fandom enrichment using Wikipedia data.
 * Only updates existing chapters — never creates new ones.
 * Skips entirely if Fandom already filled 90%+ of chapter titles.
 *
 * Non-critical: failures log a warning but don't block the pipeline.
 */

// Re-export all public functions and types from submodules
export * from './types';
export * from './enrichment-state';
export * from './data-fetching';
export * from './data-conversion';
export * from './db-application';
export * from './volume-ranges';
export * from './logging';

// Export the main phase function (will be defined in the main file)
// Note: phaseWikipediaFallback is defined in the original file, not here
// This barrel export is for internal use only