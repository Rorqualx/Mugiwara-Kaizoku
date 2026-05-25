/**
 * Manga Detail Page Component
 *
 * A comprehensive view for displaying and managing manga information. This component
 * serves as the main interface for interacting with individual manga entries.
 *
 * Features:
 * - Dynamic metadata display with cover art and basic information
 * - Real-time monitoring status controls
 * - Volume and chapter management with download tracking
 * - Integration with multiple metadata providers (AniList, ComicVine, etc.)
 * - Responsive layout with mobile optimization
 *
 * State Management:
 * - Local state for UI elements (expanded descriptions, monitoring status)
 * - Server sync for persistent changes
 * - Real-time updates through tRPC mutations
 *
 * @module pages/manga/[id]
 * @requires @mantine/core - UI components and theming
 * @requires @tabler/icons-react - Icon components
 * @requires @/utils/trpcClient - Type-safe API client
 * @requires @/hooks/* - Custom hooks for manga management
 * @requires @/types/domain-types - Domain type definitions
 */

// ===== React =====
import React from "react";

// ===== External Libraries =====
import { Box, Center, ScrollArea, Stack, Text, Title } from "@mantine/core";
import { useRouter } from "next/router";

// ===== Internal Imports =====
import { ResponsiveMainLayout } from '@/components/layouts/ResponsiveMainLayout';
import { MangaActionBar } from '@/components/manga/MangaActionBar';
import { MangaBannerSection } from '@/components/manga/MangaBannerSection';
import { MangaDetailModals } from '@/components/manga/MangaDetailModals';
import { MangaLoadingStates } from '@/components/manga/MangaLoadingStates';
import { ResponsiveChapterList } from '@/components/manga/ResponsiveChapterList';
import { ResponsiveMangaDetail } from '@/components/manga/ResponsiveMangaDetail';
import { createMangaDetailHandlers } from '@/components/manga/utils/manga-detail-handlers';
import { useRemoveModal } from '@/components/removeManga';
import { useMangaDetailModals, useMangaDetailData, useMangaMetadataExtraction, useMangaProviderCheck, useMangaDetailMutations, useChapterUpdates, showChapterScrapingNotification } from '@/hooks/manga';
import { useComicIssuePopulation } from '@/hooks/manga/useComicIssuePopulation';
import { useBreakpoint } from '@/hooks/mobile/useBreakpoint';
import { useManga } from '@/hooks/useManga';
import { useNotification } from '@/hooks/useNotification';
import type { MangaMetadata } from '@/types/search-types/core-search.types';
import { toNumberId } from '@/utils/id-converters';
import { logger } from '@/utils/logger';
import { notify } from '@/utils/notify';
import { trpc } from '@/utils/trpc-client';

// ===== Type Imports =====
import type { Library } from '@prisma/client';

