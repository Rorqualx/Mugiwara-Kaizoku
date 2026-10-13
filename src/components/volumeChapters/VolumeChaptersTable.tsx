/**
 * Volume Chapters Table Component
 *
 * Table component for displaying chapters within a volume.
 *
 * Features:
 * - Expandable/collapsible volume sections
 * - Chapter monitoring toggles
 * - Download status indicators
 * - Reading progress tracking
 * - Quick download integration
 *
 * Extracted from: volumeChaptersTable.tsx
 */

import { useState, useEffect, useMemo, useCallback, memo } from 'react';

import { Box } from '@mantine/core';
import { notifications } from '@mantine/notifications';

import { useQuickDownloadToast } from '@/hooks/useQuickDownloadToast';
import { useRealTime } from '@/providers/RealTimeProvider';
import { logger } from '@/utils/logger';
import { trpc } from '@/utils/trpc-client';

import classes from '../chaptersTable.module.css';

import { isAwaitingVolumeGroup, missingChapterIds, serverVolumeNumber } from './awaiting-volume-group';
import {
    useProgressMap,
    useToggleVolumeMonitoring,
    useQuickDownloadVolume,
    useToggleChapterMonitoring,
    useEnrichedVolumeModalData,
    type VolumeEnrichmentParams
} from './hooks';
import { useVolumeTableState } from './hooks/useVolumeTableState';
import { useVolumeExpansionState } from './useVolumeExpansionState';
import { useVolumeMonitoringState } from './useVolumeMonitoringState';
import { useVolumeStatistics } from './useVolumeStatistics';
import { useVolumeTableColumns } from './useVolumeTableColumns';
import { isValidChapter, type FileVerificationMap } from './utils';
import { VolumeHeader, VolumeContent, VolumeModals } from './volume-table-components';

import type { VolumeChaptersTableProps } from './types';

/**
 * Table component for displaying chapters within a volume
 * Performance optimized with memoization and GPU-accelerated animations
 */
