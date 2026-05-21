/**
 * Import Pipeline Module
 *
 * Pipeline-based UI for importing manga files from local directories.
 *
 * @module components/library/import-pipeline
 */

// Main component
export { ImportPipeline } from './ImportPipeline';

// Context
export { ImportPipelineProvider, useImportPipelineContext } from './ImportPipelineContext';

// Hooks
export { useImportPipeline } from './hooks';
export type { UseImportPipelineReturn } from './hooks';

// Types
export type {
  PipelineStage,
  ScannedMangaItem,
  MatchedMangaItem,
  MatchStatus,
  MatchFilter,
  ImportOptions,
  ImportResult,
  ImportPipelineState,
  ScanStats,
  MatchStats,
  ImportStats,
} from './types';