// ===== Component Implementation =====
export default function MangaDetailPage(): React.ReactElement {
    // Modal and expansion state management
    const {
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
    } = useMangaDetailModals();

    // Other state
    const router = useRouter();
    const { id } = router.query;
    const utils = trpc.useUtils();
    const { isMobile } = useBreakpoint();
    // Safely convert ID to a number for the API
    // ID type (string | number) is supported by the AsyncResult pattern in the API
    // We convert to number here because some specific functions may expect a numeric ID
    const mangaId = typeof id === 'string' ? toNumberId(id) : undefined;
    const { showSuccess, showError } = useNotification();
    const { handleUpdateManga, isLoading } = useManga();

    // Refresh counter to force component updates after bookmark changes
    const [refreshCounter, setRefreshCounter] = React.useState(0);

    // Fetch manga data with anti-auto-refresh configuration
    const { manga, loadingTimeout, refetch, autoDownloadConfig: _autoDownloadConfig, isQueryLoading } = useMangaDetailData(mangaId, isLoading);

    // For ComicVine comicbook series with no chapters yet, lazily fetch issues
    // and persist them as Chapter rows on first detail-page view.
    useComicIssuePopulation(manga as Parameters<typeof useComicIssuePopulation>[0], refetch);

    // Extract and merge metadata from provider metadata
    const extractedMetadata = useMangaMetadataExtraction(manga);

    // Check if metadata providers are bound to the manga
    const { isProviderBound } = useMangaProviderCheck(manga);

    // Subscribe to real-time chapter updates
    // When chapters are created in the background, this will trigger a refetch and notification
    const { isConnected } = useChapterUpdates({
        mangaId,
        onChaptersUpdated: async () => {
            await refetch();
            setRefreshCounter((prev: number) => prev + 1);
        }
    });

    // Extract query param for dependency tracking
    const newQueryParam = router.query['new'];

    // Show warning notification when navigating from add manga flow (chapters may be scraping)
    React.useEffect(() => {
        const isNewManga = newQueryParam === '1';
        if (isNewManga && manga?.title) {
            // Show the scraping warning notification
            showChapterScrapingNotification(manga.title);

            // Remove the query param from URL without triggering navigation
            // This prevents showing the notification again on page refresh
            const { new: _, ...queryWithoutNew } = router.query;
            void router.replace(
                { pathname: router.pathname, query: queryWithoutNew },
                undefined,
                { shallow: true }
            );
        }
    }, [newQueryParam, manga?.title, router]);

    // Polling fallback for newly added manga with no chapters
    // Only used when WebSocket is disconnected - otherwise useChapterUpdates handles updates
    const [isPollingForChapters, setIsPollingForChapters] = React.useState(false);
    const pollingCountRef = React.useRef(0);

    React.useEffect(() => {
        // Start polling if this is a new manga with no chapters AND WebSocket is disconnected
        if (newQueryParam === '1' && manga && (manga.Chapter?.length ?? 0) === 0 && !isConnected) {
            setIsPollingForChapters(true);
            pollingCountRef.current = 0;
        }
        // Stop polling if WebSocket becomes connected (useChapterUpdates will handle updates)
        if (isConnected && isPollingForChapters) {
            setIsPollingForChapters(false);
            logger.info('[MangaDetailPage] WebSocket connected, stopping polling fallback');
        }
    }, [newQueryParam, manga, isConnected, isPollingForChapters]);

    React.useEffect(() => {
        if (!isPollingForChapters || isConnected) return; // Skip polling when WebSocket is connected

        // Stop polling if chapters are now available
        const chapterCount = manga?.Chapter?.length ?? 0;
        if (chapterCount > 0) {
            setIsPollingForChapters(false);
            logger.info('[MangaDetailPage] Chapters detected, stopping polling');
            return;
        }

        // Stop after 12 attempts (60 seconds total)
        if (pollingCountRef.current >= 12) {
            setIsPollingForChapters(false);
            logger.info('[MangaDetailPage] Polling timeout, stopping');
            return;
        }

        const pollInterval = setInterval(() => {
            pollingCountRef.current += 1;
            logger.info(`[MangaDetailPage] Polling for chapters (attempt ${pollingCountRef.current})`);
            void refetch();
        }, 5000); // Poll every 5 seconds

        return () => {
            clearInterval(pollInterval);
        };
    }, [isPollingForChapters, manga?.Chapter?.length, refetch, isConnected]);

    // NOTE: Monitoring state and auto download config are now fetched via useMangaDetailData hook

    // Derive monitoring statistics directly from chapter data (single source of truth)
    // Memoized to avoid recomputing on every render for 1000+ chapter manga
    const { totalChapters, monitoredCount, allMonitored, someMonitored, noneMonitored } = React.useMemo(() => {
        const total = manga?.Chapter?.length ?? 0;
        const monitored = manga?.Chapter?.filter(ch => ch.monitored).length ?? 0;
        return {
            totalChapters: total,
            monitoredCount: monitored,
            allMonitored: total > 0 && monitored === total,
            someMonitored: monitored > 0 && monitored < total,
            noneMonitored: monitored === 0,
        };
    }, [manga?.Chapter]);

    // All mutations and handlers for the manga detail page
    const {
        toggleSeriesMonitoringMutation,
        seriesQuickDownloadMutation,
        removeMangaMutation,
        downloadMutation,
        refreshMetadataMutation,
        handleToggleMangaBookmark,
        handleSeriesQuickDownload
    } = useMangaDetailMutations({
        mangaId,
        manga,
        utils,
        refetch,
        setRefreshCounter,
        allMonitored,
        someMonitored,
        noneMonitored
    });
    // Create all handlers using the factory
    const handlers = createMangaDetailHandlers({
        mangaId,
        manga,
        libraryId: manga?.libraryId,
        showSuccess,
        showError,
        removeMangaMutation,
        downloadMutation,
        router,
        setSelectedChapter,
        setInitialModalTab,
        setChapterModalOpened,
    });

    const {
        handleRemoveManga,
        handleToggleMonitoring,
        handleAutoSearch,
        handleManualSearch,
        handleDownloadChapters,
    } = handlers;

    // Create the remove modal hook
    const openRemoveModal = useRemoveModal(manga?.title ?? '', (shouldRemoveFiles: boolean) => {
        void handleRemoveManga(shouldRemoveFiles);
    });

    // Memoize chapter stats for action bar to avoid iterating 1000+ chapters on every render
    const { downloadedChapters, readChapters, _totalSize } = React.useMemo(() => {
        const chapters = manga?.Chapter;
        if (!chapters || chapters.length === 0) {
            return { downloadedChapters: 0, readChapters: 0, _totalSize: 0 };
        }
        let downloaded = 0;
        let read = 0;
        let size = 0;
        for (const ch of chapters) {
            if (ch.downloadStatus === 'COMPLETED') downloaded++;
            if (ch.isRead) read++;
            if (typeof ch.size === 'number') size += ch.size;
        }
        return { downloadedChapters: downloaded, readChapters: read, _totalSize: size };
    }, [manga?.Chapter]);
    // Handle loading and error states
    // Use query loading state to correctly show loading spinner during initial fetch
    const loadingStateResult = MangaLoadingStates({ isLoading: isQueryLoading, loadingTimeout, manga });
    if (loadingStateResult !== null) {
        return loadingStateResult;
    }

    // Guard against null manga - should not happen after loading states check
    if (!manga) {
        return <Center h="100vh"><Text>Manga data not available</Text></Center>;
    }

    // Use responsive component on mobile
    if (isMobile) {
        return <ResponsiveMangaDetail manga={manga} {...(mangaId !== undefined ? { mangaId } : {})} isLoading={isLoading} error={null} onToggleMonitoring={(monitored) => {
                void (async () => {
                    if (mangaId === undefined || mangaId === null || isNaN(mangaId))
                        return;
                    const safeMangaId: number = mangaId;
                    try {
                        const monitoringConfig = manga.monitoringConfig;
                        const notifyOnNew = monitoringConfig && typeof monitoringConfig === 'object' && 'notifyOnNew' in monitoringConfig
                            ? Boolean((monitoringConfig as Record<string, unknown>)['notifyOnNew'])
                            : false;
                        const autoDownload = monitoringConfig && typeof monitoringConfig === 'object' && 'autoDownload' in monitoringConfig
                            ? Boolean((monitoringConfig as Record<string, unknown>)['autoDownload'])
                            : false;
                        await handleUpdateManga(safeMangaId, {
                            title: manga.title,
                            monitoringConfig: {
                                isMonitored: monitored,
                                interval: monitored ? 'daily' : 'never',
                                notifyOnNew,
                                autoDownload
                            }
                        });
                        showSuccess({
                            title: monitored ? "Monitoring Enabled" : "Monitoring Disabled",
                            message: `${manga.title} is now ${monitored ? 'being monitored for new chapters' : 'no longer being monitored'}`
                        });
                        void refetch();
                    }
                    catch (error: unknown) {
                        showError({
                            title: "Update Failed",
                            message: error instanceof Error ? error.message : "Failed to update monitoring status"
                        });
                    }
                })();
            }} onRefreshMetadata={() => {
                void (async () => {
                    if (mangaId === undefined || mangaId === null || isNaN(mangaId))
                        return;
                    const safeMangaId: number = mangaId;
                    try {
                        await refreshMetadataMutation.mutateAsync({
                            id: safeMangaId
                        });
                    }
                    catch (error: unknown) {
                        logger.error('Error refreshing metadata:', error instanceof Error ? error.message : String(error));
                    }
                })();
            }} onEditManga={() => {
                // Edit functionality would go here
                notify({ severity: 'INFO', title: "Edit Manga", message: "Edit functionality not yet implemented" });
            }} onRemoveManga={() => openRemoveModal()} onDownloadChapters={(downloadMangaIdParam, chapterIds) => {
                handleDownloadChapters(downloadMangaIdParam, chapterIds);
            }} isUpdating={refreshMetadataMutation.isPending}/>;
    }
    return <>
      {/* Manga Action Bar */}
      <MangaActionBar
        mangaId={mangaId ?? 0}
        mangaTitle={manga.title}
        onRefresh={() => { void refetch(); }}
        refreshing={refreshMetadataMutation.isPending}
        totalChapters={totalChapters}
        downloadedChapters={downloadedChapters}
        readChapters={readChapters}
        {...(manga.libraryId !== null ? { libraryId: manga.libraryId } : {})}
        {...(manga.Library && (manga.Library as Library).name ? { libraryName: (manga.Library as Library).name } : {})}
      />

      <ScrollArea h="calc(100vh - 144px)" type="auto" scrollbarSize={0} style={{
            width: '100%',
            position: 'relative',
            paddingBottom: 0,
            marginTop: '110px'
        }} viewportProps={{
            style: {
                width: '100%',
                paddingRight: 0,
                paddingLeft: 0
            }
        }}>

        {/* Banner with manga title and cover */}
        <MangaBannerSection
          manga={manga}
          extractedMetadata={extractedMetadata as MangaMetadata | null}
          mangaId={mangaId ?? null}
          isProvidersExpanded={isProvidersExpanded}
          setIsProvidersExpanded={setIsProvidersExpanded}
          setIsCoverSelectorOpen={setIsCoverSelectorOpen}
          setIsAniListModalOpen={setIsAniListModalOpen}
          setIsComicVineModalOpen={setIsComicVineModalOpen}
          setIsFandomModalOpen={setIsFandomModalOpen}
          setIsWikipediaModalOpen={setIsWikipediaModalOpen}
          setIsMangaDexModalOpen={setIsMangaDexModalOpen}
          setIsMangaUpdatesModalOpen={setIsMangaUpdatesModalOpen}
          setIsMalModalOpen={setIsMalModalOpen}
          setIsKitsuModalOpen={setIsKitsuModalOpen}
          allMonitored={allMonitored}
          someMonitored={someMonitored}
          monitoredCount={monitoredCount}
          totalChapters={totalChapters}
          isDetailsExpanded={isDetailsExpanded}
          setIsDetailsExpanded={setIsDetailsExpanded}
          toggleSeriesMonitoringMutation={toggleSeriesMonitoringMutation}
          seriesQuickDownloadMutation={seriesQuickDownloadMutation}
          handleToggleMangaBookmark={() => { void handleToggleMangaBookmark(); }}
          handleSeriesQuickDownload={() => { void handleSeriesQuickDownload(); }}
          isProviderBound={isProviderBound}
        />

        {/* Main content - Chapters by Volume, Sync Status, and Release Schedule */}
        <Box style={{
            width: '100%',
            padding: '0 16px'
        }}>
          <Stack gap="xl">
            {/* Volumes & Chapters section - moved to top */}
            <Box>
              <Title order={3} mb="md">Volumes & Chapters</Title>
              <ResponsiveChapterList
                key={`chapters-${monitoredCount}-${totalChapters}-${refreshCounter}`}
                manga={manga}
                {...(mangaId !== undefined ? { mangaId } : {})}
                onToggleMonitoring={handleToggleMonitoring}
                onAutoSearch={handleAutoSearch}
                onManualSearch={handleManualSearch}
                onForceRefresh={() => setRefreshCounter(prev => prev + 1)}
                onChapterClick={(chapter, enrichedChapter) => {
                  // Use enriched chapter if available, otherwise fall back to original chapter
                  setSelectedChapter(enrichedChapter ?? chapter);
                  setInitialModalTab('details');
                  setChapterModalOpened(true);
                }}
                onDownload={(downloadMangaIdParam, chapterIds) => {
                  handleDownloadChapters(downloadMangaIdParam, chapterIds);
                }}/>

            </Box>
          </Stack>
        </Box>
      </ScrollArea>
      
      <style>{`
        .cover-overlay:hover {
          background: rgba(0, 0, 0, 0.5) !important;
        }
        .cover-overlay:hover .cover-icon {
          opacity: 1 !important;
        }
      `}</style>
      
      {/* All modals rendered via extracted component */}
      <MangaDetailModals
        mangaId={mangaId}
        manga={manga}
        refetch={async () => { await refetch(); }}
        isAniListModalOpen={isAniListModalOpen}
        setIsAniListModalOpen={setIsAniListModalOpen}
        isComicVineModalOpen={isComicVineModalOpen}
        setIsComicVineModalOpen={setIsComicVineModalOpen}
        isFandomModalOpen={isFandomModalOpen}
        setIsFandomModalOpen={setIsFandomModalOpen}
        isWikipediaModalOpen={isWikipediaModalOpen}
        setIsWikipediaModalOpen={setIsWikipediaModalOpen}
        isMangaDexModalOpen={isMangaDexModalOpen}
        setIsMangaDexModalOpen={setIsMangaDexModalOpen}
        isProviderMetadataModalOpen={isProviderMetadataModalOpen}
        setIsProviderMetadataModalOpen={setIsProviderMetadataModalOpen}
        isCoverSelectorOpen={isCoverSelectorOpen}
        setIsCoverSelectorOpen={setIsCoverSelectorOpen}
        isMangaUpdatesModalOpen={isMangaUpdatesModalOpen}
        setIsMangaUpdatesModalOpen={setIsMangaUpdatesModalOpen}
        isMalModalOpen={isMalModalOpen}
        setIsMalModalOpen={setIsMalModalOpen}
        isKitsuModalOpen={isKitsuModalOpen}
        setIsKitsuModalOpen={setIsKitsuModalOpen}
        chapterModalOpened={chapterModalOpened}
        setChapterModalOpened={setChapterModalOpened}
        selectedChapter={selectedChapter}
        setSelectedChapter={setSelectedChapter}
        initialModalTab={initialModalTab}
      />
    </>;
}

// Add layout wrapper for consistent header and navigation
MangaDetailPage.getLayout = function getLayout(page: React.ReactElement) {
    return <ResponsiveMainLayout>{page}</ResponsiveMainLayout>;
};
