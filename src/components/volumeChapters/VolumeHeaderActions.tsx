/**
 * Volume Header Actions Component
 *
 * Renders action buttons for volume management in the volume header.
 * Includes monitoring toggle and unified download button.
 *
 * @module VolumeHeaderActions
 */

import * as React from 'react';
import { useState } from 'react';

import { ActionIcon, Group, Tooltip } from '@mantine/core';
import { ChapterStatus } from '@prisma/client';
import { IconBookmark, IconBookmarkOff, IconFolderPlus, IconRefresh, IconTrash } from '@tabler/icons-react';

import { DownloadButton, UnifiedSearchModal, type DownloadContext } from '@/components/download';
import { logger } from '@/utils/logger';
import { notify } from '@/utils/notify';
import { trpc } from '@/utils/trpc-client/index';

import classes from '../chaptersTable.module.css';

import type { Manga as MangaEntity, Chapter as ChapterEntity } from '@prisma/client';

/**
 * Props for the VolumeHeaderActions component
 */
export interface VolumeHeaderActionsProps {
    /** Volume number */
    volumeNumber: number;
    /** Manga ID */
    mangaId: number | undefined;
    /** Manga title for download context */
    mangaTitle?: string | undefined;
    /** Chapters in this volume */
    chapters?: ChapterEntity[];
    /** Whether all chapters are monitored */
    allVolumeMonitored: boolean;
    /** Whether some chapters are monitored */
    someVolumeMonitored: boolean;
    /** Whether no chapters are monitored */
    _noneVolumeMonitored: boolean;
    /** Total number of chapters */
    totalVolumeChapters: number;
    /** Number of monitored chapters */
    volumeMonitoredCount: number;
    /** Whether volume monitoring toggle is pending */
    isTogglingVolume: boolean;
    /** Whether volume download is pending (kept for legacy compatibility) */
    isDownloadingVolume: boolean;
    /** Callback for toggling volume monitoring */
    onToggleMonitoring: () => void;
    /** Callback for quick download (kept for legacy compatibility) */
    onQuickDownload: () => void;
    /** Callback to open reassign modal (for unassigned chapters) */
    onOpenReassignModal?: () => void;
    /** Callback to delete all unassigned chapters (bulk delete) */
    onDeleteAllUnassigned?: () => void;
    /** Whether bulk delete is pending */
    isDeletingAll?: boolean;
}

/**
 * Volume-scoped "Retry Failed" button. Renders when at least one chapter in
 * the volume is in ERROR. Clears the dispatch-attempt ledger for the ERROR
 * chapters in this volume and re-runs the unified release search scoped to
 * the volume.
 */
function VolumeRetryButton({
    mangaId,
    volumeNumber,
    chapters,
}: {
    mangaId: number;
    volumeNumber: number;
    chapters: ChapterEntity[];
}): JSX.Element | null {
    const utils = trpc.useUtils();
    const retryMutation = trpc.manga.resetFailedDownloads.useMutation({
        onSuccess: async (data) => {
            await Promise.all([
                utils.manga.get.invalidate({ id: mangaId }),
                utils.manga.detail.invalidate({ id: mangaId }),
            ]);
            notify({
                severity: data.clearedCount > 0 ? 'SUCCESS' : 'INFO',
                title: data.clearedCount > 0 ? 'Retrying Volume' : 'Nothing to Retry',
                message: data.message,
            });
        },
        onError: (error) => {
            notify({
                severity: 'ERROR',
                title: 'Retry Failed',
                message: error instanceof Error ? error.message : String(error),
            });
        },
    });
    const hasFailed = chapters.some(c => c.downloadStatus === ChapterStatus.ERROR);
    if (!hasFailed) return null;
    return (
        <Tooltip label="Retry failed chapters in this volume" withArrow>
            <ActionIcon
                variant="subtle"
                color="orange"
                size="sm"
                onClick={(e) => {
                    e.stopPropagation();
                    retryMutation.mutate({ id: mangaId, volumeNumber });
                }}
                loading={retryMutation.isPending}
                aria-label="Retry failed chapters in volume"
                className={classes['actionIcon']}
            >
                <IconRefresh size={16} />
            </ActionIcon>
        </Tooltip>
    );
}

/**
 * Renders action buttons for unassigned chapters section
 */
