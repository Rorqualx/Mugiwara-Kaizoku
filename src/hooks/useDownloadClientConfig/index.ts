/**
 * Download Client Configuration Hook
 *
 * React hook for accessing and updating download client configuration.
 *
 * Refactored from 831-line monolithic file into modular structure:
 * - types.ts - Type definitions (~130 lines)
 * - defaults.ts - Default values (~40 lines)
 * - utils.ts - Shared utilities (~85 lines)
 * - config-loader.ts - Config loading (~235 lines)
 * - client-settings.ts - Client update factory (~275 lines)
 * - config-updater.ts - Config update functions (~215 lines)
 * - connection-tester.ts - Connection testing (~145 lines)
 * - index.ts - This file (~120 lines)
 *
 * Total: ~1245 lines across 8 files
 * Benefits: Improved maintainability, testability, and code reuse
 */

import { useState, useEffect, useCallback } from 'react';

import { useConfig } from '@/hooks/useConfig';

import { createAllClientSettingUpdaters } from './client-settings';
import { loadDownloadClientConfig } from './config-loader';
import { createPreferenceUpdater, createConfigUpdater } from './config-updater';
import { createConnectionTester } from './connection-tester';
import { defaultDownloadClientConfig } from './defaults';
import { validateUrl } from './utils';

import type {
  DownloadClientConfig,
  TestConnectionState,
  UseDownloadClientConfigResult
} from './types';

// Re-export all types for external use
export * from './types';
export { defaultDownloadClientConfig } from './defaults';

/**
 * Hook for managing download client configuration
 *
 * @returns Download client configuration management interface
 */
export function useDownloadClientConfig(): UseDownloadClientConfigResult {
  // Get the main config hook
  const { get, set, isLoading: configIsLoading } = useConfig();

  // Local state
  const [downloadClientConfig, setDownloadClientConfig] =
    useState<DownloadClientConfig>(defaultDownloadClientConfig);
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testState, setTestState] = useState<TestConnectionState>({
    client: '',
    status: 'idle',
    message: ''
  });

  // Create load function with useCallback
  const loadConfig = useCallback(async (): Promise<void> => {
    await loadDownloadClientConfig(get, setDownloadClientConfig, setIsLoading, setError);
  }, [get]);

  // Create client update functions using factory
  const {
    updateTransmissionSetting,
    updateDelugeSetting,
    updateSabnzbdSetting,
    updateNzbgetSetting
  } = createAllClientSettingUpdaters({
    set,
    setDownloadClientConfig,
    setSaving,
    setError,
    loadDownloadClientConfig: loadConfig
  });

  // Create preference updater
  const updatePreference = createPreferenceUpdater(
    set,
    setDownloadClientConfig,
    setSaving,
    setError,
    loadConfig
  );

  // Create config updater
  const updateConfig = createConfigUpdater(
    set,
    setDownloadClientConfig,
    setSaving,
    setError,
    loadConfig
  );

  // Create connection tester
  const testConnection = createConnectionTester(downloadClientConfig, setTestState);

  // Load configuration on mount
  useEffect(() => {
    if (!configIsLoading) {
      void loadConfig();
    }
  }, [loadConfig, configIsLoading]);

  return {
    config: downloadClientConfig,
    isLoading: isLoading || configIsLoading,
    saving,
    error,
    testState,
    updateTransmissionSetting,
    updateDelugeSetting,
    updateSabnzbdSetting,
    updateNzbgetSetting,
    updatePreference,
    updateConfig,
    testConnection,
    validateUrl,
    refresh: loadConfig
  };
}
