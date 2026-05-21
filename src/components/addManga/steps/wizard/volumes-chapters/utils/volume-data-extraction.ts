/**
 * Volume Data Extraction Utilities
 *
 * Helper functions for extracting and finding volume data from metadata sources.
 * Handles searching across providers with priority ordering.
 */

import { DEFAULT_FIELD_PRIORITIES } from '@/types/search-types/configuration.types';

// ============================================================================
// Type Guards
// ============================================================================

/** Type guard for records */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Priority order for providers when searching for volume data
 * Derived from DEFAULT_FIELD_PRIORITIES using 'volumes' field
 */
export const PROVIDER_PRIORITY = DEFAULT_FIELD_PRIORITIES['volumes']
  ?? ['comicvine', 'fandom', 'wikipedia', 'anilist'];

// ============================================================================
// Data Extraction Functions
// ============================================================================

/**
 * Get volume data from a specific source
 *
 * @param sourceName - Name of the provider source
 * @param volumeNumber - Volume number to find
 * @param selectedSourcesMetadata - All metadata from selected sources
 * @returns Volume data record or null if not found
 */
export function getVolumeFromSource(
  sourceName: string,
  volumeNumber: number | string,
  selectedSourcesMetadata: Record<string, unknown>
): Record<string, unknown> | null {
  const sourceData = selectedSourcesMetadata[sourceName];
  if (!isRecord(sourceData)) return null;

  // Look for volumeData array
  const volumeData = sourceData['volumeData'];
  if (!Array.isArray(volumeData)) return null;

  // Find volume by number
  const volNum = typeof volumeNumber === 'string' ? parseInt(volumeNumber, 10) : volumeNumber;
  const foundVolume: unknown = (volumeData as unknown[]).find((v: unknown) => {
    if (!isRecord(v)) return false;
    const vNum = v['volumeNumber'] ?? v['number'];
    const vNumParsed = typeof vNum === 'string' ? parseInt(vNum, 10) : vNum;
    return vNumParsed === volNum;
  });

  return isRecord(foundVolume) ? foundVolume : null;
}

/**
 * Extract a string field from volume data
 * Tries multiple field names in order
 *
 * @param volume - Volume data record
 * @param fields - Field names to try in order
 * @returns First found non-empty string value or null
 */
export function getStringField(volume: Record<string, unknown> | null, ...fields: string[]): string | null {
  if (!volume) return null;
  for (const field of fields) {
    const value = volume[field];
    if (typeof value === 'string' && value.length > 0) return value;
  }
  return null;
}

/**
 * Search ONLY selected sources for a field value, returning the first found
 * Used when "primary" source doesn't have the field
 *
 * @param volumeNumber - Volume number to search for
 * @param selectedSourcesMetadata - All metadata from selected sources
 * @param selectedSources - List of user-selected provider names
 * @param fieldNames - Field names to search for in order
 * @returns Object with value and source name, or null if not found
 */
export function findFieldInSelectedSources(
  volumeNumber: number | string,
  selectedSourcesMetadata: Record<string, unknown>,
  selectedSources: string[],
  fieldNames: string[]
): { value: string | null; source: string | null } {
  // Only search sources that are in selectedSources
  const sourcesToSearch = selectedSources.filter(s => s in selectedSourcesMetadata);

  // Sort by priority order (providers in PROVIDER_PRIORITY first)
  sourcesToSearch.sort((a, b) => {
    const priorityA = PROVIDER_PRIORITY.indexOf(a.toLowerCase());
    const priorityB = PROVIDER_PRIORITY.indexOf(b.toLowerCase());
    // If not in priority list, put at end
    const orderA = priorityA === -1 ? 999 : priorityA;
    const orderB = priorityB === -1 ? 999 : priorityB;
    return orderA - orderB;
  });

  for (const providerName of sourcesToSearch) {
    const volume = getVolumeFromSource(providerName, volumeNumber, selectedSourcesMetadata);
    if (volume) {
      const value = getStringField(volume, ...fieldNames);
      if (value) {
        return { value, source: providerName };
      }
    }
  }

  return { value: null, source: null };
}
