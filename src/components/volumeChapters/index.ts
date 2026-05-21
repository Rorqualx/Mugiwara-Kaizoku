/**
 * Volume Chapters Module - Main Entry Point
 *
 * This module provides components and utilities for displaying and managing
 * manga chapters organized by volume. It includes:
 *
 * - VolumeChaptersTable: Single volume display with chapter list
 * - VolumeGroupedChapters: Multi-volume grouping with expansion controls
 * - Type definitions for volume and chapter data structures
 * - Utility functions for chapter processing and formatting
 * - Custom hooks for data fetching and mutations
 *
 * @module volumeChapters
 */

// ============================================================================
// Type Exports
// ============================================================================

export type {
  // Core Data Structures
  ChapterDataInVolume,
  ParsedProviderMetadata,
  VolumeData,
  VolumeProcessingState,
  PlaceholderVolumeMap,

  // Component Props
  VolumeChaptersTableProps,
  VolumeGroupedChaptersProps,
  MangaVolumeMetadata,
  MangaForVolumeGrouping,
} from './types';

// ============================================================================
// Utility Function Exports
// ============================================================================

export {
  // Type Guards
  isValidChapter,

  // Chapter Data Extraction
  getChapterNumber,
  getChapterName,
  extractVolumeNumber,

  // Formatting
  formatReleaseDate,
  getStatusBadge,

  // Data Enrichment
  enrichChapter,

  // Placeholder Generation
  generatePlaceholderChapters,

  // File Verification Types
  type FileVerificationResult,
  type FileVerificationMap,
} from './utils';

// ============================================================================
// Hook Exports
// ============================================================================

export {
  // Query Hooks
  useChapterProgress,
  useProgressMap,
  useChapterFileVerification,
  useEnrichedVolumeModalData,

  // Mutation Hooks
  useToggleVolumeMonitoring,
  useToggleChapterMonitoring,
  useQuickDownloadVolume,
} from './hooks';

// ============================================================================
// Component Exports
// ============================================================================

export { VolumeChaptersTable } from './VolumeChaptersTable';
export { VolumeGroupedChapters } from './VolumeGroupedChapters';

// ============================================================================
// Default Export (Main Component)
// ============================================================================

export { VolumeChaptersTable as default } from './VolumeChaptersTable';
