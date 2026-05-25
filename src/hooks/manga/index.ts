/**
 * Manga Detail Page Hooks
 *
 * Custom hooks for the manga detail page component decomposition.
 * These hooks encapsulate state management, data fetching, and business logic
 * for the manga detail page.
 *
 * @module hooks/manga
 */

import React from 'react';

import { notifications } from '@mantine/notifications';
import { useRouter } from 'next/router';

import { useRealTime } from '@/providers/RealTimeProvider';
import type { QuickDownloadResponse } from '@/types/quickDownload.types';
import type { MangaWithRelations } from '@/types/search.types';
import { logger } from '@/utils/logger';
import { notify } from '@/utils/notify';
import { trpc } from '@/utils/trpc-client';
import { isObject } from '@/utils/type-guards';

import { useQuickDownloadToast } from '../useQuickDownloadToast';

import { extractMergedMetadata } from './metadata-extraction';

import type { Chapter } from '@prisma/client';

// Re-export the centralized state management hook
export { useMangaDetailPageState } from './useMangaDetailPageState';
export type { MangaDetailPageState } from './useMangaDetailPageState';

// Re-export chapter updates hook for real-time updates
export { useChapterUpdates, showChapterScrapingNotification } from './useChapterUpdates';

// No chapter limit - manga like One Piece have 1000+ chapters
// When chapterLimit is 0 or undefined, the server returns all chapters
const DEFAULT_CHAPTER_LIMIT = 0;

/**
 * Return type for useMangaDetailModals hook
 */
interface MangaDetailModalsReturn {
  isAniListModalOpen: boolean;
  setIsAniListModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isComicVineModalOpen: boolean;
  setIsComicVineModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isFandomModalOpen: boolean;
  setIsFandomModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isWikipediaModalOpen: boolean;
  setIsWikipediaModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isMangaDexModalOpen: boolean;
  setIsMangaDexModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isMangaUpdatesModalOpen: boolean;
  setIsMangaUpdatesModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isMalModalOpen: boolean;
  setIsMalModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isKitsuModalOpen: boolean;
  setIsKitsuModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isProviderMetadataModalOpen: boolean;
  setIsProviderMetadataModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isCoverSelectorOpen: boolean;
  setIsCoverSelectorOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isDetailsExpanded: boolean;
  setIsDetailsExpanded: React.Dispatch<React.SetStateAction<boolean>>;
  isProvidersExpanded: boolean;
  setIsProvidersExpanded: React.Dispatch<React.SetStateAction<boolean>>;
  chapterModalOpened: boolean;
  setChapterModalOpened: React.Dispatch<React.SetStateAction<boolean>>;
  selectedChapter: Chapter | null;
  setSelectedChapter: React.Dispatch<React.SetStateAction<Chapter | null>>;
  initialModalTab: 'details' | 'search';
  setInitialModalTab: React.Dispatch<React.SetStateAction<'details' | 'search'>>;
}

/**
 * Hook for managing all modal and expansion state in the manga detail page
 */
