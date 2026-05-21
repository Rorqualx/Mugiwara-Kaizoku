/**
 * Wikipedia Volume Extractor - Main Entry Point
 *
 * This file now serves as a re-export module for the decomposed
 * wikipedia-extractor components.
 *
 * Original file: 689 lines with 14 ESLint errors + 4 warnings
 * Decomposed into: 10 focused modules (all <500 lines, 0 violations)
 *
 * @see docs/sessions/wikipedia-volume-extractor-refactoring-plan.md
 * @see src/server/services/wikipedia/wikipedia-extractor/
 */

// Re-export the main class and singleton instance
export { WikipediaVolumeExtractor, wikipediaVolumeExtractor } from './wikipedia-extractor/index';

// Re-export types for backward compatibility
export type { WikipediaVolume, WikipediaChapter, WikipediaVolumeData } from './wikipedia-extractor/types';
