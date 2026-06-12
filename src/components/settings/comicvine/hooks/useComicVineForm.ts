/**
 * Hook for managing ComicVine settings form state
 */
import { useState, useEffect, useCallback } from 'react';

import { useComicvineConfig } from '@/hooks/useComicvineConfig';
import { notify } from '@/utils/notify';
import { safeErrorMessage } from '@/utils/safe-render';
import { trpc } from '@/utils/trpc-client';

import { validateApiKey } from '../validation';

interface UseComicVineFormReturn {
  // Config state
  config: {
    apiKey: string;
    enabled: boolean;
    preferredLanguage: string;
    comicbookTrackingEnabled: boolean;
  };
  saving: string | null;
  error: Error | null;
  isLoading: boolean;

  // Form state
  apiKeyInput: string;
  validationError: string | null;
  testing: boolean;

  // Actions
  setApiKeyInput: (value: string) => void;
  clearValidationError: () => void;
  handleSave: () => Promise<void>;
  handleTestApi: () => Promise<void>;
  handleLanguageChange: (language: string) => Promise<void>;
  handleToggleComicbookTracking: (enabled: boolean) => Promise<void>;
}

/**
 * Custom hook for ComicVine form management
 */
export function useComicVineForm(): UseComicVineFormReturn {
  const { config, saving, error, updateSetting, updateConfig, isLoading } = useComicvineConfig();
  const [validationError, setValidationError] = useState<string | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState(config.apiKey);
  const [testing, setTesting] = useState(false);

  const testConnection = trpc.metadata.testProvider.useMutation();

  // Update local API key when config changes
  useEffect(() => {
    setApiKeyInput(config.apiKey);
  }, [config.apiKey]);

  const clearValidationError = useCallback((): void => {
    setValidationError(null);
  }, []);

  const handleSave = useCallback(async (): Promise<void> => {
    const validation = validateApiKey(apiKeyInput);
    if (!validation.isValid) {
      setValidationError(validation.error);
      return;
    }

    try {
      await updateConfig({
        apiKey: apiKeyInput,
        enabled: true
      });
      setValidationError(null);
    } catch (err: unknown) {
      setValidationError(err instanceof Error ? err.message : String(err));
    }
  }, [apiKeyInput, updateConfig]);

  const handleTestApi = useCallback(async (): Promise<void> => {
    const validation = validateApiKey(apiKeyInput);
    if (!validation.isValid) {
      setValidationError(validation.error);
      return;
    }

    setTesting(true);
    setValidationError(null);

    try {
      await testConnection.mutateAsync({
        provider: 'comicvine',
        config: {
          apiKey: apiKeyInput
        }
      });

      notify({ severity: 'SUCCESS', title: 'Connection Successful', message: 'Successfully connected to ComicVine API' });
    } catch (err: unknown) {
      notify({ severity: 'ERROR', title: 'Connection Failed', message: safeErrorMessage(err, 'Failed to connect to ComicVine') });
    } finally {
      setTesting(false);
    }
  }, [apiKeyInput, testConnection]);

  const handleLanguageChange = useCallback(async (language: string): Promise<void> => {
    await updateSetting('preferredLanguage', language);
  }, [updateSetting]);

  const handleToggleComicbookTracking = useCallback(async (enabled: boolean): Promise<void> => {
    await updateSetting('comicbookTrackingEnabled', enabled);
  }, [updateSetting]);

  return {
    config,
    saving,
    error,
    isLoading,
    apiKeyInput,
    validationError,
    testing,
    setApiKeyInput,
    clearValidationError,
    handleSave,
    handleTestApi,
    handleLanguageChange,
    handleToggleComicbookTracking,
  };
}
