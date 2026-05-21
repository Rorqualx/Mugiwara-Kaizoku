/**
 * Custom hooks for Wanted functionality
 *
 * Provides reusable hooks for managing wanted items,
 * download history, and blocklist across components.
 */

// Helper functions for safe type handling
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

import { useCallback, useMemo } from 'react';

import { showNotification } from '@mantine/notifications';
import {
  WantedPriority,
  WantedStatus} from
'@prisma/client';

import type { WantedItem } from '@/types/search.types';



import { trpc } from '../utils/trpc-client/index';

// Import types from search.types

type CreateWantedItemDto = {
  mangaId: number;
  chapterId?: number;
  priority?: WantedPriority;
};

// Return type interfaces for hooks
interface UseWantedItemsReturn {
  wantedItems: unknown[];
  missingItems: unknown[];
  stats: {
    total: number;
    pending: number;
    searching: number;
    found: number;
    failed: number;
    highPriority: number;
  };
  isLoadingWanted: boolean;
  isLoadingMissing: boolean;
  wantedError: unknown;
  missingError: unknown;
  addToWanted: (data: CreateWantedItemDto) => Promise<unknown>;
  updatePriority: (id: number, priority: WantedPriority) => Promise<unknown>;
  updateStatus: (id: number, status: WantedStatus) => Promise<unknown>;
  removeFromWanted: (id: number) => Promise<unknown>;
  searchNow: (mangaIds: number[]) => Promise<unknown>;
  searchAll: () => Promise<unknown | undefined>;
  isAdding: boolean;
  isUpdating: boolean;
  isRemoving: boolean;
  isSearching: boolean;
  refreshWanted: () => Promise<unknown>;
  refreshMissing: () => Promise<unknown>;
}

interface UseDownloadHistoryReturn {
  entries: unknown[];
  stats: {
    totalDownloads: number;
    successfulDownloads: number;
    failedDownloads: number;
    successRate: number;
    avgDuration: number;
    avgDurationFormatted: string;
  } | null;
  total: number;
  isLoading: boolean;
  error: unknown;
  refresh: () => Promise<unknown>;
}

/**
 * Hook for managing wanted items
 */
export function useWantedItems(): UseWantedItemsReturn {
  const utils = trpc.useUtils();

  // Queries
  const wantedQuery = trpc.wanted.getWanted.useQuery({
    page: 1,
    pageSize: 100
  });

  const missingQuery = trpc.wanted.getMissing.useQuery({ page: 1, pageSize: 100 });

  // Mutations
  const addToWantedMutation = trpc.wanted.addToWanted.useMutation({
    onSuccess: () => {
      showNotification({
        title: 'Success',
        message: 'Added to wanted list',
        color: 'green'
      });
      // Invalidate queries to refresh data
      void utils.wanted.getWanted.invalidate();
      void utils.wanted.getMissing.invalidate();
    },
    onError: (error) => {
      showNotification({
        title: 'Error',
        message: (error instanceof Error ? error.message : String(error)) || 'Failed to add to wanted list',
        color: 'red'
      });
    }
  });

  const updateWantedMutation = trpc.wanted.updateWanted.useMutation({
    onSuccess: () => {
      showNotification({
        title: 'Success',
        message: 'Updated wanted item',
        color: 'green'
      });
      void utils.wanted.getWanted.invalidate();
    },
    onError: (error) => {
      showNotification({
        title: 'Error',
        message: (error instanceof Error ? error.message : String(error)) || 'Failed to update wanted item',
        color: 'red'
      });
    }
  });

  const removeFromWantedMutation = trpc.wanted.removeFromWanted.useMutation({
    onSuccess: () => {
      showNotification({
        title: 'Success',
        message: 'Removed from wanted list',
        color: 'green'
      });
      void utils.wanted.getWanted.invalidate();
    },
    onError: (error) => {
      showNotification({
        title: 'Error',
        message: (error instanceof Error ? error.message : String(error)) || 'Failed to remove from wanted list',
        color: 'red'
      });
    }
  });

  const searchChaptersMutation = trpc.wanted.searchChapters.useMutation({
    onSuccess: (data) => {
      showNotification({
        title: 'Search initiated',
        message: `Triggered auto-download for ${data.triggered} manga${data.failed > 0 ? ` (${data.failed} failed)` : ''}`,
        color: data.failed > 0 ? 'yellow' : 'blue'
      });
      void utils.wanted.getWanted.invalidate();
      void utils.wanted.getMissing.invalidate();
    },
    onError: (error) => {
      showNotification({
        title: 'Error',
        message: (error instanceof Error ? error.message : String(error)) || 'Failed to initiate search',
        color: 'red'
      });
    }
  });

  // Helper functions
  const addToWanted = useCallback(async (data: CreateWantedItemDto) => {
    return addToWantedMutation.mutateAsync(data);
  }, [addToWantedMutation]);

  const updatePriority = useCallback(async (id: number, priority: WantedPriority) => {
    return updateWantedMutation.mutateAsync({ id, priority });
  }, [updateWantedMutation]);

  const updateStatus = useCallback(async (id: number, status: WantedStatus) => {
    return updateWantedMutation.mutateAsync({ id, status });
  }, [updateWantedMutation]);

  const removeFromWanted = useCallback(async (id: number) => {
    return removeFromWantedMutation.mutateAsync({ id });
  }, [removeFromWantedMutation]);

  const searchNow = useCallback(async (mangaIds: number[]) => {
    return searchChaptersMutation.mutateAsync({ mangaIds });
  }, [searchChaptersMutation]);

  const searchAll = useCallback(async () => {
    const items = wantedQuery.data?.items ?? [];
    if (!Array.isArray(items)) return;

    const pendingMangaIds = items
      .filter((item): item is WantedItem =>
        isRecord(item) &&
        typeof item["status"] === 'string' &&
        item["status"] === WantedStatus.PENDING
      )
      .map((item) => Number(item.mangaId))
      .filter((id): id is number => !isNaN(id));

    const uniqueMangaIds = [...new Set(pendingMangaIds)];
    if (uniqueMangaIds.length > 0) {
      return searchNow(uniqueMangaIds);
    }
  }, [wantedQuery.data, searchNow]);

  // Summary statistics
  const stats = useMemo(() => {
    const rawData = wantedQuery.data as unknown;
    // Type guard for data with items array
    if (!isRecord(rawData) || !Array.isArray(rawData["items"])) {
      return {
        total: 0,
        pending: 0,
        searching: 0,
        found: 0,
        failed: 0,
        highPriority: 0
      };
    }

    const items = rawData["items"] as unknown[];
    const validItems = items.filter((item): item is WantedItem =>
      isRecord(item) &&
      typeof item["status"] === 'string' &&
      typeof item["priority"] === 'string'
    );

    return {
      total: validItems.length,
      pending: validItems.filter((i) => i["status"] === WantedStatus.PENDING).length,
      searching: validItems.filter((i) => i["status"] === WantedStatus.SEARCHING).length,
      found: validItems.filter((i) => i["status"] === WantedStatus.FOUND).length,
      failed: validItems.filter((i) => i["status"] === WantedStatus.FAILED).length,
      highPriority: validItems.filter((i) => i["priority"] === WantedPriority.HIGH).length
    };
  }, [wantedQuery.data]);

  return {
    // Data
    wantedItems: wantedQuery.data?.items ?? [],
    missingItems: missingQuery.data?.items ?? [],
    stats,

    // Loading states
    isLoadingWanted: wantedQuery.isLoading,
    isLoadingMissing: missingQuery.isLoading,

    // Errors
    wantedError: wantedQuery.error,
    missingError: missingQuery.error,

    // Actions
    addToWanted,
    updatePriority,
    updateStatus,
    removeFromWanted,
    searchNow,
    searchAll,

    // Mutations loading states
    isAdding: addToWantedMutation.isPending,
    isUpdating: updateWantedMutation.isPending,
    isRemoving: removeFromWantedMutation.isPending,
    isSearching: searchChaptersMutation.isPending,

    // Refresh functions
    refreshWanted: wantedQuery.refetch,
    refreshMissing: missingQuery.refetch
  };
}

