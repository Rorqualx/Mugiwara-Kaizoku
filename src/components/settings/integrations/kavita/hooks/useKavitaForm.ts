/**
 * Kavita Integration Form Hook
 *
 * Manages form state and initialization from settings data.
 * Handles form validation and synchronization with backend state.
 *
 * @module kavita/hooks/useKavitaForm
 */

import { useEffect } from 'react';

import { useForm } from '@mantine/form';

import type { KavitaConfig } from '@/types/config.types';

import type { KavitaFormValues } from '../types';

/**
 * Type guard for settings data with data property
 */
function hasDataProperty(value: unknown): value is { data: unknown } {
  return typeof value === 'object' && value !== null && 'data' in value;
}

/**
 * Type guard for Kavita configuration
 *
 * @param config - Unknown configuration object
 * @returns True if config is KavitaConfig
 */
function isKavitaConfig(config: unknown): config is KavitaConfig {
  return (
    typeof config === 'object' &&
    config !== null &&
    'type' in config &&
    (config as { type: unknown }).type === 'kavita'
  );
}

interface UseKavitaFormParams {
  settingsData: unknown;
}

/**
 * Custom hook for managing Kavita integration form
 *
 * @param params - Settings data from queries
 * @returns Mantine form instance
 */
export function useKavitaForm(params: UseKavitaFormParams): ReturnType<typeof useForm<KavitaFormValues>> {
  const { settingsData } = params;

  const form = useForm<KavitaFormValues>({
    initialValues: {
      enabled: false,
      host: '',
      apiKey: '',
      syncInterval: 60,
      autoSync: false,
      syncDirection: 'bidirectional',
      libraries: []
    }
  });

  // Update form when settings data loads
  useEffect(() => {
    if (hasDataProperty(settingsData)) {
      const settings = settingsData.data;
      // Type guard to ensure we have KavitaConfig
      if (isKavitaConfig(settings)) {
        const values: Partial<KavitaFormValues> = {
          enabled: settings.enabled
        };

        if (settings.host !== undefined) values.host = settings.host;
        if (settings.apiKey !== undefined) values.apiKey = settings.apiKey;
        if (settings.syncInterval !== undefined) values.syncInterval = settings.syncInterval;
        if (settings.autoSync !== undefined) values.autoSync = settings.autoSync;
        if (settings.syncDirection !== undefined) values.syncDirection = settings.syncDirection;
        if (settings.libraries !== undefined) values.libraries = settings.libraries;

        form.setValues(values);
      }
    }

    // Note: form is intentionally excluded from dependencies to prevent infinite re-renders.
    // form.setValues does not need to trigger re-runs; only settingsData changes should.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsData]);

  return form;
}
