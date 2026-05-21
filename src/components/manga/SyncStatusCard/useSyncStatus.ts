/**
 * useSyncStatus Hook
 *
 * Manages sync status mutations and state for chapter synchronization
 *
 * @module components/manga/SyncStatusCard/useSyncStatus
 */

import { useState } from 'react';

import { notify } from '@/utils/notify';
import { trpc } from '@/utils/trpc-client/index';

import type { OutOfSyncResult, SyncStatusState, SyncStatusActions } from './types';

interface UseSyncStatusParams {
  mangaId: number;
  onSyncFixed?: (() => void) | undefined;
}

interface UseSyncStatusReturn extends SyncStatusState, SyncStatusActions {}

export function useSyncStatus({
  mangaId,
  onSyncFixed,
}: UseSyncStatusParams): UseSyncStatusReturn {
  const [isChecking, setIsChecking] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const checkSyncMutation = trpc.manga.checkOutOfSyncChapters.useMutation({
    onSuccess: (data) => {
      setLastChecked(new Date());
      if (data.outOfSyncCount === 0) {
        notify({ severity: 'SUCCESS', title: 'Sync Status', message: 'All chapters are in sync' });
      }
    },
    onError: (error) => {
      const errorMessage = error instanceof Error ? error.message : String(error);
      notify({ severity: 'ERROR', title: 'Check Failed', message: errorMessage || 'Failed to check sync status' });
    },
  });

  const fixSyncMutation = trpc.manga.fixOutOfSyncChapters.useMutation({
    onSuccess: () => {
      notify({ severity: 'SUCCESS', title: 'Sync Fixed', message: 'Successfully synchronized chapters' });
      void handleCheckSync();
      onSyncFixed?.();
    },
    onError: (error) => {
      const errorMessage = error instanceof Error ? error.message : String(error);
      notify({ severity: 'ERROR', title: 'Fix Failed', message: errorMessage || 'Failed to fix sync issues' });
    },
  });

  const handleCheckSync = async (): Promise<void> => {
    setIsChecking(true);
    try {
      await checkSyncMutation.mutateAsync({ mangaId });
    } finally {
      setIsChecking(false);
    }
  };

  const handleFixSync = async (): Promise<void> => {
    await fixSyncMutation.mutateAsync({ id: mangaId });
  };

  const syncData = checkSyncMutation.data as OutOfSyncResult | undefined;
  const isOutOfSync = (syncData?.outOfSyncCount ?? 0) > 0;
  const isLoading = isChecking || checkSyncMutation.isPending;
  const isFixing = fixSyncMutation.isPending;

  const missingChapters =
    syncData &&
    'missingChapters' in syncData &&
    Array.isArray(syncData.missingChapters)
      ? syncData.missingChapters
      : [];

  const extraChapters =
    syncData &&
    'extraChapters' in syncData &&
    Array.isArray(syncData.extraChapters)
      ? syncData.extraChapters
      : [];

  return {
    isChecking,
    lastChecked,
    syncData,
    isOutOfSync,
    isLoading,
    isFixing,
    missingChapters,
    extraChapters,
    handleCheckSync,
    handleFixSync,
  };
}
