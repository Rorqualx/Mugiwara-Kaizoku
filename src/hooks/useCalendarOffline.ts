/**
 * Calendar Offline Hook
 *
 * Provides offline-aware calendar data access with automatic caching
 * and fallback to cached data when offline.
 *
 * @module hooks/useCalendarOffline
 */

import { useCallback, useEffect, useState } from 'react';

import {
  cacheCalendarEvents,
  getCachedCalendarEvents,
  getCacheMetadata,
  isCacheValid,
  clearCalendarCache,
  isIndexedDBAvailable,
} from '@/utils/offline/calendar-cache';
import type { CachedCalendarEvent, CalendarCacheMetadata } from '@/utils/offline/calendar-cache';

// ============================================================================
// Types
// ============================================================================

export interface UseCalendarOfflineResult {
  /** Whether the app is currently offline */
  isOffline: boolean;
  /** Whether we're using cached data (could be offline or cache fallback) */
  isUsingCache: boolean;
  /** Cached calendar events */
  cachedEvents: CachedCalendarEvent[];
  /** Cache metadata (last sync time, etc.) */
  cacheMetadata: CalendarCacheMetadata | null;
  /** Whether IndexedDB is available */
  isCacheAvailable: boolean;
  /** Whether the cache is still valid (not expired) */
  isCacheValid: boolean;
  /** Cache calendar events for offline use */
  cacheEvents: (events: CachedCalendarEvent[]) => Promise<void>;
  /** Clear the offline cache */
  clearCache: () => Promise<void>;
  /** Load events from cache */
  loadCachedEvents: () => Promise<void>;
  /** Error message if any */
  error: string | null;
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useCalendarOffline(): UseCalendarOfflineResult {
  const [isOffline, setIsOffline] = useState(false);
  const [isUsingCache, setIsUsingCache] = useState(false);
  const [cachedEvents, setCachedEvents] = useState<CachedCalendarEvent[]>([]);
  const [cacheMetadata, setCacheMetadata] = useState<CalendarCacheMetadata | null>(null);
  const [cacheValid, setCacheValid] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isCacheAvailable = isIndexedDBAvailable();

  // Monitor online/offline status
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = (): void => {
      setIsOffline(false);
      setIsUsingCache(false);
    };

    const handleOffline = (): void => {
      setIsOffline(true);
      setIsUsingCache(true);
    };

    setIsOffline(!navigator.onLine);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Load cache metadata on mount
  useEffect(() => {
    if (!isCacheAvailable) return;

    void loadCacheMetadata();
  }, [isCacheAvailable]);

  const loadCacheMetadata = async (): Promise<void> => {
    try {
      const metadata = await getCacheMetadata();
      setCacheMetadata(metadata);
      const valid = await isCacheValid();
      setCacheValid(valid);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load cache metadata');
    }
  };

  const loadCachedEvents = useCallback(async (): Promise<void> => {
    if (!isCacheAvailable) {
      setError('IndexedDB not available');
      return;
    }

    try {
      const events = await getCachedCalendarEvents();
      setCachedEvents(events);
      setIsUsingCache(true);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load cached events');
    }
  }, [isCacheAvailable]);

  const cacheEvents = useCallback(
    async (events: CachedCalendarEvent[]): Promise<void> => {
      if (!isCacheAvailable) {
        setError('IndexedDB not available');
        return;
      }

      try {
        await cacheCalendarEvents(events);
        setCachedEvents(events);
        await loadCacheMetadata();
        setError(null);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to cache events');
      }
    },
    [isCacheAvailable]
  );

  const clearCache = useCallback(async (): Promise<void> => {
    if (!isCacheAvailable) return;

    try {
      await clearCalendarCache();
      setCachedEvents([]);
      setCacheMetadata(null);
      setCacheValid(false);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to clear cache');
    }
  }, [isCacheAvailable]);

  // Auto-load cached events when going offline
  useEffect(() => {
    if (isOffline && isCacheAvailable && cachedEvents.length === 0) {
      void loadCachedEvents();
    }
  }, [isOffline, isCacheAvailable, cachedEvents.length, loadCachedEvents]);

  return {
    isOffline,
    isUsingCache,
    cachedEvents,
    cacheMetadata,
    isCacheAvailable,
    isCacheValid: cacheValid,
    cacheEvents,
    clearCache,
    loadCachedEvents,
    error,
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Format the last sync time for display
 */
export function formatLastSyncTime(metadata: CalendarCacheMetadata | null): string {
  if (!metadata) return 'Never synced';

  const syncDate = new Date(metadata.lastSyncAt);
  const now = new Date();
  const diffMs = now.getTime() - syncDate.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;

  return syncDate.toLocaleDateString();
}

/**
 * Check if cache should be refreshed
 */
export function shouldRefreshCache(metadata: CalendarCacheMetadata | null, maxAgeMs: number = 3600000): boolean {
  if (!metadata) return true;
  return Date.now() - metadata.lastSyncAt > maxAgeMs;
}
