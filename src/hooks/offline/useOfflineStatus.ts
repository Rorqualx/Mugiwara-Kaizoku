/**
 * Offline Status Hook
 *
 * Monitors offline/online status and provides:
 * - Connection state
 * - Service worker status
 * - Offline content availability
 * - Sync status
 */

import { useState, useEffect, useCallback } from 'react';

import { useInterval } from '@mantine/hooks';

import type {
  AsyncResult
} from '@/utils/async-result';
import {
  createSuccessResult,
  createErrorResult,
  createLoadingResult,
  isSuccess
} from '@/utils/async-result';
import { logger } from '@/utils/logger';
import { offlineStorage } from '@/utils/offline/offline-storage';
import { serviceWorkerManager } from '@/utils/offline/service-worker-manager';

export interface OfflineStatus {
  isOnline: boolean;
  isServiceWorkerActive: boolean;
  hasOfflineContent: boolean;
  offlineMangaCount: number;
  pendingActionsCount: number;
  lastSyncTime: number | null;
  isSyncing: boolean;
}

export interface UseOfflineStatusReturn {
  status: AsyncResult<OfflineStatus, Error>;
  refresh: () => Promise<void>;
  syncNow: () => Promise<void>;
  clearOfflineData: () => Promise<void>;
}

export function useOfflineStatus(): UseOfflineStatusReturn {
  const [status, setStatus] = useState<AsyncResult<OfflineStatus, Error>>(
    createLoadingResult()
  );

  // Check status
  const checkStatus = useCallback(async () => {
    try {
      // Get service worker status
      const swStatusResult = await serviceWorkerManager.getStatus();
      const isServiceWorkerActive = isSuccess(swStatusResult) && swStatusResult.data.isActive;

      // Get offline content count
      const mangaResult = await offlineStorage.getAllManga();
      const offlineMangaCount = isSuccess(mangaResult) ? mangaResult.data.length : 0;

      // Get pending actions count
      const actionsResult = await serviceWorkerManager.getPendingActions();
      const pendingActionsCount = isSuccess(actionsResult) ? actionsResult.data.length : 0;

      // Get last sync time from localStorage
      const lastSyncTime = localStorage.getItem('offline-last-sync');

      const offlineStatus: OfflineStatus = {
        isOnline: navigator.onLine,
        isServiceWorkerActive,
        hasOfflineContent: offlineMangaCount > 0,
        offlineMangaCount,
        pendingActionsCount,
        lastSyncTime: lastSyncTime ? parseInt(lastSyncTime, 10) : null,
        isSyncing: false
      };

      setStatus(createSuccessResult(offlineStatus));
    } catch (error: unknown) {
      setStatus(createErrorResult(
        error instanceof Error ? error : new Error('Failed to check offline status')
      ));
    }
  }, []);

  // Sync offline actions
  const syncNow = useCallback(async () => {
    try {
      // Update syncing state
      setStatus((prev) => {
        if (isSuccess(prev)) {
          return createSuccessResult({
            ...prev.data,
            isSyncing: true
          });
        }
        return prev;
      });

      // Perform sync
      await serviceWorkerManager.syncOfflineActions();

      // Update last sync time
      localStorage.setItem('offline-last-sync', Date.now().toString());

      // Refresh status
      await checkStatus();
    } catch (error: unknown) {
      logger.error('Sync failed', { error });
      // Still refresh to update syncing state
      await checkStatus();
    }
  }, [checkStatus]);

  // Clear offline data
  const clearOfflineData = useCallback(async () => {
    try {
      // Clear offline storage
      await offlineStorage.clearAll();

      // Clear service worker caches
      await serviceWorkerManager.clearCaches();

      // Refresh status
      await checkStatus();
    } catch (error: unknown) {
      logger.error('Failed to clear offline data', { error });
      throw error;
    }
  }, [checkStatus]);

  // Initial check
  useEffect(() => {
    void checkStatus();
  }, [checkStatus]);

  // Listen for online/offline events
  useEffect(() => {
    const handleOnline = (): void => {
      logger.info('[Offline Hook] Connection restored');
      void checkStatus();
      // Auto-sync when coming online
      if (isSuccess(status) && status.data.pendingActionsCount > 0) {
        void syncNow();
      }
    };

    const handleOffline = (): void => {
      logger.info('[Offline Hook] Connection lost');
      void checkStatus();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [checkStatus, syncNow, status]);

  // Listen for service worker updates
  useEffect(() => {
    const unsubscribe = serviceWorkerManager.onUpdateAvailable(() => {
      logger.info('[Offline Hook] Service worker update available');
      void checkStatus();
    });

    return unsubscribe;
  }, [checkStatus]);

  // Listen for sync completion
  useEffect(() => {
    const unsubscribe = serviceWorkerManager.onMessage('SYNC_COMPLETE', (data) => {
      logger.info('[Offline Hook] Sync completed:', data);
      void checkStatus();
    });

    return unsubscribe;
  }, [checkStatus]);

  // Periodic status check (every 30 seconds)
  useInterval(() => { void checkStatus(); }, 30000);

  return {
    status,
    refresh: checkStatus,
    syncNow,
    clearOfflineData
  };
}

/**
 * Hook to check if specific content is available offline
 */
export function useOfflineContent(mangaId?: string): {
  isAvailable: boolean;
  isLoading: boolean;
  download: () => Promise<void>;
  remove: () => Promise<void>;
} {
  const [isAvailable, setIsAvailable] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Check if manga is available offline
  const checkAvailability = useCallback(async () => {
    if (!mangaId) {
      setIsAvailable(false);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const result = await offlineStorage.getManga(mangaId);
      setIsAvailable(isSuccess(result) && result.data !== null);
    } catch (error: unknown) {
      logger.error('Failed to check offline availability', { error });
      setIsAvailable(false);
    } finally {
      setIsLoading(false);
    }
  }, [mangaId]);

  // Download for offline
  const download = useCallback(async () => {
    if (!mangaId) return;

    try {
      // Add to download queue
      await offlineStorage.addToQueue(mangaId, undefined, 1);
      // The actual download will be handled by a background service
    } catch (error: unknown) {
      logger.error('Failed to add to download queue', { error });
      throw error;
    }
  }, [mangaId]);

  // Remove from offline
  const remove = useCallback(async () => {
    if (!mangaId) return;

    try {
      await offlineStorage.deleteManga(mangaId);
      setIsAvailable(false);
    } catch (error: unknown) {
      logger.error('Failed to remove offline content', { error });
      throw error;
    }
  }, [mangaId]);

  // Check on mount and when mangaId changes
  useEffect(() => {
    void checkAvailability();
  }, [checkAvailability]);

  return {
    isAvailable,
    isLoading,
    download,
    remove
  };
}