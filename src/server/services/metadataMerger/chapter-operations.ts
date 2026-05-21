/**
 * Chapter Operations Module
 *
 * Re-exports from modular chapter operations structure.
 * See ./chapter-operations/ for implementation details.
 *
 * @deprecated This file is a compatibility layer. Import from ./chapter-operations/ directly.
 */

// Re-export main functions
export { recreateChaptersIfNeeded } from './chapter-operations/index';
export { enrichChapterMetadataFromComicVine, enrichChapterMetadataFromFandom } from './chapter-operations/enrichment';

// Re-export types
export type { ExtractedChapter, ChapterExtractionResult } from './chapter-operations/types';