export function useMangaDetailModals(): MangaDetailModalsReturn {
  const [isAniListModalOpen, setIsAniListModalOpen] = React.useState(false);
  const [isComicVineModalOpen, setIsComicVineModalOpen] = React.useState(false);
  const [isFandomModalOpen, setIsFandomModalOpen] = React.useState(false);
  const [isWikipediaModalOpen, setIsWikipediaModalOpen] = React.useState(false);
  const [isMangaDexModalOpen, setIsMangaDexModalOpen] = React.useState(false);
  const [isMangaUpdatesModalOpen, setIsMangaUpdatesModalOpen] = React.useState(false);
  const [isMalModalOpen, setIsMalModalOpen] = React.useState(false);
  const [isKitsuModalOpen, setIsKitsuModalOpen] = React.useState(false);
  const [isProviderMetadataModalOpen, setIsProviderMetadataModalOpen] = React.useState(false);
  const [isCoverSelectorOpen, setIsCoverSelectorOpen] = React.useState(false);
  const [isDetailsExpanded, setIsDetailsExpanded] = React.useState(false);
  const [isProvidersExpanded, setIsProvidersExpanded] = React.useState(false);
  const [chapterModalOpened, setChapterModalOpened] = React.useState(false);
  const [selectedChapter, setSelectedChapter] = React.useState<Chapter | null>(null);
  const [initialModalTab, setInitialModalTab] = React.useState<'details' | 'search'>('details');

  return {
    isAniListModalOpen,
    setIsAniListModalOpen,
    isComicVineModalOpen,
    setIsComicVineModalOpen,
    isFandomModalOpen,
    setIsFandomModalOpen,
    isWikipediaModalOpen,
    setIsWikipediaModalOpen,
    isMangaDexModalOpen,
    setIsMangaDexModalOpen,
    isMangaUpdatesModalOpen,
    setIsMangaUpdatesModalOpen,
    isMalModalOpen,
    setIsMalModalOpen,
    isKitsuModalOpen,
    setIsKitsuModalOpen,
    isProviderMetadataModalOpen,
    setIsProviderMetadataModalOpen,
    isCoverSelectorOpen,
    setIsCoverSelectorOpen,
    isDetailsExpanded,
    setIsDetailsExpanded,
    isProvidersExpanded,
    setIsProvidersExpanded,
    chapterModalOpened,
    setChapterModalOpened,
    selectedChapter,
    setSelectedChapter,
    initialModalTab,
    setInitialModalTab
  };
}

/**
 * Hook for fetching manga data with loading state and timeout
 *
 * @param mangaId - The ID of the manga to fetch
 * @param _isLoading - Loading state from parent (not used in this implementation)
 * @returns Object containing manga data, loading timeout flag, refetch function, and auto-download config
 */
interface MangaDetailDataReturn {
  manga: MangaWithRelations | null;
  loadingTimeout: boolean;
  refetch: () => Promise<void>;
  autoDownloadConfig: null;
  /** True when the query is actively fetching data (initial load or refetch) */
  isQueryLoading: boolean;
  /** Whether real-time updates are active */
  isRealtime: boolean;
}

export function useMangaDetailData(mangaId: number | undefined, _isLoading: boolean): MangaDetailDataReturn {
  const [loadingTimeout, setLoadingTimeout] = React.useState(false);
  const _router = useRouter();

  // Get WebSocket connection status for real-time updates
  const { isConnected, subscribe } = useRealTime();

  // Fetch manga data using tRPC with WebSocket-aware polling
  // When WebSocket is connected: no polling (real-time updates via subscription)
  // When WebSocket is disconnected: fallback to 60s polling
  const mangaQuery = trpc.manga.get.useQuery(
    {
      id: mangaId ?? 0,
      chapterLimit: DEFAULT_CHAPTER_LIMIT
    },
    {
      enabled: mangaId !== undefined && mangaId > 0,
      retry: false,
      refetchOnWindowFocus: false,
      refetchInterval: isConnected ? false : 60000, // 60s fallback when disconnected
      // Allow client-side caching for 30s to avoid refetch when navigating back
      // Real-time WebSocket updates still trigger refetch immediately when data changes
      staleTime: 30_000, // Consider data fresh for 30 seconds
      gcTime: 300_000, // Keep unused data in cache for 5 minutes
    }
  );

  // Store refetch in ref to avoid dependency changes causing infinite loops
  const refetchRef = React.useRef(mangaQuery.refetch);
  React.useEffect(() => {
    refetchRef.current = mangaQuery.refetch;
  }, [mangaQuery.refetch]);

  // Subscribe to manga-specific WebSocket channel for real-time updates
  React.useEffect(() => {
    if (!isConnected || !mangaId) return;

    // Subscribe to manga updates (metadata, status changes)
    const unsubscribeManga = subscribe(`manga:${mangaId}:updates`, () => {
      logger.debug(`useMangaDetailData: Received manga:${mangaId}:updates event, refetching...`);
      void refetchRef.current();
    });

    // Subscribe to chapter updates (downloads, status changes)
    const unsubscribeChapters = subscribe(`manga:${mangaId}:chapters`, () => {
      logger.debug(`useMangaDetailData: Received manga:${mangaId}:chapters event, refetching...`);
      void refetchRef.current();
    });

    return () => {
      unsubscribeManga();
      unsubscribeChapters();
    };
  }, [isConnected, subscribe, mangaId]);

  // Set loading timeout after 20 seconds
  // This is a soft timeout - the query will continue loading
  // and eventually succeed, this just triggers the timeout UI state
  React.useEffect(() => {
    if (mangaQuery.isPending) {
      const timeout = setTimeout(() => {
        setLoadingTimeout(true);
        logger.debug(`Manga ${mangaId ?? 'unknown'} loading slow (>20s)`);
      }, 20000);

      return () => {
        clearTimeout(timeout);
      };
    } else {
      setLoadingTimeout(false);
    }
  }, [mangaQuery.isPending, mangaId]);

  // Only show loading on initial fetch (no cached data yet), not on background refetches.
  // Using isFetching here caused the page to unmount modals every 60s when polling was active.
  const hasValidMangaId = mangaId !== undefined && mangaId > 0;
  const isWaitingForData = !hasValidMangaId ||
    mangaQuery.isPending;

  return {
    // Return query data directly - the query key includes mangaId so each manga gets its own cache entry
    manga: mangaQuery.data ?? null,
    loadingTimeout,
    refetch: async (): Promise<void> => {
      await mangaQuery.refetch();
    },
    autoDownloadConfig: null, // TODO: Fetch auto-download config when available
    // Show loading when waiting for data
    isQueryLoading: isWaitingForData,
    // Real-time status
    isRealtime: isConnected,
  };
}

