/**
 * Add Manga State - Metadata Aggregation Hooks
 *
 * Contains useMetadataAggregation hook for intelligent field-level provider selection.
 *
 * @module components/addManga/state/hooks/metadata-hooks
 */

import { useCallback } from 'react';

import { useFieldProviderPreferences } from '@/hooks/useFieldProviderPreferences';
import { getFieldConfidence } from '@/lib/confidence';
import { DEFAULT_FIELD_PRIORITIES } from '@/types/search-types/configuration.types';

import type { Selectors } from '../types';

// ============================================================================
// Constants
// ============================================================================

const METADATA_FIELDS = [
  'title', 'description', 'cover', 'status', 'genres', 'tags',
  'authors', 'artists', 'startDate', 'endDate', 'chapters', 'volumes',
  'alternativeTitles', 'anilistId', 'myAnimeListId'
];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get provider priority for a specific field from user preferences
 */
function getFieldProviderPriority(field: string, preferences: Record<string, string> | undefined): string[] {
  const userPrefs = preferences?.[field];
  if (userPrefs && Array.isArray(userPrefs) && userPrefs.length > 0) {
    return userPrefs as unknown as string[];
  }
  const defaultPrefs = DEFAULT_FIELD_PRIORITIES[field];
  if (defaultPrefs && defaultPrefs.length > 0) {
    return defaultPrefs;
  }
  return DEFAULT_FIELD_PRIORITIES['description'] ?? ['anilist', 'mangadex', 'comicvine', 'fandom', 'wikipedia'];
}

/**
 * Check if a value is empty/missing
 */
function isEmptyValue(value: unknown): boolean {
  if (value === null || value === undefined || value === '') return true;
  if (Array.isArray(value) && value.length === 0) return true;
  return false;
}

/**
 * Find best value for a field across providers
 */
function findBestFieldValue(
  field: string,
  sources: Record<string, unknown>,
  providerPriority: string[],
  calcConfidence: (f: string, v: unknown, p: string) => number
): { value: unknown; source: string; confidence: number } | null {
  let bestValue: unknown = null;
  let bestSource: string | null = null;
  let bestConfidence = 0;

  for (const provider of providerPriority) {
    const providerData = sources[provider];
    if (!providerData || typeof providerData !== 'object' || !(field in providerData)) continue;
    const value = (providerData as Record<string, unknown>)[field];
    const confidence = calcConfidence(field, value, provider);
    if (confidence > bestConfidence) {
      bestValue = value;
      bestSource = provider;
      bestConfidence = confidence;
    }
  }
  return bestConfidence > 0 && bestSource ? { value: bestValue, source: bestSource, confidence: bestConfidence } : null;
}

interface FieldData {
  value: unknown;
  source: string;
  confidence: number;
}

/**
 * Process a single field entry from aggregated data
 */
function processFieldEntry(field: string, fieldData: unknown): FieldData | null {
  if (!fieldData || typeof fieldData !== 'object') return null;
  if (!('value' in fieldData) || !('source' in fieldData) || !('confidence' in fieldData)) return null;
  return fieldData as FieldData;
}

/**
 * Extract field provenance from aggregated metadata
 */
function extractFieldProvenance(aggregated: Record<string, unknown>): {
  selectedMetadata: Record<string, unknown>;
  fieldProvenance: Record<string, { provider: string; confidence: number }>;
  totalConfidence: number;
  fieldCount: number;
} {
  const selectedMetadata: Record<string, unknown> = {};
  const fieldProvenance: Record<string, { provider: string; confidence: number }> = {};
  let totalConfidence = 0;
  let fieldCount = 0;

  for (const [field, fieldData] of Object.entries(aggregated)) {
    const typedData = processFieldEntry(field, fieldData);
    if (!typedData) continue;

    selectedMetadata[field] = typedData.value;
    fieldProvenance[field] = { provider: typedData.source, confidence: typedData.confidence };
    totalConfidence += typedData.confidence;
    fieldCount++;
  }

  return { selectedMetadata, fieldProvenance, totalConfidence, fieldCount };
}

/**
 * Aggregate metadata across selected sources using the local priority/confidence
 * scorer. (Previously fanned out to a server-side merger that ignored its result
 * and was removed during Phase 1 legacy retirement.)
 */
function performIntelligentAggregation(
  aggregateMetadata: () => Record<string, unknown>,
  fallbackConfidence: number
): {
  selectedMetadata: Record<string, unknown>;
  fieldProvenance: Record<string, { provider: string; confidence: number }>;
  overallConfidence: number;
} {
  const aggregated = aggregateMetadata();
  const { selectedMetadata, fieldProvenance, totalConfidence, fieldCount } = extractFieldProvenance(aggregated);
  const overallConfidence = fieldCount > 0 ? Math.round(totalConfidence / fieldCount) : fallbackConfidence;

  return { selectedMetadata, fieldProvenance, overallConfidence };
}

// ============================================================================
// Metadata Aggregation Hook
// ============================================================================

/**
 * Hook for managing metadata aggregation with intelligent field-level provider selection
 */
export function useMetadataAggregation(selectors: Selectors): {
  aggregateMetadata: () => Record<string, unknown>;
  calculateFieldConfidence: (field: string, value: unknown, provider: string) => number;
  aggregateMetadataIntelligently: () => {
    selectedMetadata: Record<string, unknown>;
    fieldProvenance: Record<string, { provider: string; confidence: number }>;
    overallConfidence: number;
  };
} {
  const { preferences } = useFieldProviderPreferences();

  const calculateFieldConfidence = useCallback((field: string, value: unknown, provider: string): number => {
    if (isEmptyValue(value)) return 0;
    return getFieldConfidence(field, value, provider);
  }, []);

  const aggregateMetadata = useCallback(() => {
    const sources = selectors.getAllSelectedSources();
    const aggregated: Record<string, unknown> = {};

    for (const field of METADATA_FIELDS) {
      const providerPriority = getFieldProviderPriority(field, preferences);
      const best = findBestFieldValue(field, sources, providerPriority, calculateFieldConfidence);
      if (best) aggregated[field] = best;
    }
    return aggregated;
  }, [selectors, calculateFieldConfidence, preferences]);

  const aggregateMetadataIntelligently = useCallback(() => {
    const sources = selectors.getAllSelectedSources();
    if (Object.keys(sources).length === 0) {
      return { selectedMetadata: {}, fieldProvenance: {}, overallConfidence: 0 };
    }
    return performIntelligentAggregation(aggregateMetadata, selectors.getOverallConfidence());
  }, [selectors, aggregateMetadata]);

  return { aggregateMetadata, calculateFieldConfidence, aggregateMetadataIntelligently };
}
