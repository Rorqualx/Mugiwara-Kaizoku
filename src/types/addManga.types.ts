/**
 * Type definitions for Add Manga components
 */

// Import canonical types
import type { ProviderSearchResult as CanonicalProviderResult } from '../types/search.types';

// Re-export search types
export type { MangaSearchResult } from '../types/search.types';

export interface FormData {
  title: string;
  source: string;
  sourceId: string;
  coverUrl?: string;
  description?: string;
  genres?: string[];
  authors?: string[];
  alternativeTitles?: string[];
  [key: string]: unknown;
}

// Use canonical ProviderSearchResult
export type ProviderResult = CanonicalProviderResult;

export interface MetadataField {
  name: string;
  value: unknown;
  source: string;
  confidence?: number;
}

export interface FieldSelection {
  field: string;
  source: string;
  value: unknown;
}