/**
 * Hook for extracting and merging metadata from provider metadata and Metadata relation.
 *
 * When Metadata.source === 'merged', Metadata model is the primary source of truth.
 * Otherwise, providerMetadata JSON takes priority and Metadata fills gaps.
 */
export function useMangaMetadataExtraction(manga: MangaWithRelations | null): unknown {
  return React.useMemo(() => {
    if (!manga) return null;
    return extractMergedMetadata(manga);
  }, [manga]);
}

/**
 * Checks if an item in a provider metadata array matches a provider ID
 */
function isMatchingProviderItem(item: unknown, providerId: string): boolean {
  if (!isObject(item)) return false;
  const provider = item as Record<string, unknown>;
  return typeof provider['providerId'] === 'string' && provider['providerId'] === providerId;
}

/**
 * URL patterns for detecting legacy provider bindings via Metadata.urls
 */
const PROVIDER_URL_PATTERNS: Record<string, RegExp> = {
  anilist: /anilist\.co/,
  comicvine: /comicvine\.gamespot\.com/,
  fandom: /\.fandom\.com/,
  wikipedia: /wikipedia\.org/,
  mangadex: /mangadex\.org/
};

/**
 * Parse providerMetadata, handling both string (double-serialized) and object formats.
 */
function parseProviderMetadata(raw: unknown): unknown {
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as unknown;
    } catch {
      return null;
    }
  }
  return raw;
}

/**
 * Determines if a provider is bound to a manga by checking all data sources
 */
function checkProviderBound(manga: MangaWithRelations, providerId: string): boolean {
  // Check providerMetadata - handle both string and object formats
  if (manga.providerMetadata) {
    const parsed = parseProviderMetadata(manga.providerMetadata);
    if (Array.isArray(parsed)) {
      if (parsed.some((item: unknown) => isMatchingProviderItem(item, providerId))) return true;
    } else if (isObject(parsed) && providerId in (parsed as Record<string, unknown>)) {
      return true;
    }
  }

  // Legacy detection: check Metadata.urls for provider-specific URLs
  const urls = manga.Metadata?.urls;
  if (urls && Array.isArray(urls)) {
    const pattern = PROVIDER_URL_PATTERNS[providerId];
    if (pattern && urls.some((url: unknown) => typeof url === 'string' && pattern.test(url))) return true;
  }

  // Legacy AniList: check selectedSourceId for numeric AniList ID
  if (providerId === 'anilist' && manga.selectedSourceId && /^\d+$/.test(String(manga.selectedSourceId))) {
    return true;
  }

  return false;
}

/**
 * Hook for checking if metadata providers are bound to the manga
 *
 * @param manga - The manga entity with relations
 * @returns Object with isProviderBound function
 */
