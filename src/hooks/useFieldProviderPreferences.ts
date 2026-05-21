/**
 * Hook for accessing field provider preferences
 *
 * This hook provides access to the field provider preferences settings
 * and returns both the enabled state and the actual preferences.
 *
 * @module hooks/useFieldProviderPreferences
 */
import { useMemo } from 'react';

import { isSuccess } from '@/utils/async-result';

import { DEFAULT_FIELD_PRIORITIES, FallbackMode } from '../types/search.types';
import { trpc } from '../utils/trpc-client/index';

export interface FieldProviderPreferences {
  /**
   * Whether field provider preferences are enabled
   */
  enabled: boolean;

  /**
   * The actual preferences mapping fields to providers
   */
  preferences: Record<string, string>;

  /**
   * Fallback mode for when primary provider has no data
   * - 'priority': Use the 2nd, 3rd, 4th priority in order
   * - 'confidence': Use whichever remaining provider has highest match confidence
   */
  fallbackMode: FallbackMode;

  /**
   * Get the preferred provider for a specific field
   */
  getPreferredProvider: (field: string) => string | null;

  /**
   * Check if preferences should be applied
   */
  shouldApplyPreferences: () => boolean;

  /**
   * Loading state
   */
  isLoading: boolean;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Build default preferences from DEFAULT_FIELD_PRIORITIES
 * Each field gets its first provider as the default
 */
function buildDefaultPreferences(): Record<string, string> {
  const prefs: Record<string, string> = {};
  for (const field of Object.keys(DEFAULT_FIELD_PRIORITIES)) {
    const providers = DEFAULT_FIELD_PRIORITIES[field];
    const firstProvider = providers?.[0];
    if (firstProvider) {
      prefs[field] = firstProvider;
    }
  }
  return prefs;
}

/**
 * Extract fallback mode from setting, validating it's a valid value
 */
function extractFallbackMode(mode: unknown): FallbackMode {
  if (mode === 'confidence') return 'confidence';
  return 'priority';
}

// ============================================================================
// Main Hook
// ============================================================================

/**
 * Hook to access field provider preferences
 *
 * @returns Field provider preferences and helper functions
 */
export function useFieldProviderPreferences(): FieldProviderPreferences {
  // Get settings using batch endpoint to avoid rate limiting
  const { data: batchSettings, isLoading: batchLoading } = trpc.settings.getBatch.useQuery({
    keys: ['fieldProviderPreferences.enabled', 'fieldProviderPreferences.preferences', 'fieldProviderPreferences.fallbackMode']
  });

  // Extract individual settings from batch result and maintain isSuccess compatibility
  // Wrap in useMemo to prevent re-creation on every render
  const enabledSetting = useMemo(() =>
    batchSettings && isSuccess(batchSettings)
      ? { ...batchSettings, data: (batchSettings.data as Record<string, unknown>)['fieldProviderPreferences.enabled'] ?? false }
      : null
  , [batchSettings]);

  const preferencesSetting = useMemo(() =>
    batchSettings && isSuccess(batchSettings)
      ? { ...batchSettings, data: (batchSettings.data as Record<string, unknown>)['fieldProviderPreferences.preferences'] ?? {} }
      : null
  , [batchSettings]);

  const fallbackModeSetting = useMemo(() =>
    batchSettings && isSuccess(batchSettings)
      ? { ...batchSettings, data: (batchSettings.data as Record<string, unknown>)['fieldProviderPreferences.fallbackMode'] ?? 'priority' }
      : null
  , [batchSettings]);

  // Process enabled state
  const enabled = useMemo(() => {
    if (!enabledSetting || !isSuccess(enabledSetting)) return false;
    return enabledSetting.data as boolean;
  }, [enabledSetting]);

  // Process preferences
  const preferences = useMemo(() => {
    if (!preferencesSetting || !isSuccess(preferencesSetting)) return buildDefaultPreferences();
    const savedPrefs = preferencesSetting.data as Record<string, string>;
    return Object.keys(savedPrefs).length > 0 ? savedPrefs : buildDefaultPreferences();
  }, [preferencesSetting]);

  // Process fallback mode
  const fallbackMode = useMemo(() => {
    if (!fallbackModeSetting || !isSuccess(fallbackModeSetting)) return 'priority' as FallbackMode;
    return extractFallbackMode(fallbackModeSetting.data);
  }, [fallbackModeSetting]);

  // Helper function to get preferred provider for a field
  const getPreferredProvider = (field: string): string | null => {
    if (!enabled) return null;
    return preferences[field] ?? null;
  };

  // Helper function to check if preferences should be applied
  const shouldApplyPreferences = (): boolean => {
    return enabled && Object.keys(preferences).length > 0;
  };

  return {
    enabled,
    preferences,
    fallbackMode,
    getPreferredProvider,
    shouldApplyPreferences,
    isLoading: batchLoading
  };
}

/**
 * Hook to get field options filtered by provider preferences
 *
 * This hook is used in the wizard to filter available options
 * based on the user's provider preferences.
 *
 * @param field - The metadata field name
 * @param availableOptions - All available options for the field
 * @returns Filtered options based on preferences
 */
export function usePreferenceFilteredOptions(
  field: string,
  availableOptions: Array<{ provider: string; value: unknown; confidence?: number }>
): Array<{ provider: string; value: unknown; confidence?: number }> {
  const { enabled, getPreferredProvider } = useFieldProviderPreferences();

  return useMemo(() => {
    // If preferences are disabled, return all options
    if (!enabled) {
      return availableOptions;
    }

    // Get the preferred provider for this field
    const preferredProvider = getPreferredProvider(field);

    // If no preference is set for this field, return all options
    if (!preferredProvider) {
      return availableOptions;
    }

    // Filter options to only include the preferred provider
    const filteredOptions = availableOptions.filter(
      option => option.provider === preferredProvider
    );

    // If the preferred provider has no data, fall back to all options
    if (filteredOptions.length === 0) {
      return availableOptions;
    }

    return filteredOptions;
  }, [field, availableOptions, enabled, getPreferredProvider]);
}

/**
 * Hook to determine if a field should auto-select based on preferences
 *
 * @param field - The metadata field name
 * @returns Whether auto-selection should occur
 */
export function useShouldAutoSelect(field: string): boolean {
  const { enabled, getPreferredProvider } = useFieldProviderPreferences();

  return useMemo(() => {
    if (!enabled) return false;
    const preferredProvider = getPreferredProvider(field);
    return preferredProvider !== null;
  }, [enabled, field, getPreferredProvider]);
}