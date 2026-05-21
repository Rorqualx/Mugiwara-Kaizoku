/**
 * Settings Handler
 *
 * Updates integration settings with validation.
 *
 * Extracted from: useStoreActions.ts (lines 478-501)
 *
 * @module store/useStoreActions/handlers/settings
 */

import { useCallback } from 'react';

import type { IntegrationSettingKey, SettingsUpdateInput } from '../types';

/**
 * Dependencies for the settings handler
 */
interface SettingsDependencies {
  settingsMutation: {
    mutateAsync: (input: SettingsUpdateInput) => Promise<unknown>;
  };
  integrationActions: {
    updateIntegration: (
      integration: 'komga' | 'kavita',
      updates: Record<string, string | boolean | number | Date | null>
    ) => void;
  };
  showError: (opts: { title: string; message: string }) => void;
}

/**
 * Creates the handleUpdateSettings callback
 *
 * Updates integration settings with:
 * - Type validation
 * - API integration
 * - Local state updates
 * - Error handling
 *
 * @param {SettingsDependencies} deps - Handler dependencies
 * @returns {Function} Callback function for updating settings
 */
export function useUpdateSettingsHandler(deps: SettingsDependencies): (
  key: string,
  value: string | boolean | number
) => Promise<void> {
  const { settingsMutation, integrationActions, showError } = deps;

  return useCallback(async (key: string, value: string | boolean | number): Promise<void> => {
    try {
      // Create a properly typed input object for settings mutation
      const input: SettingsUpdateInput = {
        key,
        value: typeof value === 'number' ? value.toString() : value
      };

      await settingsMutation.mutateAsync(input);

      // Update local integration state if applicable
      if (key.startsWith('komga') || key.startsWith('kavita')) {
        const [integration, settingKey] = key.split('.') as [
          'komga' | 'kavita',
          IntegrationSettingKey
        ];

        // Convert arrays to comma-separated strings before storing
        const normalizedValue = Array.isArray(value) ? value.join(',') : value;

        const updates: Record<string, string | boolean | number | Date | null> = {
          [settingKey]: normalizedValue
        };

        integrationActions.updateIntegration(integration, updates);
      }
    } catch (error: unknown) {
      showError({
        title: 'Settings Update Failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }, [settingsMutation, integrationActions, showError]);
}