interface MangaProviderCheckReturn {
  isProviderBound: (providerId: string) => boolean;
}

export function useMangaProviderCheck(manga: MangaWithRelations | null): MangaProviderCheckReturn {
  return React.useMemo(() => ({
    isProviderBound: (providerId: string): boolean => {
      if (!manga) return false;
      return checkProviderBound(manga, providerId);
    }
  }), [manga]);
}

/**
 * Type-safe mutation result interface for tRPC mutations
 * This avoids TypeScript inference issues with ReturnType<typeof>
 * Using unknown for error to be compatible with TRPCClientErrorBase
 */
interface TRPCMutationResult<TData = unknown, TVariables = unknown> {
  mutate: (variables: TVariables) => void;
  mutateAsync: (variables: TVariables) => Promise<TData>;
  isPending: boolean;
  isIdle: boolean;
  isSuccess: boolean;
  isError: boolean;
  error: unknown;
  data: TData | undefined;
  reset: () => void;
  status: 'idle' | 'pending' | 'success' | 'error';
  trpc: {
    path: string;
  };
}

/** Result type for toggle series monitoring */
interface ToggleSeriesMonitoringResult {
  success: boolean;
  monitored: boolean;
  updatedCount: number;
}

/** Result type for download operations */
interface DownloadResult {
  success: boolean;
  message: string;
}

/** Result type for remove operation */
interface RemoveResult {
  success: boolean;
  message: string;
}

/**
 * Options interface for useMangaDetailMutations hook
 */
interface UseMangaDetailMutationsOptions {
  mangaId: number | undefined;
  manga: MangaWithRelations | null;
  utils: ReturnType<typeof trpc.useUtils>;
  refetch: () => Promise<void>;
  setRefreshCounter: React.Dispatch<React.SetStateAction<number>>;
  allMonitored: boolean;
  someMonitored: boolean;
  noneMonitored: boolean;
}

/**
 * Return type for useMangaDetailMutations hook
 */
interface MangaDetailMutationsReturn {
  toggleSeriesMonitoringMutation: TRPCMutationResult<ToggleSeriesMonitoringResult, { mangaId: number; monitored: boolean }>;
  seriesQuickDownloadMutation: { isPending: boolean };
  removeMangaMutation: TRPCMutationResult<RemoveResult, { id: number; shouldRemoveFiles?: boolean }>;
  downloadMutation: TRPCMutationResult<DownloadResult, { mangaId: number; chapterIndex?: number }>;
  refreshMetadataMutation: TRPCMutationResult<MangaWithRelations | null, { id: number; forceRefresh?: boolean }>;
  handleToggleMangaBookmark: () => void;
  handleSeriesQuickDownload: () => void;
}

/** Typed shims for tRPC mutations to pass to extracted helpers without complex generics */
interface RefreshMutationShim {
  mutate: (
    variables: { id: number; forceRefresh: boolean },
    options?: { onSuccess?: () => void; onError?: (err: unknown) => void }
  ) => void;
}
interface BulkDownloadMutationShim {
  mutate: (
    variables: { mangaId: number; chapterIds: number[]; mode: string },
    options?: { onSettled?: () => void }
  ) => void;
}
interface UtilsLike { manga: { get: { invalidate: () => Promise<void> } } }

/** Auto-refresh metadata when chapters are missing, then notify user to retry download */
function triggerMetadataRefreshBeforeDownload(
  mangaId: number,
  refreshMutation: RefreshMutationShim,
  utils: UtilsLike
): void {
  const notifId = `quick-download-series-${mangaId}`;
  notifications.show({ id: notifId, title: 'Refreshing Metadata...', message: 'No chapters found — fetching metadata before download...', loading: true, autoClose: false });
  refreshMutation.mutate({ id: mangaId, forceRefresh: true }, {
    onSuccess: () => { notifications.hide(notifId); void utils.manga.get.invalidate(); notify({ severity: 'INFO', title: 'Metadata Refreshed', message: 'Chapters populated — click download again.' }); },
    onError: (err: unknown) => { notifications.hide(notifId); notify({ severity: 'ERROR', title: 'Metadata Refresh Failed', message: err instanceof Error ? err.message : 'Failed' }); }
  });
}

