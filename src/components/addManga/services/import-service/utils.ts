/**
 * Import Service Utilities Module
 *
 * Shared helper functions, type definitions, and interfaces
 * used across all import service modules.
 *
 * Extracted from: importService.ts (lines 15-32)
 */

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard to check if value is a Record object
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Type guard to check if value is an array
 */
export function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

// ============================================================================
// Interfaces
// ============================================================================

export interface ImportServiceConfig {
  onComplete: (mangaId: number) => void;
  onCancel: () => void;
  // TRPC mutation for adding manga
  addMangaMutation: unknown; // Will be typed as UseMutationResult from TRPC
  // TRPC utils for cache invalidation
  utils: unknown; // Will be typed as TRPCUtils
}

export interface ImportAdditionalData {
  libraryId: number;
  provider: string;
  selectedSourcesMetadata: Record<string, unknown>;
  mediaGallery: unknown;
  volumesData: unknown;
  externalIds: unknown;
  externalLinks: string[];
  chapterMetadataCache: Map<string, unknown>;
  selectedCover?: string;
  selectedBanner?: string;
  selectedGalleryImages?: string[];
  volumeDisplaySource?: string;
  chapterDisplaySource?: string;
  fieldSelections?: Record<string, unknown>;
  /** Optional local path to the manga folder (from scan results) */
  localPath?: string;
}

export interface ImportCallbacks {
  setIsImporting: (importing: boolean) => void;
  setImportProgress: (progress: number) => void;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}