function UnassignedChapterActions({
    onOpenReassignModal,
    onDeleteAllUnassigned,
    isDeletingAll
}: {
    onOpenReassignModal?: () => void;
    onDeleteAllUnassigned?: () => void;
    isDeletingAll?: boolean;
}): JSX.Element {
    return (
        <Group gap="xs">
            {onOpenReassignModal && (
                <ActionIcon
                    variant="subtle"
                    color="yellow"
                    size="sm"
                    onClick={(e) => { e.stopPropagation(); onOpenReassignModal(); }}
                    title="Reassign chapters to volumes"
                    className={classes['actionIcon']}
                >
                    <IconFolderPlus size={16} />
                </ActionIcon>
            )}
            {onDeleteAllUnassigned && (
                <ActionIcon
                    variant="subtle"
                    color="red"
                    size="sm"
                    onClick={(e) => {
                        e.stopPropagation();
                        logger.info('[UnassignedChapterActions] Delete button clicked');
                        onDeleteAllUnassigned();
                    }}
                    title="Delete all unassigned files"
                    className={classes['actionIcon']}
                    loading={isDeletingAll ?? false}
                >
                    <IconTrash size={16} />
                </ActionIcon>
            )}
        </Group>
    );
}

/**
 * Volume Header Actions Component
 *
 * Renders monitoring and download action buttons for a volume header.
 * Only renders if volume number is not -1 (unassigned) and mangaId exists.
 *
 * @param props - Component props
 * @returns Action buttons or null
 */
export function VolumeHeaderActions({
    volumeNumber,
    mangaId,
    mangaTitle,
    chapters,
    allVolumeMonitored,
    someVolumeMonitored,
    _noneVolumeMonitored,
    totalVolumeChapters,
    volumeMonitoredCount,
    isTogglingVolume,
    isDownloadingVolume: _isDownloadingVolume,
    onToggleMonitoring,
    onQuickDownload: _onQuickDownload,
    onOpenReassignModal,
    onDeleteAllUnassigned,
    isDeletingAll
}: VolumeHeaderActionsProps): JSX.Element | null {
    const [searchModalOpen, setSearchModalOpen] = useState(false);

    // For unassigned chapters, render reassign and delete buttons
    if (volumeNumber === -1) {
        if (!mangaId) return null;

        // Debug logging to trace handler
        logger.info('[VolumeHeaderActions] Rendering for unassigned chapters', {
            mangaId,
            hasOnDeleteAllUnassigned: !!onDeleteAllUnassigned,
            isDeletingAll
        });

        return (
            <UnassignedChapterActions
                {...(onOpenReassignModal ? { onOpenReassignModal } : {})}
                {...(onDeleteAllUnassigned ? { onDeleteAllUnassigned } : {})}
                {...(isDeletingAll !== undefined ? { isDeletingAll } : {})}
            />
        );
    }

    // Don't render for missing mangaId
    if (!mangaId) {
        return null;
    }

    // Build download context for the DownloadButton
    const downloadContext: DownloadContext | null = mangaId
        ? {
            type: 'volume' as const,
            manga: {
                id: mangaId,
                title: mangaTitle ?? 'Unknown',
                source: 'unknown',
            } as unknown as MangaEntity,
            volumeNumber,
            chapters: (chapters ?? []) as ChapterEntity[],
        }
        : null;

    return (
        <>
            <VolumeRetryButton mangaId={mangaId} volumeNumber={volumeNumber} chapters={chapters ?? []} />
            <ActionIcon
                variant="subtle"
                color={(allVolumeMonitored || someVolumeMonitored) ? "white" : "gray"}
                size="sm"
                onClick={(e) => {
                    e.stopPropagation();
                    onToggleMonitoring();
                }}
                title={
                    (allVolumeMonitored || someVolumeMonitored)
                        ? `Monitoring enabled (${volumeMonitoredCount}/${totalVolumeChapters}) - Click to disable all`
                        : "No chapters monitored - Click to enable monitoring for this volume"
                }
                loading={isTogglingVolume}
                className={classes['actionIcon']}
            >
                {(allVolumeMonitored || someVolumeMonitored) ? <IconBookmark size={16} /> : <IconBookmarkOff size={16} />}
            </ActionIcon>

            {/* Unified Download Button */}
            {downloadContext && (
                <div onClick={(e) => e.stopPropagation()}>
                    <DownloadButton
                        context={downloadContext}
                        onOpenSearch={() => setSearchModalOpen(true)}
                        size="xs"
                        variant="subtle"
                        compact={true}
                    />
                </div>
            )}

            {/* Unified Search Modal */}
            {downloadContext && (
                <UnifiedSearchModal
                    opened={searchModalOpen}
                    onClose={() => setSearchModalOpen(false)}
                    context={downloadContext}
                />
            )}
        </>
    );
}
