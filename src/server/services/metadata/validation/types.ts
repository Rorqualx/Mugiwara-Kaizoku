/**
 * Metadata Validation Types
 *
 * Shared type definitions for metadata validation utilities.
 */

import type { MangaMetadata } from '@/types/search.types';

export type UnifiedMangaMetadata = MangaMetadata;
export type PartialUnifiedMetadata = Partial<UnifiedMangaMetadata>;

export interface MetadataValidationError {
  field: string;
  message: string;
  value?: unknown;
  severity?: 'error' | 'critical' | 'warning';
}

export interface MetadataValidationWarning {
  field: string;
  message: string;
  value?: unknown;
  severity?: 'warning';
  suggestion?: string;
}

export interface ValidationData {
  errors: MetadataValidationError[];
  warnings: MetadataValidationWarning[];
  sanitized?: UnifiedMangaMetadata;
  completeness: number;
  confidence: number;
}