export const VolumeChaptersTable = memo(({
    volumeNumber,
    chapters,
    mangaId: propMangaId,
    mangaTitle,
    onAutoSearch: _onAutoSearch,
    onManualSearch: _onManualSearch,
    volumeTitle,
    chapterRange,
    volumeCover,
    volumeData,
    providerMetadata,
    selectedSource,
    allExpanded,
    onChapterClick,
    onForceRefresh,
    parentProgressMap,
    parentFileVerification
}: VolumeChaptersTableProps): JSX.Element => {
    // Debug logging for volume title
    useEffect(() => {
        if (volumeNumber === 1 || volumeNumber === 2) {
            logger.info('[VolumeChaptersTable] Rendering volume:', {
                volumeNumber,
                volumeTitle,
                hasVolumeTitle: !!volumeTitle,
                volumeCover,
                hasVolumeCover: !!volumeCover,
                volumeData,
                hasVolumeData: !!volumeData,
                chaptersCount: chapters.length
            });
        }
    }, [volumeNumber, volumeTitle, volumeCover, volumeData, chapters]);

    // Volume expansion state management
    const { isExpanded, toggleExpanded } = useVolumeExpansionState({ allExpanded });

    // State for volume detail modal (keep this local since it's volume-specific)
    const [volumeModalOpened, setVolumeModalOpened] = useState(false);

    // State for chapter reassign modal (only used for unassigned chapters)
    const [reassignModalOpened, setReassignModalOpened] = useState(false);

    // WebSocket connection for real-time updates
    const { isConnected } = useRealTime();

    // Use prop mangaId if provided, otherwise extract from chapters
    const mangaId = propMangaId ?? chapters[0]?.mangaId;

    // Get reading progress for all chapters in this manga
    // Skip local query when parent already provides the data
    const { data: progressList } = trpc.reader.getMangaProgress.useQuery(
        { mangaId: mangaId ?? 0 },
        {
            enabled: !!mangaId && !parentProgressMap,
            refetchOnWindowFocus: !isConnected, // Only refetch on window focus when WebSocket disconnected
            staleTime: 10000
        }
    );

    // Create a map of chapterId -> reading progress for quick lookup
    const localProgressMap = useProgressMap(progressList);
    const progressMap = parentProgressMap ?? localProgressMap;

    // File verification comes from VolumeGroupedChapters, which verifies every
    // chapter of the manga in one query. A per-volume fallback query used to
    // run until the parent's result arrived, so the first render of a manga
    // with N volumes sent N + 1 verification queries. Until the parent's
    // result arrives, chapters render as present.
    const fileVerification: FileVerificationMap | undefined = parentFileVerification;

    // Calculate volume monitoring state
    const {
        totalVolumeChapters,
        volumeMonitoredCount,
        allVolumeMonitored,
        someVolumeMonitored,
        noneVolumeMonitored
    } = useVolumeMonitoringState({ chapters });

    // Use custom hooks for mutations
    const { mutate: toggleVolumeMonitoring, isPending: isTogglingVolume } = useToggleVolumeMonitoring({
        mangaId,
        onForceRefresh
    });

    const { mutate: quickDownloadVolume, isPending: isDownloadingVolume } = useQuickDownloadVolume({
        mangaId,
        onForceRefresh
    });

    const { mutate: toggleChapterMonitoring, isPending: isTogglingChapter } = useToggleChapterMonitoring({
        mangaId,
        onForceRefresh
    });

    // Use extracted hook for delete mutations and state
    const {
        deletingChapterId,
        handleDeleteChapter,
        handleDeleteAllUnassigned,
        isDeletingAll
    } = useVolumeTableState({ mangaId, volumeNumber, chapters, onForceRefresh });

    // Handler for toggling volume monitoring
    const handleToggleVolumeMonitoring = useCallback((): void => {
        if (!mangaId) return;

        // If any monitored, disable all; if none monitored, enable all
        const newMonitoredState = noneVolumeMonitored;
        toggleVolumeMonitoring({
            mangaId,
            volumeNumber: serverVolumeNumber(volumeNumber),
            monitored: newMonitoredState
        });
    }, [mangaId, volumeNumber, noneVolumeMonitored, toggleVolumeMonitoring]);

    // Live-update the per-volume quick-download toast as the auto-search fan-out reports per-source results.
    useQuickDownloadToast(mangaId, volumeNumber !== -1 ? `quick-download-volume-${volumeNumber}` : null);

    // Handler for volume Quick Download. The "Not yet in a volume" group has no
    // volume release to search for, so it downloads its missing chapters instead.
    const handleVolumeQuickDownload = useCallback((): void => {
        if (!mangaId || volumeNumber === -1) return;
        const awaitingIds = isAwaitingVolumeGroup(volumeNumber) ? missingChapterIds(chapters) : null;
        if (awaitingIds?.length === 0) return;

        notifications.show({
            id: `quick-download-volume-${volumeNumber}`,
            title: 'Searching…',
            message: awaitingIds ? 'Searching enabled sources for these chapters…' : 'Searching enabled sources for best volume release…',
            loading: true,
            autoClose: false
        });

        quickDownloadVolume(awaitingIds ? {
            mangaId,
            chapterIds: awaitingIds,
            mode: 'BULK'
        } : {
            mangaId,
            volumeNumber,
            mode: 'VOLUME'
        }, {
            onSettled: () => {
                notifications.hide(`quick-download-volume-${volumeNumber}`);
            }
        });
    }, [mangaId, volumeNumber, chapters, quickDownloadVolume]);

    // Memoize chapter data, filtering out invalid chapters and sorting by chapter number
    const records = useMemo(
      () => chapters.filter(isValidChapter).sort((a, b) =>
        (a.chapterNumber ?? a.index) - (b.chapterNumber ?? b.index)
      ), [chapters]
    );

    /**
     * Memoized volume data for VolumeDetailModal
     * Computes enriched volume information from various data sources
     */
    const enrichmentParams: VolumeEnrichmentParams = {
        volumeNumber,
        volumeTitle,
        volumeCover,
        volumeData,
        providerMetadata,
        selectedSource,
        chapters
    };
    const enrichedVolumeModalData = useEnrichedVolumeModalData(enrichmentParams);

    // Calculate volume statistics
    const { volumeSize, volumePageCount } = useVolumeStatistics({ chapters, fileVerification });

    // Handler for toggling individual chapter monitoring status
    const handleToggleChapterBookmark = useCallback((chapterId: number, currentMonitoredState: boolean) => {
        toggleChapterMonitoring({
            chapterId,
            monitored: !currentMonitoredState
        });
    }, [toggleChapterMonitoring]);

    // Use extracted hook for column definitions
    const columns = useVolumeTableColumns({
        mangaId,
        mangaTitle,
        progressMap,
        fileVerification,
        volumeData,
        chapters,
        onChapterClick,
        onToggleChapterBookmark: handleToggleChapterBookmark,
        isTogglingChapter,
        volumeNumber,
        ...(volumeNumber === -1 ? { onDeleteChapter: handleDeleteChapter } : {}),
        ...(deletingChapterId !== undefined ? { deletingChapterId } : {}),
        onOpenVolumeModal: () => setVolumeModalOpened(true),
    });

    // Build header actions props
    const headerActionsProps = {
        volumeNumber,
        mangaId,
        mangaTitle,
        chapters,
        allVolumeMonitored,
        someVolumeMonitored,
        noneVolumeMonitored,
        totalVolumeChapters,
        volumeMonitoredCount,
        isTogglingVolume,
        isDownloadingVolume,
        isDeletingAll,
        onToggleMonitoring: handleToggleVolumeMonitoring,
        onQuickDownload: handleVolumeQuickDownload,
        onOpenReassignModal: () => setReassignModalOpened(true),
        onDeleteAllUnassigned: volumeNumber === -1 ? handleDeleteAllUnassigned : undefined
    };

    return (
        <>
            <Box mb="xl" className={classes['volumeContainer']} style={{
                borderRadius: 'var(--mantine-radius-md)',
                overflow: 'hidden',
                border: '1px solid var(--mantine-color-dark-4)',
                marginBottom: '2rem'
            }}>
                <VolumeHeader
                    volumeNumber={volumeNumber}
                    volumeTitle={volumeTitle}
                    chapterRange={chapterRange}
                    chapters={chapters}
                    volumePageCount={volumePageCount}
                    volumeSize={volumeSize}
                    isExpanded={isExpanded}
                    onToggleExpanded={toggleExpanded}
                    onOpenVolumeModal={() => setVolumeModalOpened(true)}
                    headerActionsProps={headerActionsProps}
                />
                <VolumeContent
                    isExpanded={isExpanded}
                    records={records}
                    columns={columns}
                    chaptersCount={chapters.length}
                />
            </Box>

            <VolumeModals
                volumeModalOpened={volumeModalOpened}
                onCloseVolumeModal={() => setVolumeModalOpened(false)}
                enrichedVolumeModalData={enrichedVolumeModalData}
                mangaId={mangaId}
                chapters={chapters}
                volumeData={volumeData}
                onChapterClick={onChapterClick}
                reassignModalOpened={reassignModalOpened}
                onCloseReassignModal={() => setReassignModalOpened(false)}
                volumeNumber={volumeNumber}
                onReassignComplete={() => {
                    setReassignModalOpened(false);
                    onForceRefresh?.();
                }}
            />
        </>
    );
});

VolumeChaptersTable.displayName = 'VolumeChaptersTable';
