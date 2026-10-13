/**
 * Mutations behind the manga detail page's actions (monitoring, download,
 * remove, metadata refresh).
 *
 * @module hooks/manga/useMangaDetailMutations
 */

import React from 'react';

import { notifications } from '@mantine/notifications';

import type { QuickDownloadResponse } from '@/types/quickDownload.types';
import type { MangaWithRelations } from '@/types/search.types';
import { logger } from '@/utils/logger';
import { notify } from '@/utils/notify';
import { trpc } from '@/utils/trpc-client';

import { useQuickDownloadToast } from '../useQuickDownloadToast';

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
  resetAllFailedDownloadsMutation: { isPending: boolean };
  clearBlocklistForMangaMutation: { isPending: boolean };
  handleToggleMangaBookmark: () => void;
  handleSeriesQuickDownload: () => void;
  handleResetAllFailed: () => void;
  handleClearBlocklist: () => void;
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

  // Reset every ERROR chapter on the manga back to PENDING + fire a BULK
  // dispatch. Server awaits the dispatch so the success toast reflects what
  // actually happened ("queued N downloads" vs "no sources found") instead
  // of the prior misleading "searching enabled sources…" that left users
  // staring at an empty Jobs > Active table.
  const resetAllFailedDownloadsMutation = trpc.manga.resetAllFailedDownloads.useMutation({
    onSuccess: async (data) => {
      await utils.manga.get.invalidate();
      await refetch();
      notify({
        severity: data.clearedCount === 0 ? 'INFO' : data.queuedCount === 0 ? 'WARNING' : 'SUCCESS',
        title: data.clearedCount === 0 ? 'Nothing to Reset' : data.queuedCount === 0 ? 'Reset Complete' : 'Reset & Dispatched',
        message: data.message,
      });
    },
    onError: (error: unknown) => {
      logger.error('Error resetting all failed downloads:', error);
      notify({
        severity: 'ERROR',
        title: 'Reset Failed',
        message: error instanceof Error ? error.message : 'Failed to reset failed downloads',
      });
    },
  });

  const handleResetAllFailed = (): void => {
    if (!mangaId || !manga) return;
    resetAllFailedDownloadsMutation.mutate({ id: mangaId });
  };

  // Bulk-clear every active ReleaseBlocklist row scoped to this manga.
  // Recovery hatch for the "auto-blocklist starves dispatcher" failure mode:
  // when too many cancelled torrents have piled up as DOWNLOAD_FAILED
  // entries, every remaining Prowlarr candidate gets filtered out and the
  // user sees "no torrents found" forever. One click flips them all
  // inactive — history preserved, but next dispatch sees them as eligible
  // again.
  const clearBlocklistForMangaMutation = trpc.releaseBlocklist.clearForManga.useMutation({
    onSuccess: async (data) => {
      // Refresh the count query so the header icon hides itself when the
      // operation succeeded and there's nothing left to clear.
      await utils.releaseBlocklist.countForManga.invalidate();
      notify({
        severity: data.clearedCount === 0 ? 'INFO' : 'SUCCESS',
        title: data.clearedCount === 0 ? 'Nothing to Clear' : 'Blocklist Cleared',
        message: data.clearedCount === 0
          ? 'No active blocklist entries for this series'
          : `Cleared ${data.clearedCount} blocklist entr${data.clearedCount === 1 ? 'y' : 'ies'} — try resetting failed downloads again`,
      });
    },
    onError: (error: unknown) => {
      logger.error('Error clearing manga blocklist:', error);
      notify({
        severity: 'ERROR',
        title: 'Clear Blocklist Failed',
        message: error instanceof Error ? error.message : 'Failed to clear blocklist',
      });
    },
  });

  const handleClearBlocklist = (): void => {
    if (!mangaId || !manga) return;
    // Confirm dialog so a stray click doesn't wipe the user's curated
    // blocklist. window.confirm is the existing pattern in the codebase
    // (see deleteAllCompleted in active.tsx).
    if (typeof window !== 'undefined' &&
        !window.confirm('Clear every blocklist entry for this series? Cancelled/failed releases will become eligible again.')) {
      return;
    }
    clearBlocklistForMangaMutation.mutate({ mangaId });
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
    resetAllFailedDownloadsMutation,
    clearBlocklistForMangaMutation,
    handleToggleMangaBookmark,
    handleSeriesQuickDownload,
    handleResetAllFailed,
    handleClearBlocklist
  };
}
