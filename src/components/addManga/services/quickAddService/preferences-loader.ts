/**
 * Quick Add Service - Preferences Loader
 *
 * Handles loading field provider preferences from settings via tRPC.
 * Provides functions for checking quick-add availability.
 * Filters out disabled providers from preferences.
 *
 * @module components/addManga/services/quickAddService/preferences-loader
 */

import type { AppRouter } from '@/server/trpc/root';
import { DEFAULT_FIELD_PRIORITIES, METADATA_FIELDS } from '@/types/search.types';
import { logger } from '@/utils/logger';

import type { FieldProviderPreferences, VolumeFieldSources } from './types';
import type { TRPCClient } from '@trpc/client';

// ============================================================================
// Types
// ============================================================================

/** Provider status from search.getProviders */
interface ProviderStatusInfo {
  id: string;
  name: string;
  status: string;
}

// ============================================================================
// Constants
// ============================================================================

/** Minimum fields required for quick-add to be available */
const MIN_FIELDS_REQUIRED = 5;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get default preferences for all metadata fields
 */
function getDefaultPreferences(): Record<string, string[]> {
  const defaults: Record<string, string[]> = {};
  METADATA_FIELDS.forEach((field) => {
    const priorityList = DEFAULT_FIELD_PRIORITIES[field.value];
    if (priorityList && priorityList.length > 0) {
      defaults[field.value] = [...priorityList];
    }
  });
  return defaults;
}

/**
 * Filter out disabled providers from preferences
 */
function filterDisabledProviders(
  preferences: Record<string, string[]>,
  enabledProviders: Set<string>
): Record<string, string[]> {
  const filtered: Record<string, string[]> = {};
  Object.entries(preferences).forEach(([field, providers]) => {
    filtered[field] = providers.filter(p => enabledProviders.has(p));
  });
  return filtered;
}

/**
 * Get set of enabled provider IDs from provider status list
 */
function getEnabledProviderSet(providerStatuses: ProviderStatusInfo[]): Set<string> {
  const enabled = new Set<string>();
  providerStatuses.forEach(provider => {
    if (provider.status === 'active') {
      enabled.add(provider.id);
    }
  });
  return enabled;
}

// ============================================================================
// Preferences Loading
// ============================================================================

/**
 * Load field provider preferences.
 * Uses permanent hardcoded defaults with 'confidence' fallback mode.
 * Filters out disabled providers based on metadata settings.
 *
 * @param trpcClient - tRPC client instance (used to check enabled providers)
 * @returns Field provider preferences with only active providers
 */
export async function loadPreferences(
  trpcClient: TRPCClient<AppRouter>
): Promise<FieldProviderPreferences> {
  try {
    // Use hardcoded defaults — no longer fetched from settings
    let preferences = getDefaultPreferences();

    // Filter out disabled providers
    const providerStatusResult = await trpcClient.search.getProviders.query();
    const enabledProviders = getEnabledProviderSet(providerStatusResult as ProviderStatusInfo[]);
    preferences = filterDisabledProviders(preferences, enabledProviders);

    return { enabled: true, preferences, autoMatchEnabled: true, fallbackMode: 'confidence' };
  } catch (error) {
    logger.error('[preferences-loader] Failed to load preferences', error);
    return { enabled: true, preferences: getDefaultPreferences(), autoMatchEnabled: true, fallbackMode: 'confidence' };
  }
}

// ============================================================================
// Availability Check
// ============================================================================

/**
 * Check if quick-add is available for user
 * Quick Add is always enabled, so this just checks if preferences are loaded
 *
 * @param trpcClient - tRPC client instance
 * @param _checkPreferencesEnabled - Deprecated, kept for API compatibility
 * @returns Promise resolving to true (quick-add is always available)
 */
export async function isQuickAddAvailable(
  trpcClient: TRPCClient<AppRouter>,
  _checkPreferencesEnabled: boolean = true
): Promise<boolean> {
  try {
    const preferences = await loadPreferences(trpcClient);
    const fieldCount = Object.keys(preferences.preferences).length;

    logger.debug('[preferences-loader] Quick-add availability check', {
      fieldCount,
      isAvailable: true
    });

    // Quick Add is always available as long as we have some preferences
    return fieldCount >= MIN_FIELDS_REQUIRED;
  } catch (error) {
    logger.error('[preferences-loader] Failed to check quick-add availability', error);
    // Still return true since Quick Add is always enabled - will use defaults
    return true;
  }
}

// ============================================================================
// Volume Field Sources
// ============================================================================

/**
 * Build VolumeFieldSources from preferences
 *
 * Maps the 6 field-level selections for volume and chapter data:
 * - volumeCover, volumeSummary, volumeTitle from 'volumeCover', 'volumeSummary', 'volumeTitle' prefs
 * - chapterCover, chapterSummary, chapterTitle from 'chapterCover', 'chapterSummary', 'chapterTitle' prefs
 *
 * Falls back to 'volumes' preference for volume fields and 'chapters' preference for chapter fields
 *
 * @param preferences - User's field provider preferences
 * @returns VolumeFieldSources object with all 6 field-level selections
 */
export function buildVolumeFieldSources(preferences: Record<string, string[]>): VolumeFieldSources {
  // Helper to get first provider from preference list, or fallback
  const getProvider = (fieldName: string, fallbackField: string, defaultProvider: string): string => {
    const fieldPref = preferences[fieldName]?.[0];
    if (fieldPref) return fieldPref;

    const fallbackPref = preferences[fallbackField]?.[0];
    if (fallbackPref) return fallbackPref;

    return defaultProvider;
  };

  // Default providers for volume and chapter data
  const defaultVolumeProvider = 'comicvine';
  const defaultChapterProvider = 'fandom';

  return {
    // Volume field sources - check specific field prefs, fall back to 'volumes' pref
    volumeCover: getProvider('volumeCover', 'volumes', defaultVolumeProvider),
    volumeSummary: getProvider('volumeSummary', 'volumes', defaultVolumeProvider),
    volumeTitle: getProvider('volumeTitle', 'volumes', defaultVolumeProvider),

    // Chapter field sources - check specific field prefs, fall back to 'chapters' pref
    chapterCover: getProvider('chapterCover', 'chapters', defaultChapterProvider),
    chapterSummary: getProvider('chapterSummary', 'chapters', defaultChapterProvider),
    chapterTitle: getProvider('chapterTitle', 'chapters', defaultChapterProvider),
  };
}
