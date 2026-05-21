/**
 * Kavita Integration Mutations Hook
 *
 * Consolidates all tRPC mutations and event handlers.
 * Handles updates, testing, and sync operations.
 *
 * @module kavita/hooks/useKavitaMutations
 */

import { useState } from 'react';

import { showNotification } from '@mantine/notifications';
import { IconCheck, IconX, IconRefresh, IconKey } from '@tabler/icons-react';

import { trpc } from '@/utils/trpc-client/index';

import type { KavitaFormValues, KavitaMutationHandlers } from '../types';

interface UseKavitaMutationsParams {
  refetchSettings: () => Promise<unknown>;
  refetchStatus: () => Promise<unknown>;
}

interface MutationReturn {
  updateConfig: ReturnType<typeof trpc.settings.updateIntegration.useMutation>;
  testConnection: ReturnType<typeof trpc.integrations.kavita.testConnection.useMutation>;
  syncLibrary: ReturnType<typeof trpc.integrations.kavita.syncLibrary.useMutation>;
}

interface UseKavitaMutationsReturn {
  mutations: MutationReturn;
  handlers: KavitaMutationHandlers;
  isTesting: boolean;
}

/**
 * Custom hook for managing Kavita integration mutations
 *
 * @param params - Refetch functions and state setters
 * @returns Mutations and event handlers
 */
export function useKavitaMutations(params: UseKavitaMutationsParams): UseKavitaMutationsReturn {
  const { refetchSettings, refetchStatus } = params;
  const [isTesting, setIsTesting] = useState<boolean>(false);

  // Update configuration mutation
  const updateConfigMutation = trpc.settings.updateIntegration.useMutation({
    onSuccess: () => {
      showNotification({
        title: 'Settings Saved',
        message: 'Kavita integration settings have been updated',
        color: 'green',
        icon: <IconCheck size={16} />
      });
      void refetchSettings();
      void refetchStatus();
    },
    onError: (error) => {
      showNotification({
        title: 'Error',
        message: error instanceof Error ? error.message : String(error),
        color: 'red',
        icon: <IconX size={16} />
      });
    }
  });

  // Test connection mutation
  const testConnectionMutation = trpc.integrations.kavita.testConnection.useMutation({
    onSuccess: (data) => {
      setIsTesting(false);
      showNotification({
        title: 'Connection Successful',
        message: `Connected to Kavita v${data.serverInfo.version}`,
        color: 'green',
        icon: <IconCheck size={16} />
      });
      void refetchStatus();
    },
    onError: (error) => {
      setIsTesting(false);
      showNotification({
        title: 'Connection Failed',
        message: error instanceof Error ? error.message : String(error),
        color: 'red',
        icon: <IconX size={16} />
      });
    }
  });

  // Sync library mutation
  const syncLibraryMutation = trpc.integrations.kavita.syncLibrary.useMutation({
    onSuccess: () => {
      showNotification({
        title: 'Sync Started',
        message: 'Library synchronization has been initiated',
        color: 'green',
        icon: <IconRefresh size={16} />
      });
      void refetchStatus();
    },
    onError: (error) => {
      showNotification({
        title: 'Sync Failed',
        message: error instanceof Error ? error.message : String(error),
        color: 'red',
        icon: <IconX size={16} />
      });
    }
  });

  // Handler: Submit form values
  const handleSubmit = (values: KavitaFormValues): void => {
    void updateConfigMutation.mutateAsync({
      type: 'kavita',
      enabled: values.enabled,
      config: {
        host: values.host,
        apiKey: values.apiKey,
        syncInterval: values.syncInterval,
        autoSync: values.autoSync,
        syncDirection: values.syncDirection,
        libraries: values.libraries
      }
    });
  };

  // Handler: Test connection with provided credentials
  const handleTestConnection = (host: string, apiKey: string): void => {
    setIsTesting(true);
    void testConnectionMutation.mutateAsync({ host, apiKey });
  };

  // Handler: Sync all libraries in parallel
  // FIX: Use Promise.all instead of await in loop to avoid no-await-in-loop violation
  const handleSyncAllLibraries = async (libraryIds: string[]): Promise<void> => {
    await Promise.all(
      libraryIds.map((libraryId) =>
        syncLibraryMutation.mutateAsync({ libraryId: Number(libraryId) })
      )
    );
  };

  // Handler: Show API key instructions
  const handleGenerateApiKey = (): void => {
    showNotification({
      title: 'Get API Key from Kavita',
      message: 'Go to Kavita user dashboard at /preferences#clients to get your API key',
      color: 'blue',
      icon: <IconKey size={16} />,
      autoClose: 10000
    });
  };

  return {
    mutations: {
      updateConfig: updateConfigMutation,
      testConnection: testConnectionMutation,
      syncLibrary: syncLibraryMutation
    },
    handlers: {
      handleSubmit,
      handleTestConnection,
      handleSyncAllLibraries,
      handleGenerateApiKey
    },
    isTesting
  };
}
