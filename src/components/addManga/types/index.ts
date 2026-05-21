/**
 * Unified Types for Add Manga Workflow
 * 
 * This file contains all type definitions for the Add Manga workflow,
 * providing a single source of truth for component types.
 */

import type { MangaMetadata as BaseMangaMetadata, MangaSearchResult } from '@/types/search.types';

import type { MangaPublicationStatus } from '@prisma/client';

// ============================================
// Base Types
// ============================================

export { type ID } from '@/types/common';
export type FieldType = 'text' | 'textarea' | 'number' | 'select' | 'multiselect' | 'date' | 'boolean';
export type MetadataQuality = 'excellent' | 'good' | 'fair' | 'poor';

// ============================================
// Metadata Types
// ============================================

// Re-export the unified MangaMetadata type
export type MangaMetadata = BaseMangaMetadata;

// ============================================
// Search Result Types
// ============================================

// Re-export from search.types to avoid duplication
export type { MangaSearchResult } from '@/types/search.types';

// ============================================
// Field Selection Types
// ============================================

export interface FieldOption {
  value: unknown;
  label: string;
  source: string;
  confidence?: number;
  description?: string;
  disabled?: boolean;
}

export interface FieldSelection {
  source: string;
  value: unknown;
  confidence?: number;
  lastUpdated?: string;
}

export type FieldSelections = Record<string, FieldSelection>;

export interface FieldConfidence {
  score: number;
  hasValue: boolean;
  hasMultipleSources: boolean;
  sourceCount: number;
  sources: string[];
}

export type FieldValue = string | string[] | number | Date | boolean | null;

// ============================================
// Volume & Chapter Types
// ============================================

export interface VolumeData {
  id: string;
  volumeNumber: number;
  title?: string;
  coverUrl?: string;
  isbn?: string;
  releaseDate?: string;
  chapterCount?: number;
  startChapter?: number;
  endChapter?: number;
  provider: string;
}

export interface ChapterData {
  id: string;
  chapterNumber: number;
  volumeNumber?: number;
  title?: string;
  coverUrl?: string;
  coverImage?: string;  // For preview image
  releaseDate?: string;
  pageCount?: number;
  pages?: number;  // Alternative page count field
  provider: string;
  downloadUrl?: string;
  summary?: string;  // Chapter summary for preview
  arc?: string;  // Story arc name
  url?: string;  // Link to chapter details
}

export interface ParsedVolumeData {
  volumes: number;
  chapters: number;
  volumeDetails?: VolumeData[];
  chapterDetails?: ChapterData[];
  provider: string;
  parseDate: string;
}

// ============================================
// Form Types
// ============================================

export interface AddMangaFormValues {
  // Search
  query: string;
  
  // Selected Manga
  mangaId: string;
  mangaTitle: string;
  source: string;
  
  // Library
  libraryId: number;
  
  // Metadata
  metadata?: Partial<MangaMetadata>;
  fieldSelections?: FieldSelections;
  parsedVolumeData?: ParsedVolumeData;
  
  // Download Configuration
  downloadPath?: string;
  autoDownload?: boolean;
  downloadQuality?: 'high' | 'medium' | 'low';
  startChapter?: number;
  endChapter?: number;
  
  // Monitoring
  monitoringInterval?: 'never' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'custom';
  customInterval?: string;
  
  // Provider Metadata
  providerMetadata?: Record<string, unknown>;
  additionalUrls?: string[];
}

// ============================================
// Provider Types
// ============================================

// Re-export from canonical types to avoid duplication
export type { ProviderSearchResult } from '@/types/search.types';

export interface ProviderEnhancement {
  provider: string;
  url: string;
  data: Partial<MangaMetadata>;
  confidence: number;
  enhancedAt: string;
}

// ============================================
// Constants
// ============================================

export const PROVIDER_COLORS: Record<string, string> = {
  anilist: 'blue',
  comicvine: 'green',
  fandom: 'violet',
  wikipedia: 'cyan',
  prowlarr: 'violet',
  default: 'gray'
} as const;

export const CONFIDENCE_THRESHOLDS = {
  excellent: 80,
  good: 60,
  fair: 40,
  poor: 0
} as const;

// ============================================
// Type Guards
// ============================================

export function isMangaSearchResult(value: unknown): value is MangaSearchResult {
  if (!value || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  
  return (
    typeof obj["id"] === 'string' &&
    typeof obj["title"] === 'string' &&
    typeof obj["source"] === 'string' &&
    typeof obj["provider"] === 'string'
  );
}

export function isValidMangaStatus(value: unknown): value is MangaPublicationStatus {
  return typeof value === 'string' && 
    ['ONGOING', 'COMPLETED', 'HIATUS', 'CANCELLED', 'NOT_YET_PUBLISHED', 'UNKNOWN'].includes(value);
}

export function isValidDate(value: unknown): boolean {
  if (!value) return false;
  if (typeof value === 'string') {
    return !isNaN(Date.parse(value));
  }
  if (value instanceof Date) {
    return !isNaN(value.getTime());
  }
  if (typeof value === 'object' && 'year' in value) {
    return true;
  }
  return false;
}

// ============================================
// Utility Types
// ============================================

export type DeepPartial<T> = T extends Record<string, unknown> ? {
  [P in keyof T]?: DeepPartial<T[P]>;
} : T;

export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

export type ValueOf<T> = T[keyof T];