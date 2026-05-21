/**
 * useVolumeDataExtraction Hook - Orchestrator
 *
 * Coordinates all volume data extraction hooks with priority waterfall logic.
 * This is the primary hook consumed by ResponsiveChapterList to get enriched
 * volume data, titles, and covers from multiple data sources.
 *
 * PRIORITY WATERFALL:
 * 1. Wizard Import Data (highest priority) - Selected provider from import wizard
 * 2. Raw Provider Data (fallback) - Pre-processed volume data from rawProviderData
 * 3. Release Date Merger - Merges fresh database release dates into volume data
 * 4. Provider Metadata (lowest priority) - Fallback extraction from metadata fields
 *
 * Data Flow:
 * ```
 * ┌────────────────────────┐
 * │ Wizard Import Data     │ Priority 1
 * └────────┬───────────────┘
 *          │ If empty ↓
 * ┌────────────────────────┐
 * │ Raw Provider Data      │ Priority 2
 * └────────┬───────────────┘
 *          │ Merge ↓
 * ┌────────────────────────┐
 * │ Release Date Merger    │ Priority 3
 * └────────┬───────────────┘
 *          │ If null ↓
 * ┌────────────────────────┐
 * │ Provider Metadata      │ Priority 4
 * └────────────────────────┘
 * ```
 *
 * Created: 2025-11-17
 * Agent: 7 (Hooks Extraction Phase)
 */

import type { MangaWithRelations } from '@/types/search-types/core-search.types';

import { useProviderMetadata } from './useProviderMetadata';
import { useRawProviderData } from './useRawProviderData';
import { useReleaseDateMerger } from './useReleaseDateMerger';
import { useWizardImportData } from './useWizardImportData';

import type { EnrichedVolume } from '../types';

// ============================================================================
// Types
// ============================================================================

/**
 * Combined result of all volume data extraction operations
 *
 * This interface aggregates data from all four extraction hooks
 * (wizard import, raw provider, release dates, provider metadata)
 * into a single result object for the component to consume.
 */
export interface VolumeDataExtractionResult {
  /** Enriched volume array with embedded chapters and release dates (null if no data) */
  enrichedVolumeData: EnrichedVolume[] | null;
  /** Volume number -> title lookup map (merged from all sources) */
  volumeTitles: Record<number, string>;
  /** Volume number -> cover URL lookup map (merged from all sources) */
  volumeCovers: Record<number, string>;
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Orchestrates volume data extraction with priority waterfall logic
 *
 * This hook coordinates all four extraction hooks in priority order:
 *
 * 1. **useWizardImportData** (Priority 1):
 *    - Extracts data from the selected provider in import wizard
 *    - Highest priority - if data exists, use it
 *
 * 2. **useRawProviderData** (Priority 2):
 *    - Fallback to rawProviderData.volumes if wizard data is empty
 *    - Only runs if wizard data returned null
 *
 * 3. **useReleaseDateMerger** (Priority 3):
 *    - Merges fresh release dates from database chapters
 *    - Operates on enrichedVolumeData from Priority 1 or 2
 *
 * 4. **useProviderMetadata** (Priority 4):
 *    - Lowest priority fallback extraction from metadata fields
 *    - Only runs if enrichedVolumeData is still null after Priority 3
 *
 * The hook merges all extracted data (titles, covers) from all sources
 * using spread operators, with higher priority sources taking precedence.
 *
 * @param manga - Manga record with relations (Chapter, providerMetadata, rawProviderData)
 * @returns VolumeDataExtractionResult with enriched data, titles, and covers
 *
 * @example
 * ```tsx
 * function ResponsiveChapterList({ manga }: Props) {
 *   const { enrichedVolumeData, volumeTitles, volumeCovers } =
 *     useVolumeDataExtraction(manga);
 *
 *   // Use the extracted data to render chapters...
 * }
 * ```
 */
export function useVolumeDataExtraction(
  manga: MangaWithRelations
): VolumeDataExtractionResult {
  // ========================================================================
  // PRIORITY 1: Wizard Import Data
  // ========================================================================
  // Extract data from the selected provider in the import wizard.
  // This is the highest priority source as it represents the user's
  // explicit choice of which provider to use for chapter data.
  const wizardData = useWizardImportData(manga.providerMetadata);
  const hasWizardData = wizardData.enrichedVolumeData !== null;

  // ========================================================================
  // PRIORITY 2: Raw Provider Data
  // ========================================================================
  // Fallback to rawProviderData.volumes if wizard data is empty.
  // Only extract if wizard data is unavailable (performance optimization).
  const rawData = useRawProviderData(manga.rawProviderData, !hasWizardData);

  // ========================================================================
  // PRIORITY 3: Release Date Merger
  // ========================================================================
  // Merge fresh release dates from database chapters into the enriched
  // volume data (from either wizard or raw provider data).
  // This ensures the UI shows the most recent release dates after
  // metadata refreshes.
  const mergedData = useReleaseDateMerger(
    wizardData.enrichedVolumeData ?? rawData.enrichedVolumeData,
    manga.Chapter
  );

  // ========================================================================
  // PRIORITY 4: Provider Metadata
  // ========================================================================
  // Lowest priority fallback extraction from provider metadata fields.
  // Only runs if we still don't have enriched volume data after Priority 3.
  // This extracts volume titles from various metadata structures as a
  // last resort to show *something* to the user.
  const metadataData = useProviderMetadata(
    manga.providerMetadata,
    manga.selectedSourceId,
    mergedData === null
  );

  // ========================================================================
  // MERGE RESULTS
  // ========================================================================
  // Combine all extracted data from all sources.
  // Higher priority sources are merged first, so they take precedence
  // when multiple sources provide the same volume number.
  return {
    // Enriched volume data comes from Priority 3 (release date merger)
    // which operates on Priority 1 or Priority 2 data
    enrichedVolumeData: mergedData,

    // Volume titles: Merge from all sources (metadata first, then raw, then wizard)
    // Later sources override earlier ones (wizard has highest priority)
    volumeTitles: {
      ...metadataData.volumeTitles, // Priority 4 (lowest)
      ...rawData.volumeTitles,       // Priority 2
      ...wizardData.volumeTitles,    // Priority 1 (highest)
    },

    // Volume covers: Merge from raw and wizard sources only
    // (metadata extraction doesn't provide covers)
    volumeCovers: {
      ...rawData.volumeCovers,     // Priority 2
      ...wizardData.volumeCovers,  // Priority 1 (highest)
    },
  };
}
