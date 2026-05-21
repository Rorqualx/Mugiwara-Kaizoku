/**
 * Custom hook for managing Prowlarr configuration
 *
 * Handles Prowlarr configuration state, form management, and API operations
 * for testing and saving Prowlarr settings.
 *
 * @module pages/settings/indexers/hooks/useProwlarrConfig
 */

import { useState, useCallback, useEffect, useRef } from 'react';

import { useIntegrationStore } from '@/store/integrationSlice';
import { logger } from '@/utils/logger';
import { createProwlarrClient } from '@/utils/prowlarrApi';
import { trpc } from '@/utils/trpc-client';

import { normalizeBaseURL, validateProwlarrConfig } from '../utils/utils';

import type { ProwlarrConfigState } from '../types';

/**
 * Hook return type
 */
export interface UseProwlarrConfigReturn {
  formState: ProwlarrConfigState;
  onToggleProwlarr: (enabled: boolean) => Promise<void>;
  onSubmit: (e: React.MouseEvent) => Promise<void>;
  onTest: () => Promise<void>;
  onBaseURLChange: (value: string) => void;
  onApiKeyChange: (value: string) => void;
}

/**
 * Custom hook for managing Prowlarr configuration
 *
 * @returns Configuration state and handlers
 */
export function useProwlarrConfig(): UseProwlarrConfigReturn {
  const prowlarrSettings = useIntegrationStore((state) => state.prowlarr);
  const updateProwlarr = useIntegrationStore((state) => state.updateProwlarr);
  const settingsMutation = trpc.settings.set.useMutation({});
  const hasHydrated = useRef(false);

  // Configuration form state
  const [formState, setFormState] = useState<ProwlarrConfigState>({
    baseURL: prowlarrSettings.baseURL,
    apiKey: prowlarrSettings.apiKey,
    testSuccess: null,
    testMessage: '',
    isTesting: false
  });

  // Sync form state when store values change (e.g., after hydration from database)
  useEffect(() => {
    // Only sync if we haven't hydrated yet and store has actual values
    if (!hasHydrated.current && (prowlarrSettings.baseURL || prowlarrSettings.apiKey)) {
      hasHydrated.current = true;
      logger.debug('[useProwlarrConfig] Syncing form state from store:', {
        baseURL: prowlarrSettings.baseURL,
        apiKey: prowlarrSettings.apiKey ? `${prowlarrSettings.apiKey.substring(0, 4)}...` : '(empty)'
      });
      setFormState(prev => ({
        ...prev,
        baseURL: prowlarrSettings.baseURL || prev.baseURL,
        apiKey: prowlarrSettings.apiKey || prev.apiKey
      }));
    }
  }, [prowlarrSettings.baseURL, prowlarrSettings.apiKey]);

  /**
   * Updates base URL in form state. Clears stale test/validation feedback
   * so the user isn't shown a result for a value they've since edited.
   */
  const onBaseURLChange = useCallback((value: string) => {
    logger.info('Setting baseURL to:', value);
    setFormState(prev => ({ ...prev, baseURL: value, testSuccess: null, testMessage: '' }));
  }, []);

  /**
   * Updates API key in form state. Clears stale test/validation feedback.
   */
  const onApiKeyChange = useCallback((value: string) => {
    logger.info('Setting apiKey to:', value);
    setFormState(prev => ({ ...prev, apiKey: value, testSuccess: null, testMessage: '' }));
  }, []);

  /**
   * Toggles Prowlarr integration
   */
  const onToggleProwlarr = useCallback(async (enabled: boolean): Promise<void> => {
    // Optimistic store update
    updateProwlarr({ enabled });
    try {
      await settingsMutation.mutateAsync({
        key: 'prowlarrEnabled',
        value: enabled
      });
    } catch (err: unknown) {
      // Roll back the optimistic update so store and DB stay consistent
      updateProwlarr({ enabled: !enabled });
      const errorMessage = err instanceof Error ? err.message : String(err);
      logger.error('Failed to update prowlarrEnabled setting:', errorMessage);
    }
  }, [updateProwlarr, settingsMutation]);

  /**
   * Tests Prowlarr connection
   */
  const onTest = useCallback(async (): Promise<void> => {
    const { baseURL, apiKey } = formState;

    const validation = validateProwlarrConfig(baseURL, apiKey);
    if (!validation.isValid) {
      setFormState(prev => ({
        ...prev,
        testSuccess: false,
        testMessage: validation.error ?? 'Invalid Prowlarr configuration'
      }));
      return;
    }

    logger.info('Testing connection', { url: baseURL, apiKey: apiKey.substring(0, 4) + '...' });
    setFormState(prev => ({ ...prev, isTesting: true }));

    try {
      const client = createProwlarrClient({ baseURL, apiKey });
      logger.info('Testing connection...');
      const success = await client.testConnection();

      if (success) {
        logger.info('Connection test successful');
        setFormState(prev => ({
          ...prev,
          testSuccess: true,
          testMessage: 'Connection successful. Prowlarr API is working.'
        }));
      } else {
        logger.error('Prowlarr connection test failed');
        setFormState(prev => ({
          ...prev,
          testSuccess: false,
          testMessage: 'Connection failed: Failed to connect to Prowlarr'
        }));
      }
    } catch (err: unknown) {
      logger.error('Prowlarr connection test failed:', err);
      setFormState(prev => ({
        ...prev,
        testSuccess: false,
        testMessage: `Connection failed: ${err instanceof Error ? err.message : 'Unknown error'}`
      }));
    } finally {
      setFormState(prev => ({ ...prev, isTesting: false }));
    }
  }, [formState]);

  /**
   * Saves Prowlarr configuration
   */
  const onSubmit = useCallback(async (e: React.MouseEvent): Promise<void> => {
    e.preventDefault();
    const { baseURL, apiKey } = formState;

    const validation = validateProwlarrConfig(baseURL, apiKey);
    if (!validation.isValid) {
      setFormState(prev => ({
        ...prev,
        testSuccess: false,
        testMessage: validation.error ?? 'Invalid Prowlarr configuration'
      }));
      return;
    }

    const normalizedBaseURL = normalizeBaseURL(baseURL);

    try {
      // Optimistic store update
      updateProwlarr({
        enabled: true,
        baseURL: normalizedBaseURL,
        apiKey
      });

      // Persist to database
      await settingsMutation.mutateAsync({ key: 'prowlarrEnabled', value: true });
      await settingsMutation.mutateAsync({ key: 'prowlarrBaseURL', value: normalizedBaseURL });
      await settingsMutation.mutateAsync({ key: 'prowlarrApiKey', value: apiKey });

      // Auto-test the saved configuration. onTest sets the final UI state,
      // so we don't pre-set a "saved successfully" message that would just
      // get overwritten by the test outcome.
      await onTest();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logger.error('Failed to save Prowlarr configuration:', errorMessage);
      setFormState(prev => ({
        ...prev,
        testSuccess: false,
        testMessage: 'Failed to save configuration.'
      }));
    }
  }, [formState, updateProwlarr, settingsMutation, onTest]);

  return {
    formState,
    onToggleProwlarr,
    onSubmit,
    onTest,
    onBaseURLChange,
    onApiKeyChange
  };
}