/** Start BULK download for a list of chapter IDs */
function startBulkDownload(
  mangaId: number,
  chapterIds: number[],
  mutation: BulkDownloadMutationShim
): void {
  const notifId = `quick-download-series-${mangaId}`;
  notifications.show({ id: notifId, title: 'Searching…', message: `Searching enabled sources for ${chapterIds.length} chapters…`, loading: true, autoClose: false });
  mutation.mutate({ mangaId, chapterIds, mode: 'BULK' }, { onSettled: () => { notifications.hide(notifId); } });
}

/**
 * Hook for all mutations and handlers for the manga detail page
 *
 * @param options - Configuration options for the mutations hook
 * @param options.mangaId - The ID of the manga
 * @param options.manga - The manga entity with relations
 * @param options.utils - tRPC utils for cache invalidation
 * @param options.refetch - Function to refetch manga data
 * @param options.setRefreshCounter - State setter for refresh counter
 * @param options.allMonitored - Whether every chapter is currently monitored
 * @param options.someMonitored - Whether at least one (but not all) chapter is monitored
 * @param options.noneMonitored - Whether no chapter is monitored (kept for symmetry with caller)
 * @returns Object containing all mutations and handlers
 */
export function useMangaDetailMutations(options: UseMangaDetailMutationsOptions): MangaDetailMutationsReturn {
  const {
    mangaId,
    manga,
    utils,
    refetch,
    setRefreshCounter,
    allMonitored,
    someMonitored,
    // noneMonitored intentionally not destructured — derivable from !(all || some)
  } = options;

  // Live-update the series quick-download toast as the unified auto-search
  // fan-out (MangaDex / Suwayomi / Prowlarr / GetComics) reports per-source results.
  useQuickDownloadToast(mangaId, mangaId ? `quick-download-series-${mangaId}` : null);

  // Toggle series monitoring mutation
  const toggleSeriesMonitoringMutation = trpc.manga.toggleSeriesMonitoring.useMutation({
    onSuccess: async () => {
      await utils.manga.get.invalidate();
      await refetch();
      notify({ severity: 'SUCCESS', title: 'Series Monitoring Updated', message: 'Series monitoring status has been updated successfully' });
    },
    onError: (error: unknown) => {
      logger.error('Error toggling series monitoring:', error);
      notify({ severity: 'ERROR', title: 'Error', message: error instanceof Error ? error.message : 'Failed to update series monitoring' });
    }
  });

  // Series quick download mutation (uses BULK mode to search all chapters).
  //
  // The server emits per-chapter rolling rows ("{Title} — Ch N — Searching…"
  // → "Found {source} — downloading" / "No source found") into the bell as
  // the dispatch progresses, so the summary toast here is transient-only
  // (persist: false) — it would otherwise duplicate the per-chapter rows.
  const seriesTitle = manga?.title;
  const seriesQuickDownloadMutation = trpc.manga.quickDownloadWithSearch.useMutation({
    onSuccess: async (data) => {
      await utils.manga.get.invalidate();
      const typedData = data as QuickDownloadResponse;
      const { summary } = typedData;
      const subject = seriesTitle ?? 'Series';
      if (summary.started > 0) {
        notify({ severity: 'SUCCESS', persist: false, title: `${subject} download started`, message: `${summary.started} of ${summary.total} chapters queued — watch the bell for per-chapter status` });
      } else if (summary.noResults > 0) {
        notify({ severity: 'WARNING', persist: false, title: `${subject}: no results`, message: `No matching releases found for ${summary.noResults} chapters` });
      } else {
        notify({ severity: 'ERROR', persist: false, title: `${subject}: download failed`, message: `Failed to find downloadable releases (${summary.failed} failed)` });
      }
    },
    onError: (error: unknown) => {
      logger.error('Error starting series download:', error);
      notify({ severity: 'ERROR', title: 'Error', message: error instanceof Error ? error.message : 'Failed to start series download' });
    }
  });

  // Remove manga mutation
  // Note: Navigation and notifications are handled by the caller (manga-detail-handlers.ts)
  // to allow proper redirect to library page instead of always going home
  const removeMangaMutation = trpc.manga.remove.useMutation({
    onSuccess: () => {
      // Non-blocking cache invalidation - don't await
      void utils.manga.invalidate();
    },
    onError: (error: unknown) => {
      logger.error('Error removing manga:', error);
      notify({ severity: 'ERROR', title: 'Error', message: error instanceof Error ? error.message : 'Failed to remove manga' });
    }
  });

  // Download mutation
  const downloadMutation = trpc.manga.download.useMutation({
    onSuccess: async () => {
      await utils.manga.get.invalidate();
      notify({ severity: 'SUCCESS', title: 'Download Started', message: 'Download has been queued successfully' });
    },
    onError: (error: unknown) => {
      logger.error('Error starting download:', error);
      notify({ severity: 'ERROR', title: 'Error', message: error instanceof Error ? error.message : 'Failed to start download' });
    }
  });

  // Refresh metadata mutation
  const refreshMetadataMutation = trpc.manga.refreshMetaData.useMutation({
    onSuccess: async () => {
      await utils.manga.get.invalidate();
      await refetch();
      setRefreshCounter((prev: number) => prev + 1);
      notify({ severity: 'SUCCESS', title: 'Metadata Refreshed', message: 'Manga metadata has been refreshed successfully' });
    },
    onError: (error: unknown) => {
      logger.error('Error refreshing metadata:', error);
      notify({ severity: 'ERROR', title: 'Error', message: error instanceof Error ? error.message : 'Failed to refresh metadata' });
    }
  });

  // Sonarr-style "subscribe to series" toggle. The header bookmark fires
  // this in parallel with toggleSeriesMonitoring so one click flips both:
  //   1. Every chapter's monitored flag (per-chapter watchlist)
  //   2. AutoDownloadRule.enabled (periodic indexer checks + auto-download
  //      of new releases as they hit)
  // No notification here — toggleSeriesMonitoring's onSuccess fires the
  // single visible toast for the combined action. Errors are logged so a
  // partial failure (subscription succeeds, monitoring fails or vice
  // versa) doesn't go entirely silent in the bell.
  const toggleSubscriptionMutation = trpc.manga.toggleMonitoring.useMutation({
    onSuccess: (_data, variables) => {
      // Keep the AutoDownloadModal in sync if the user opens it after toggling
      void utils.manga.getAutoDownloadConfig.invalidate({ mangaId: variables.mangaId });
    },
    onError: (error: unknown) => {
      logger.error('Error toggling manga subscription:', error);
      notify({ severity: 'WARNING', title: 'Subscription Update Failed', message: error instanceof Error ? error.message : 'Failed to update auto-download subscription' });
    }
  });

  // Header bookmark toggles the whole series. Sonarr-style: if any chapter
  // is monitored (all OR some), the icon is "filled" and clicking it disables
  // every chapter + the auto-download subscription; if none are monitored,
  // clicking enables both. Previously this was a stub that only fired an
  // INFO toast — the server-side toggleSeriesMonitoring mutation was defined
  // but never invoked, which is why the bookmark stayed unchanged after click.
  const handleToggleMangaBookmark = (): void => {
    if (!mangaId || !manga) return;
    const target = !(allMonitored || someMonitored);
    toggleSeriesMonitoringMutation.mutate({ mangaId, monitored: target });
    toggleSubscriptionMutation.mutate({ mangaId, enabled: target });
  };

  // Handler for series quick download — downloads all chapters via BULK mode
  // Auto-refreshes metadata if no chapters exist before searching
  const handleSeriesQuickDownload = (): void => {
    if (!mangaId || !manga) return;

    const chapterIds = manga.Chapter.map(ch => ch.id);
    if (chapterIds.length === 0) {
      triggerMetadataRefreshBeforeDownload(mangaId, refreshMetadataMutation as unknown as RefreshMutationShim, utils);
      return;
    }

    startBulkDownload(mangaId, chapterIds, seriesQuickDownloadMutation as unknown as BulkDownloadMutationShim);
  };

  return {
    toggleSeriesMonitoringMutation,
    seriesQuickDownloadMutation,
    removeMangaMutation,
    downloadMutation,
    refreshMetadataMutation,
    handleToggleMangaBookmark,
    handleSeriesQuickDownload
  };
}
