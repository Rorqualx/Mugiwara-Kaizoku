/**
 * Provider Form Utils - Type Definitions
 *
 * Type definitions and interfaces for provider selection forms.
 * Provides comprehensive type safety for provider metadata operations.
 *
 * Extracted from: providerFormUtils.ts (lines 1-133)
 * Module: Foundation layer (no dependencies on other modules)
 */

// ============================================================================
// Re-exports from Domain Types
// ============================================================================

export type {
  MangaMetadata,
  MangaWithRelations,
} from '@/types/search.types';

// Import for use in Manga interface
import type { MangaMetadata as MangaMetadataType } from '@/types/search.types';

// ============================================================================
// Provider Metadata Structures
// ============================================================================

/**
 * Structure for provider metadata and preferences
 * Ensures compatibility with both object and array formats
 */
export interface ProviderMetadataInfo {
  metadataProvenance?: Record<string, string> | {
    [key: string]: string | undefined;
  };
  preferences?: Record<string, {
    provider: string;
    value: unknown;
  }>;
}

/**
 * Alternative format for provider metadata from array structure
 */
export interface ProviderMetadataItem {
  providerId: string;
  externalId?: string | number;
  metadata: Record<string, unknown>;
}

/**
 * Union type for all valid provider metadata formats
 */
export type ProviderMetadata = ProviderMetadataInfo | ProviderMetadataItem[];

// ============================================================================
// Core Entity Types
// ============================================================================

/**
 * Manga object structure that works with both MangaWithRelations and MangaEntity types
 *
 * This is a normalized interface that can handle manga data from various sources
 * while providing consistent property access patterns.
 */
export interface Manga {
  id: number | string;
  title: string;
  metadata?: Record<string, unknown> | MangaMetadataType;
  providerMetadata?: ProviderMetadata;
  metadataProvenance?: Record<string, string>; // For backward compatibility
  source?: string;
  status?: string | {
    toString(): string;
  };
  libraryId?: number;
  description?: string;
  coverUrl?: string;
  genres?: string[];
  [key: string]: unknown;
}

/**
 * Provider metadata result from API
 */
export interface ProviderMetadataResult {
  id?: string | number;
  title?: string;
  description?: string;
  status?: string;
  alternativeTitles?: string[];
  volumes?: number;
  chapters?: number;
  genres?: string[];
  tags?: Array<string | {
    name: string;
  }>;
  authors?: string[];
  staff?: Array<{
    role: string;
    name: string;
  }>;
  characters?: Array<{
    name: string;
  }>;
  cover?: string;
  coverImage?: string;
  coverLarge?: string;
  coverMedium?: string;
  coverSmall?: string;
  startDate?: string | Date;
  endDate?: string | Date;
  [key: string]: unknown;
}

// ============================================================================
// UI Component Types
// ============================================================================

/**
 * Option for select dropdown components
 */
export interface SelectOption {
  value: string;
  label: string;
  provider: string;
  originalValue: unknown;
}

/**
 * Represents a metadata value option from a specific provider
 */
export interface FieldProviderOption {
  provider: string;
  value: unknown;
  displayValue?: string;
}

/**
 * Data structure for a metadata field with provider options
 */
export interface FieldData {
  fieldName: string;
  displayName: string;
  currentProvider: string;
  options: FieldProviderOption[];
  selectedProvider: string;
  selectOptions: SelectOption[];
  selectedValue: string | null;
}
