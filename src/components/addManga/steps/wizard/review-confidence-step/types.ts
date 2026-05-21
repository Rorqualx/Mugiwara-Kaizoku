/**
 * ReviewConfidenceStep Types
 *
 * Type definitions and interfaces for the ReviewConfidenceStep component
 * and its sub-components.
 *
 * Extracted from: ReviewConfidenceStep.tsx (lines 20-73)
 */

import type { Dispatch, SetStateAction } from 'react';

// ============================================================================
// Helper Types
// ============================================================================

/**
 * Volume data structure with optional fields
 */
export interface VolumeData {
  volumes: unknown[] | undefined;
  totalVolumes: number | undefined;
  totalChapters: number | undefined;
}

/**
 * External IDs from various providers
 */
export interface ExternalIds {
  anilistId?: string;
  malId?: string;
  comicVineId?: string;
  kitsuId?: string;
  mangaUpdatesId?: string;
}

/**
 * Media gallery structure
 */
export interface MediaGallery {
  covers: unknown[];
  gallery: unknown[];
  volumeCovers: unknown[];
}

// ============================================================================
// Main Props Interface
// ============================================================================

/**
 * Props for the ReviewConfidenceStep component
 *
 * This interface defines all properties needed for the final review step
 * that displays selected data and metadata quality scores before import.
 */
export interface ReviewConfidenceStepProps {
  // Media
  selectedCover?: string;
  selectedBanner?: string;
  selectedVolumes: (number | string)[];
  setSelectedVolumes: Dispatch<SetStateAction<(number | string)[]>>;
  displayVolumes: unknown[];
  volumeDisplaySource?: string;
  chapterDisplaySource?: string;
  volumeCoversByProvider: Record<string, string[]>;
  selectedGalleryImages: string[];

  // Chapters
  volumesData: VolumeData;
  allChapterUrls?: unknown[];
  selectedChapters?: unknown[];
  chapterMetadataCache: Map<string, unknown>;

  // Metadata - formData contains user-selected values from MetadataSelectionStep
  selectedMetadata: unknown;
  // Full metadata from all providers (for context/reference)
  selectedSourcesMetadata?: Record<string, unknown>;
  externalIds: ExternalIds;
  externalLinks: string[];

  // Media Gallery
  mediaGallery: MediaGallery;

  // Provider info
  provider: string;

  // Import state
  isImporting?: boolean;
  importProgress?: number;
  onImport?: () => void | Promise<void>;

  // Helper functions
  calculateFieldConfidence?: (field: string, value: unknown) => number;
  getConfidenceColor?: (score: number) => string;
}
