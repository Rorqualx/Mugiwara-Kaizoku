/**
 * Field Quality Types Module
 *
 * Shared type definitions and interfaces for field quality assessment.
 * Extracted from: field-quality-scorer.ts
 */

import type { UnifiedMangaMetadata } from '@/types/search-types/metadata.types';
import type { ProviderQuality, FieldProviderMapping } from '@/types/search-types/unified-metadata-schema';

// ============================================================================
// Field Quality Assessment Interface
// ============================================================================

export interface FieldQualityAssessment {
  completeness: number; // 0-100: How complete is the data
  accuracy: number; // 0-100: How accurate/trustworthy is the data
  freshness: number; // 0-100: How recent is the data
  structure: number; // 0-100: How well-structured is the data
  overall: number; // 0-100: Combined quality score
}

// Re-export imported types for convenience
export type { ProviderQuality, FieldProviderMapping, UnifiedMangaMetadata };