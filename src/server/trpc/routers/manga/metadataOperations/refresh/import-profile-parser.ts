/**
 * Import Profile Parser
 *
 * Parses import profile from manga providerMetadata to determine
 * which providers to use for metadata refresh.
 *
 * PHASE 0 of refreshMetaData operation.
 * Extracted from: metadataOperations.ts (lines 395-503)
 */

import { logger } from '@/utils/logger';

import { safeGet, isRecord, handleError } from '../utils';

// ============================================================================
// Types
// ============================================================================

export interface ParsedImportProfile {
  importProfile: unknown;
  selectedProviders: Record<string, string>;
  uniqueProviders: Set<string>;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Parse provider metadata string or object to get import profile
 *
 * @param providerMetadata - Raw provider metadata (string or object)
 * @returns Import profile if found, null otherwise
 */
function extractImportProfile(providerMetadata: unknown): unknown {
  try {
    const providerMeta =
      typeof providerMetadata === 'string'
        ? (JSON.parse(providerMetadata) as unknown)
        : providerMetadata;
    const providerMetaRecord = isRecord(providerMeta) ? providerMeta : {};
    return safeGet(providerMetaRecord, 'importProfile');
  } catch (e: unknown) {
    logger.warn(`Failed to parse providerMetadata: ${handleError(e).message}`);
    return null;
  }
}

/**
 * Extract volume and chapter sources from import profile
 *
 * @param importProfile - Validated import profile record
 * @returns Partial map with volume and chapter sources
 */
function extractVolumeAndChapterSources(
  importProfile: Record<string, unknown>
): Record<string, string> {
  const result: Record<string, string> = {};

  // Add volume source
  const volumeSource = importProfile['volumeSource'];
  if (volumeSource && typeof volumeSource === 'string') {
    result['volumes'] = volumeSource;
  }

  // Add chapter source
  const chapterSource = importProfile['chapterSource'];
  if (chapterSource && typeof chapterSource === 'string') {
    result['chapters'] = chapterSource;
  }

  return result;
}

/**
 * Extract selected fields from import profile
 *
 * @param importProfile - Validated import profile record
 * @returns Map of selected field providers
 */
function extractSelectedFields(
  importProfile: Record<string, unknown>
): Record<string, string> {
  const selectedFields = importProfile['selectedFields'];
  if (!selectedFields || !isRecord(selectedFields)) {
    return {};
  }

  const result: Record<string, string> = {};
  Object.entries(selectedFields).forEach(([field, provider]) => {
    if (provider && typeof provider === 'string') {
      result[field] = provider;
    }
  });

  return result;
}

/**
 * Extract legacy selected sources from import profile
 *
 * @param importProfile - Validated import profile record
 * @returns Map of legacy selected sources
 */
function extractLegacySelectedSources(
  importProfile: Record<string, unknown>
): Record<string, string> {
  const selectedSources = importProfile['selectedSources'];
  if (!selectedSources || !isRecord(selectedSources)) {
    return {};
  }

  // Create a shallow copy of selected sources
  return { ...selectedSources } as Record<string, string>;
}

/**
 * Build selected providers map from import profile
 *
 * @param importProfile - Validated import profile record
 * @returns Map of field names to provider IDs
 */
function buildSelectedProvidersFromProfile(importProfile: Record<string, unknown>): Record<string, string> {
  logger.info('Found stored import profile for refresh:', {
    primarySource: importProfile['primarySource'],
    selectedSources: importProfile['selectedSources'],
    chapterSource: importProfile['chapterSource'],
    volumeSource: importProfile['volumeSource'],
  });

  const volumeChapterSources = extractVolumeAndChapterSources(importProfile);
  const selectedFields = extractSelectedFields(importProfile);
  const legacySources = extractLegacySelectedSources(importProfile);

  const selectedProviders = {
    ...volumeChapterSources,
    ...selectedFields,
    ...legacySources,
  };

  logger.info('Built selectedProviders from import profile:', selectedProviders);
  return selectedProviders;
}

/**
 * Parse selected source ID as fallback when no import profile exists
 *
 * @param selectedSourceId - Selected source ID (may be JSON or plain string)
 * @returns Map of providers or empty object
 */
function parseSelectedSourceIdFallback(selectedSourceId: string): Record<string, string> {
  try {
    return JSON.parse(selectedSourceId) as Record<string, string>;
  } catch (_e: unknown) {
    // If it's not valid JSON, treat it as a single provider ID
    return {
      default: selectedSourceId,
    };
  }
}

/**
 * Collect all unique providers from import profile
 *
 * Extracts provider IDs from primarySource, volumeSource, chapterSource,
 * and selectedFields to ensure all providers used during import are re-scraped.
 *
 * @param importProfile - Validated import profile record
 * @param uniqueProviders - Set to populate with provider IDs
 */
function collectProvidersFromProfile(
  importProfile: Record<string, unknown>,
  uniqueProviders: Set<string>
): void {
  const primarySource = importProfile['primarySource'];
  const volumeSource = importProfile['volumeSource'];
  const chapterSource = importProfile['chapterSource'];

  if (primarySource && typeof primarySource === 'string') {
    uniqueProviders.add(primarySource.toLowerCase());
  }
  if (volumeSource && typeof volumeSource === 'string') {
    uniqueProviders.add(volumeSource.toLowerCase());
  }
  if (chapterSource && typeof chapterSource === 'string') {
    uniqueProviders.add(chapterSource.toLowerCase());
  }

  // Also check selectedFields for any other providers
  const selectedFields = importProfile['selectedFields'];
  if (!selectedFields || !isRecord(selectedFields)) {
    return;
  }

  Object.values(selectedFields).forEach((provider) => {
    if (provider && typeof provider === 'string') {
      uniqueProviders.add(provider.toLowerCase());
    }
  });
}

// ============================================================================
// Bound Provider Detection
// ============================================================================

/** Known provider names for binding detection */
const KNOWN_PROVIDER_NAMES = new Set([
  'comicvine', 'fandom', 'anilist', 'mangadex', 'wikipedia',
]);

/**
 * Extract bound provider names from providerMetadata entries.
 *
 * UI-bound manga have entries like `{ comicvine: { providerId: "4050-49866", boundAt: "..." } }`.
 * This function detects those entries and returns provider names and field mappings.
 */
function extractBoundProviders(
  providerMetadata: unknown,
  existingSelectedProviders: Record<string, string>
): { providers: string[]; fieldMappings: Record<string, string> } {
  const providers: string[] = [];
  const fieldMappings: Record<string, string> = {};

  const parsed: unknown = typeof providerMetadata === 'string'
    ? (() => { try { return JSON.parse(providerMetadata as string) as unknown; } catch { return null; } })()
    : providerMetadata;

  if (!isRecord(parsed)) return { providers, fieldMappings };

  for (const [key, value] of Object.entries(parsed)) {
    const normalizedKey = key.toLowerCase();
    if (!KNOWN_PROVIDER_NAMES.has(normalizedKey)) continue;
    if (!isRecord(value)) continue;

    const providerId = value['providerId'];
    if (typeof providerId !== 'string' || !providerId) continue;

    // This is a bound provider entry
    providers.push(normalizedKey);
    logger.info(`[import-profile-parser] Detected bound provider: ${normalizedKey} (ID: ${providerId})`);

    // Map bound providers to appropriate field roles
    if (normalizedKey === 'comicvine' && !existingSelectedProviders['volumes']) {
      fieldMappings['volumes'] = 'comicvine';
    }
    if (normalizedKey === 'fandom' && !existingSelectedProviders['chapters']) {
      fieldMappings['chapters'] = 'fandom';
    }
  }

  return { providers, fieldMappings };
}

// ============================================================================
// Main Functions
// ============================================================================

/**
 * Parse import profile from manga provider metadata
 *
 * @param providerMetadata - Raw provider metadata from manga
 * @param selectedSourceId - Fallback selected source ID
 * @param searchProvider - Fallback search provider
 * @returns Parsed import profile with selected providers
 */
export function parseImportProfile(
  providerMetadata: unknown,
  selectedSourceId: string | null,
  searchProvider: string | null
): ParsedImportProfile {
  let importProfile: unknown = null;
  let selectedProviders: Record<string, string> = {};

  // Parse provider metadata to get import profile
  if (providerMetadata) {
    importProfile = extractImportProfile(providerMetadata);

    if (importProfile && isRecord(importProfile)) {
      selectedProviders = buildSelectedProvidersFromProfile(importProfile);
    }
  }

  // Fall back to selectedSourceId if no import profile
  if (!importProfile && selectedSourceId) {
    selectedProviders = parseSelectedSourceIdFallback(selectedSourceId);
  }

  // Get unique providers that were actually selected
  const uniqueProviders = new Set(Object.values(selectedProviders));

  // IMPORTANT: Also collect ALL providers from import profile
  // This ensures we re-scrape ALL providers that were used during wizard import
  if (importProfile && isRecord(importProfile)) {
    collectProvidersFromProfile(importProfile, uniqueProviders);
  }

  // Detect bound providers from providerMetadata entries (UI binding flow)
  // This ensures Phase 2/3 run for manga bound via UI without a wizard import profile
  if (providerMetadata) {
    const bound = extractBoundProviders(providerMetadata, selectedProviders);
    for (const provider of bound.providers) {
      uniqueProviders.add(provider);
    }
    Object.assign(selectedProviders, bound.fieldMappings);
  }

  // If no providers were selected, fall back to the search provider
  if (uniqueProviders.size === 0 && searchProvider) {
    uniqueProviders.add(searchProvider);
  }

  return {
    importProfile,
    selectedProviders,
    uniqueProviders,
  };
}