/**
 * Hook for managing download history
 */
export function useDownloadHistory(filters?: {
  status?: string[];
  source?: string[];
  downloadClient?: string[];
  dateRange?: {start: Date;end: Date;};
}): UseDownloadHistoryReturn {
  const query = trpc.wanted.getHistory.useQuery({
    status: filters?.status as ("COMPLETED" | "FAILED" | "CANCELLED" | "PARTIAL")[] | undefined,
    source: filters?.source,
    downloadClient: filters?.downloadClient,
    dateRange: filters?.dateRange,
    page: 1,
    pageSize: 100
  });

  // Calculate additional statistics
  const enhancedStats = useMemo(() => {
    const rawData = query.data as unknown;
    if (!isRecord(rawData)) return null;

    // Extract stats with proper type checking
    const statsData = rawData["stats"] as unknown;
    const totalDownloads = isRecord(statsData) && typeof statsData["totalDownloads"] === 'number' ?
      statsData["totalDownloads"] : 0;
    const successfulDownloads = isRecord(statsData) && typeof statsData["successfulDownloads"] === 'number' ?
      statsData["successfulDownloads"] : 0;
    const failedDownloadsFromStats = isRecord(statsData) && typeof statsData["failedDownloads"] === 'number' ?
      statsData["failedDownloads"] : undefined;

    // Calculate failedDownloads if not provided
    const failedDownloads = failedDownloadsFromStats ?? (totalDownloads - successfulDownloads);

    const successRate = totalDownloads > 0 ?
      (successfulDownloads / totalDownloads * 100) :
      0;

    // Extract entries with proper type checking
    const rawEntries = rawData["entries"] as unknown;
    const entries = Array.isArray(rawEntries) ? rawEntries : [];

    const entriesWithEndTime = entries.filter((e): e is Record<string, unknown> =>
      isRecord(e) && e["endTime"] !== null && e["endTime"] !== undefined
    );

    const avgDuration = entriesWithEndTime.length > 0 ?
      entriesWithEndTime.reduce((acc: number, e) => {
        const endTime = e["endTime"];
        const startTime = e["startTime"];
        if (endTime !== null && endTime !== undefined && startTime !== null && startTime !== undefined) {
          const duration = new Date(endTime as string | Date).getTime() - new Date(startTime as string | Date).getTime();
          return acc + duration;
        }
        return acc;
      }, 0) / entriesWithEndTime.length : 0;

    return {
      totalDownloads,
      successfulDownloads,
      failedDownloads,
      successRate,
      avgDuration,
      avgDurationFormatted: formatDuration(avgDuration)
    };
  }, [query.data]);

  return {
    entries: query.data?.entries ?? [],
    stats: enhancedStats,
    total: query.data?.total ?? 0,
    isLoading: query.isLoading,
    error: query.error,
    refresh: query.refetch
  };
}

// Helper function to format duration
function formatDuration(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}