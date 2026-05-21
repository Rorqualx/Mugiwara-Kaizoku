import { useState } from 'react';

import type { AsyncResult } from '@/utils/async-result';
import { trpc } from '@/utils/trpc-client/index';

export interface UseKomgaMutationsProps {
  refetchSettings: () => void | Promise<unknown>;
  refetchStatus: () => void | Promise<unknown>;
}

export interface UseKomgaMutationsReturn {
  isTesting: boolean;
  setIsTesting: (testing: boolean) => void;
  updateConfigMutation: {
    isPending: boolean;
    mutateAsync: (params: { type: 'komga'; enabled: boolean; config: Record<string, unknown> }) => Promise<AsyncResult<boolean, Error>>;
  };
  testConnectionMutation: {
    isPending: boolean;
    mutateAsync: (params: { host: string; authMethod: 'basic' | 'apikey'; username?: string | undefined; password?: string | undefined; apiKey?: string | undefined }) => Promise<{ success: boolean; message: string; serverInfo?: { version: string; buildDate: string } }>;
  };
  syncLibraryMutation: {
    isPending: boolean;
    mutateAsync: (params: { libraryId: string; deep: boolean }) => Promise<{ success: boolean; message: string }>;
  };
}

export function useKomgaMutations({
  refetchSettings,
  refetchStatus
}: UseKomgaMutationsProps): UseKomgaMutationsReturn {
  const [isTesting, setIsTesting] = useState(false);

  // Update Komga configuration
  const updateConfigMutation = trpc.settings.updateIntegration.useMutation({
    onSuccess: () => {
      void refetchSettings();
      void refetchStatus();
    }
  });

  // Test connection to Komga server
  const testConnectionMutation = trpc.integrations.komga.testConnection.useMutation({
    onSuccess: () => {
      setIsTesting(false);
      void refetchStatus();
    },
    onError: () => {
      setIsTesting(false);
    }
  });

  // Sync library
  const syncLibraryMutation = trpc.integrations.komga.syncLibrary.useMutation({
    onSuccess: () => {
      void refetchStatus();
    }
  });

  return {
    isTesting,
    setIsTesting,
    updateConfigMutation: {
      isPending: updateConfigMutation.isPending,
      mutateAsync: updateConfigMutation.mutateAsync
    },
    testConnectionMutation: {
      isPending: testConnectionMutation.isPending,
      mutateAsync: testConnectionMutation.mutateAsync
    },
    syncLibraryMutation: {
      isPending: syncLibraryMutation.isPending,
      mutateAsync: syncLibraryMutation.mutateAsync
    }
  };
}