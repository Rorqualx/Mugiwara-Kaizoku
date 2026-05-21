/**
 * Chapter Updates Hook
 *
 * Subscribes to real-time chapter update events for a manga
 * and triggers refetch + notifications when chapters are created/updated.
 *
 * @module hooks/manga/useChapterUpdates
 */

import { useEffect, useRef } from 'react';

import { notifications } from '@mantine/notifications';

import { useRealTime } from '@/providers/RealTimeProvider';
import { CHANNEL_PATTERNS, type WebSocketEvent } from '@/types/api/v1/websocket';
import { logger } from '@/utils/logger';
import { notify } from '@/utils/notify';
interface ChapterUpdateData {
  chaptersCreated?: number;
  action?: string;
}

interface UseChapterUpdatesOptions {
  /** Manga ID to subscribe to */
  mangaId: number | undefined;
  /** Callback to refetch manga data */
  onChaptersUpdated: () => Promise<void> | void;
  /** Whether the feature is enabled */
  enabled?: boolean;
}

interface UseChapterUpdatesReturn {
  /** Whether we're connected to real-time updates */
  isConnected: boolean;
}

/**
 * Hook to subscribe to real-time chapter updates for a manga
 *
 * When chapters are created/updated in the background, this hook will:
 * 1. Show a notification to the user
 * 2. Trigger a refetch of manga data
 *
 * @example
 * ```tsx
 * useChapterUpdates({
 *   mangaId,
 *   onChaptersUpdated: async () => {
 *     await refetch();
 *     setRefreshCounter(prev => prev + 1);
 *   }
 * });
 * ```
 */
export function useChapterUpdates({
  mangaId,
  onChaptersUpdated,
  enabled = true
}: UseChapterUpdatesOptions): UseChapterUpdatesReturn {
  const { isConnected, subscribe } = useRealTime();

  // Use refs to avoid dependency changes causing infinite loops
  // The callback and subscribe function are stored in refs so they're always current
  // but don't trigger effect re-runs
  const onChaptersUpdatedRef = useRef(onChaptersUpdated);
  const subscribeRef = useRef(subscribe);
  const mangaIdRef = useRef(mangaId);

  // Keep refs current
  useEffect(() => {
    onChaptersUpdatedRef.current = onChaptersUpdated;
  }, [onChaptersUpdated]);

  useEffect(() => {
    subscribeRef.current = subscribe;
  }, [subscribe]);

  useEffect(() => {
    mangaIdRef.current = mangaId;
  }, [mangaId]);

  useEffect(() => {
    if (!enabled || mangaId === undefined || !isConnected) {
      return;
    }

    const channel = CHANNEL_PATTERNS.MANGA_UPDATES(mangaId);

    logger.info('[useChapterUpdates] Subscribing to channel:', { channel, mangaId });

    // Event handler uses refs to access current values without being a dependency
    const handleChapterEvent = (event: WebSocketEvent): void => {
      const eventType = event.type;
      const data = event.data as ChapterUpdateData | undefined;
      const currentMangaId = mangaIdRef.current;

      logger.info('[useChapterUpdates] Received chapter event:', {
        mangaId: currentMangaId,
        type: eventType,
        data
      });

      // Handle chapters_updated event (from background scraping)
      if (eventType === 'manga:chapters_updated') {
        const chaptersCreated = data?.chaptersCreated ?? 0;

        // Show success notification
        notify({ severity: 'SUCCESS', title: 'Chapters Updated', message: chaptersCreated > 0
            ? `${chaptersCreated} chapter${chaptersCreated === 1 ? '' : 's'} have been added`
            : 'Chapter data has been updated', toast: { autoClose: 5000 } });

        // Trigger refetch using current callback from ref
        void onChaptersUpdatedRef.current();
      }
    };

    const unsubscribe = subscribeRef.current(channel, handleChapterEvent);

    return () => {
      logger.info('[useChapterUpdates] Unsubscribing from channel:', { channel, mangaId });
      unsubscribe();
    };
  }, [enabled, mangaId, isConnected]); // Minimal dependencies - refs handle the rest

  return {
    isConnected
  };
}

/**
 * Show a warning notification when chapters are being scraped in background
 * Call this when navigating to manga detail after adding a new manga
 */
export function showChapterScrapingNotification(mangaTitle?: string): void {
  notifications.show({
    id: 'chapters-scraping',
    title: 'Chapters Loading',
    message: mangaTitle
      ? `Chapters for "${mangaTitle}" are being loaded in the background. The page will update automatically.`
      : 'Chapters are being loaded in the background. The page will update automatically.',
    color: 'blue',
    autoClose: 8000,
    loading: true
  });
}
