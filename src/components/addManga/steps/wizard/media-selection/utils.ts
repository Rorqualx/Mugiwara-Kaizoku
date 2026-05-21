/**
 * Media Selection Step - Utilities Module
 *
 * Shared helper functions, type definitions, and interfaces
 * used across all media-selection modules.
 *
 * Extracted from: MediaSelectionStep.tsx (lines 32-100)
 */

import * as React from 'react';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Type guard to check if value is a record object
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Safely extract a string property from an unknown object
 * @param obj - The object to extract from
 * @param key - The property key to extract
 * @returns The string value if found and is a string, otherwise undefined
 */
export function getStringProp(obj: unknown, key: string): string | undefined {
  if (!isRecord(obj)) return undefined;
  const value = obj[key];
  return typeof value === 'string' ? value : undefined;
}

/**
 * Safely extract a number property from an unknown object
 * @param obj - The object to extract from
 * @param key - The property key to extract
 * @returns The number value if found and is a number, otherwise undefined
 */
export function getNumberProp(obj: unknown, key: string): number | undefined {
  if (!isRecord(obj)) return undefined;
  const value = obj[key];
  return typeof value === 'number' ? value : undefined;
}

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Logger interface for consistent logging across media selection modules
 */
export interface Logger {
  info: (message: string, ...args: unknown[]) => void;
  error: (message: string, ...args: unknown[]) => void;
  warn: (message: string, ...args: unknown[]) => void;
  debug: (message: string, ...args: unknown[]) => void;
}

/**
 * Media gallery structure containing all image collections
 */
export interface MediaGallery {
  covers: string[];
  coversWithProviders?: Array<{ url: string; provider: string }>;
  banners: string[];
  gallery: string[];
  volumeCovers: string[];
  chapterCovers: string[];
}

/**
 * Props for the MediaSelectionStep component
 */
export interface MediaSelectionStepProps {
  // Media gallery data
  mediaGallery: MediaGallery;
  setMediaGallery: React.Dispatch<React.SetStateAction<MediaGallery>>;

  // Selected media
  selectedCover: string;
  setSelectedCover: (cover: string) => void;
  selectedBanner: string;
  setSelectedBanner: (banner: string) => void;
  selectedVolumes: (number | string)[];
  setSelectedVolumes: React.Dispatch<React.SetStateAction<(number | string)[]>>;
  selectedChapters: unknown[];
  setSelectedChapters: React.Dispatch<React.SetStateAction<unknown[]>>;
  selectedGalleryImages: string[];
  setSelectedGalleryImages: React.Dispatch<React.SetStateAction<string[]>>;

  // Volume/chapter data
  volumesData: unknown;
  displayVolumes: unknown[];
  allChapterUrls: unknown[];
  chapterMetadataCache: Map<string, unknown>;

  // Provider info
  provider: string;
  volumeDisplaySource: string;
  chapterDisplaySource: string;
  volumeCoversByProvider: Record<string, string[]>;

  // Metadata
  selectedMetadata: unknown;
  validatedInitialData: unknown;

  // Logger
  logger: Logger;
}
