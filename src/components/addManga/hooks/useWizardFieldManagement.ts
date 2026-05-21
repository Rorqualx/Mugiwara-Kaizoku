import { useState, useCallback, useMemo } from 'react';

import { useFieldProviderPreferences } from '@/hooks/useFieldProviderPreferences';
import type { ProviderMetadata,
  ProviderOption,
  FieldOptions
} from '@/types/universalImportWizard.types';

import { normalizeStatus } from '../utils/wizard/dataTransformers';

/**
 * Return type for useWizardFieldManagement hook
 */
export interface UseWizardFieldManagementReturn {
  descriptionEditMode: Record<string, boolean>;
  setDescriptionEditMode: (mode: Record<string, boolean>) => void;
  toggleEditMode: (fieldName: string) => void;
  getFieldOptions: (fieldName: string) => ProviderOption[];
  selectBestOption: (options: ProviderOption[], fieldName?: string) => string;
  extractActualValue: (optionValue: string) => string;
  fieldOptions: FieldOptions;
}

/**
 * Custom hook for managing wizard field options and selections
 */
export const useWizardFieldManagement = (
  selectedSourcesMetadata: Record<string, ProviderMetadata>,
  provider: string
): UseWizardFieldManagementReturn => {
  const [descriptionEditMode, setDescriptionEditMode] = useState<Record<string, boolean>>({
    description: false,
    synopsis: false,
    volumeInfo: false
  });

  // Get provider preferences
  const { enabled: preferencesEnabled, getPreferredProvider } = useFieldProviderPreferences();

  /**
   * Get field options from all sources (show all provider data)
   */
  const getFieldOptions = useCallback((fieldName: string): ProviderOption[] => {
    const options: ProviderOption[] = [];
    const seenKeys = new Set<string>(); // Track unique option keys to prevent duplicates

    // Check if preferences are enabled and a preferred provider is set
    const preferredProvider = preferencesEnabled ? getPreferredProvider(fieldName) : null;

    // If preferences are enabled and a preferred provider is set, add it first with higher priority
    if (preferredProvider) {
      const preferredData = selectedSourcesMetadata[preferredProvider];
      if (preferredData) {
        const preferredDataRecord = preferredData as Record<string, unknown>;
        const value = preferredDataRecord[fieldName];
        // Check for non-null/undefined values (including 0, empty arrays, etc)
        if (value !== null) {
          // Skip empty arrays for cleaner UI
          if (Array.isArray(value) && value.length === 0) {
            // Skip empty arrays
          } else {
            const optionValue = Array.isArray(value) ? value : [value];
            optionValue.forEach((v: unknown) => {
              // Only add non-empty values
              if (v !== null && v !== '') {
                const normalizedValue = typeof v === 'string' ? v : String(v);
                // Create unique key for this option
                const optionKey = `${normalizedValue}::${preferredProvider}`;
                if (!seenKeys.has(optionKey)) {
                  seenKeys.add(optionKey);
                  options.push({
                    value: optionKey,
                    label: `[${preferredProvider}] ${normalizedValue} ✓ Preferred`,
                    provider: preferredProvider,
                    confidence: 1.0
                  });
                }
              }
            });
          }
        }
      }
    }

    // Add primary provider options
    const primaryData = selectedSourcesMetadata[provider];
    if (primaryData) {
      const primaryDataRecord = primaryData as Record<string, unknown>;
      const value = primaryDataRecord[fieldName];
      // Check for non-null/undefined values (including 0, empty arrays, etc)
      if (value !== null) {
        // Skip empty arrays for cleaner UI
        if (Array.isArray(value) && value.length === 0) {
          // Skip empty arrays
        } else {
          const optionValue = Array.isArray(value) ? value : [value];
          optionValue.forEach((v: unknown) => {
            // Only add non-empty values
            if (v !== null && v !== '') {
              const normalizedValue = typeof v === 'string' ? v : String(v);
              // Create unique key for this option
              const optionKey = `${normalizedValue}::${provider}`;
              if (!seenKeys.has(optionKey)) {
                seenKeys.add(optionKey);
                options.push({
                  value: optionKey,
                  label: `[${provider}] ${normalizedValue}`,
                  provider,
                  confidence: 1.0
                });
              }
            }
          });
        }
      }
    }

    // Add all secondary source options - show ALL provider data
    Object.entries(selectedSourcesMetadata).forEach(([source, data]) => {
      // Skip sources that have already been added as preferred or primary
      if (source !== provider && source !== preferredProvider) {
        const dataRecord = data as Record<string, unknown>;
        const value = dataRecord[fieldName];
        // Check for non-null/undefined values (including 0, empty arrays, etc)
        if (value !== null) {
          // Skip empty arrays for cleaner UI
          if (Array.isArray(value) && value.length === 0) {
            // Skip empty arrays
          } else {
            const optionValue = Array.isArray(value) ? value : [value];
            optionValue.forEach((v: unknown) => {
              // Only add non-empty values
              if (v !== null && v !== '') {
                const normalizedValue = typeof v === 'string' ? v : String(v);
                // Create unique key for this option
                const optionKey = `${normalizedValue}::${source}`;
                if (!seenKeys.has(optionKey)) {
                  seenKeys.add(optionKey);
                  options.push({
                    value: optionKey,
                    label: `[${source}] ${normalizedValue}`,
                    provider: source,
                    confidence: 0.8
                  });
                }
              }
            });
          }
        }
      }
    });

    return options;
  }, [selectedSourcesMetadata, provider, preferencesEnabled, getPreferredProvider]);

  /**
   * Get status options with normalization (show all provider data)
   */
  const getStatusOptions = useCallback((): ProviderOption[] => {
    const options: ProviderOption[] = [];
    const seenKeys = new Set<string>(); // Track unique option keys

    Object.entries(selectedSourcesMetadata).forEach(([source, data]) => {
      if (data["status"]) {
        const normalizedStatus = normalizeStatus(data["status"]);
        if (normalizedStatus) {
          const optionKey = `${normalizedStatus}::${source}`;
          // Only add if we haven't seen this exact option before
          if (!seenKeys.has(optionKey)) {
            seenKeys.add(optionKey);
            options.push({
              value: optionKey,
              label: `[${source}] ${normalizedStatus}`,
              provider: source,
              confidence: source === provider ? 1.0 : 0.8
            });
          }
        }
      }
    });

    return options;
  }, [selectedSourcesMetadata, provider]);

  /**
   * Get format options
   */
  const getFormatOptions = useCallback((): ProviderOption[] => {
    const options = getFieldOptions('format');
    return options;
  }, [getFieldOptions]);

  /**
   * Get genre options from all sources (show all provider data)
   */
  const getGenreOptions = useCallback((): ProviderOption[] => {
    const options: ProviderOption[] = [];
    const seenKeys = new Set<string>(); // Track unique option keys

    Object.entries(selectedSourcesMetadata).forEach(([source, data]) => {
      if (data["genres"] && Array.isArray(data["genres"])) {
        data["genres"].forEach((genre: string) => {
          const optionKey = `${genre}::${source}`;
          // Only add if we haven't seen this exact option before
          if (!seenKeys.has(optionKey)) {
            seenKeys.add(optionKey);
            options.push({
              value: optionKey,
              label: `[${source}] ${genre}`,
              provider: source,
              confidence: source === provider ? 1.0 : 0.8
            });
          }
        });
      }
    });

    return options;
  }, [selectedSourcesMetadata, provider]);

  /**
   * Get demographic options from providers
   */
  const getDemographicOptions = useCallback((): ProviderOption[] => {
    return getFieldOptions('demographic');
  }, [getFieldOptions]);

  /**
   * Toggle edit mode for a field
   */
  const toggleEditMode = useCallback((fieldName: string): void => {
    setDescriptionEditMode(prev => ({
      ...prev,
      [fieldName]: !prev[fieldName]
    }));
  }, []);

  /**
   * Auto-select best value from options
   */
  const selectBestOption = useCallback((options: ProviderOption[], fieldName?: string): string => {
    if (options.length === 0) return '';

    // If preferences are enabled and a field name is provided, check for preferred provider
    if (preferencesEnabled && fieldName) {
      const preferredProvider = getPreferredProvider(fieldName);
      if (preferredProvider) {
        const preferredOption = options.find(opt => opt.provider === preferredProvider);
        if (preferredOption) return preferredOption.value;
      }
    }

    // Prefer primary provider options
    const primaryOption = options.find(opt => opt.provider === provider);
    if (primaryOption) return primaryOption.value;

    // Otherwise, select option with highest confidence
    const bestOption = options.reduce((best, current) =>
      (current.confidence ?? 0) > (best.confidence ?? 0) ? current : best
    );

    return bestOption.value;
  }, [provider, preferencesEnabled, getPreferredProvider]);

  /**
   * Extract actual value from option value (remove provider suffix)
   */
  const extractActualValue = useCallback((optionValue: string): string => {
    if (!optionValue.includes('::')) {
      return optionValue;
    }
    const actualValue = optionValue.split('::')[0];
    return actualValue ?? optionValue;
  }, []);

  // Memoized field options
  const fieldOptions = useMemo<FieldOptions>(() => ({
    statusOptions: getStatusOptions(),
    formatOptions: getFormatOptions(),
    genreOptions: getGenreOptions(),
    tagOptions: getFieldOptions('tags'),
    themeOptions: getFieldOptions('themes'),
    authorOptions: getFieldOptions('authors'),
    artistOptions: getFieldOptions('artists'),
    publisherOptions: getFieldOptions('publisher'),
    demographicOptions: getDemographicOptions()
  }), [
    getStatusOptions,
    getFormatOptions,
    getGenreOptions,
    getFieldOptions,
    getDemographicOptions
  ]);

  return {
    descriptionEditMode,
    setDescriptionEditMode,
    toggleEditMode,
    getFieldOptions,
    selectBestOption,
    extractActualValue,
    fieldOptions
  };
};

export default useWizardFieldManagement;