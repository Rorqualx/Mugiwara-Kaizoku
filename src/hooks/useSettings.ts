import type { IntegrationSettings } from '@/types/config.types';
import { trpc } from '@/utils/trpc-client/index';

import {
  DEFAULT_INTEGRATION_SETTINGS,
  transformSettings
} from './settings/settings-transformers';
import { useNotification } from './useNotification';



// Define a more specific type for settings output to avoid deep type instantiation issues
interface SettingsOutput {
  appConfig: IntegrationSettings;
}

/**
 * Return type for the useSettings hook
 */
export interface UseSettingsResult {
  /** Application settings */
  settings: SettingsOutput | undefined;
  /** Whether settings are currently being fetched */
  isLoading: boolean;
  /** Function to update a specific setting */
  updateSetting: (key: string, value: string | boolean | string[]) => Promise<void>;
}

/**
 * Hook for managing application settings
 *
 * This hook provides access to application settings along with functionality
 * to update individual settings. It handles notifications for successful
 * updates and error cases.
 *
 * @returns {UseSettingsResult} Settings data and update function
 *
 * @example
 * ```tsx
 * const { settings, isLoading, updateSetting } = useSettings();
 *
 * // Update a setting
 * await updateSetting('theme', 'dark');
 * ```
 */
export function useSettings(): UseSettingsResult {
  const mockSettingsData: SettingsOutput = {
    appConfig: DEFAULT_INTEGRATION_SETTINGS
  };

  // Try to fetch settings from the database
  // Settings are cached for 5 minutes (matching backend 10-minute cache)
  const settingsQuery = trpc.settings.get.useQuery(
    { key: 'appConfig', defaultValue: DEFAULT_INTEGRATION_SETTINGS },
    {
      staleTime: 5 * 60 * 1000, // 5 minutes - settings don't change often
      refetchOnWindowFocus: false
    }
  );

  // Transform settings data from API response
  const settingsData = settingsQuery.data as Partial<IntegrationSettings> | null | undefined;
  const transformedSettings: SettingsOutput | null = settingsData ? {
    appConfig: transformSettings(settingsData)
  } : null;

  // Use settings.set for updating settings
  const updateMutation = trpc.settings.set.useMutation({
    onSuccess: () => {
      void settingsQuery.refetch();
    }
  });
  const { showSuccess, showError } = useNotification();

  const updateSetting = async (
    key: string,
    value: string | boolean | string[]
  ): Promise<void> => {
    try {
      await updateMutation.mutateAsync({
        key: key,
        value: value
      });

      showSuccess({
        title: 'Settings Updated',
        message: `Successfully updated ${key}`
      });

      await settingsQuery.refetch();
    } catch (error: unknown) {
      showError({
        title: 'Update Failed',
        message: error instanceof Error ? error.message : 'Failed to update settings'
      });
      throw error;
    }
  };

  return {
    settings: transformedSettings ?? mockSettingsData,
    isLoading: settingsQuery.isLoading,
    updateSetting
  };
}
