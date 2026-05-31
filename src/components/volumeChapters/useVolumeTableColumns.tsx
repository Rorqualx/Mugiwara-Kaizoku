/**
 * Volume Table Columns Hook
 *
 * Custom hook that generates DataTable column definitions for volume chapter tables.
 * Extracted from VolumeChaptersTable.tsx to reduce component complexity.
 *
 * Features:
 * - Memoized column definitions for performance
 * - Reading progress indicators
 * - Chapter monitoring toggles
 * - Download status badges
 * - Action buttons for search and download
 *
 * @module useVolumeTableColumns
 */

import * as React from 'react';
import { useMemo } from 'react';

import { Badge, Group, Text, Button, ActionIcon, Tooltip } from '@mantine/core';
import { ChapterStatus } from '@prisma/client';
import {
    IconBookmark,
    IconBookmarkOff,
    IconBook,
    IconPlayerPlay
} from '@tabler/icons-react';

import { useNavigation } from '@/hooks/useNavigation';


import classes from '../chaptersTable.module.css';

import { ChapterRowActions } from './ChapterRowActions';
import { isVolumeFileRow } from './phantom-stub';
import {
    getChapterNumber,
    getChapterName,
    getStatusBadge,
    formatReleaseDate,
    enrichChapter,
    isVolumeEntry,
    type FileVerificationMap
} from './utils';

import type { VolumeData } from './types';
import type { Chapter } from "@prisma/client";

/**
 * Parameters for the useVolumeTableColumns hook
 */
export interface UseVolumeTableColumnsParams {
    /** Manga ID for navigation and queries */
    mangaId: number | undefined;
    /** Manga title for download context */
    mangaTitle?: string | undefined;
    /** Map of chapter IDs to reading progress */
    progressMap: Map<number, { currentPage: number; totalPages: number; completedAt: Date | null }>;
    /** File verification data for download status */
    fileVerification: FileVerificationMap | undefined;
    /** Volume data for enriching chapter information */
    volumeData: VolumeData | null | undefined;
    /** All chapters in this volume (for computing volume-file range display) */
    chapters: Chapter[];
    /** Callback when chapter is clicked */
    onChapterClick: ((chapter: Chapter, enrichedChapter: Chapter) => void) | undefined;
    /** Callback for toggling chapter monitoring */
    onToggleChapterBookmark: (chapterId: number, currentMonitoredState: boolean) => void;
    /** Whether chapter monitoring toggle is pending */
    isTogglingChapter: boolean;
    /** Volume number (-1 for unassigned) */
    volumeNumber?: number;
    /** Callback for deleting a chapter */
    onDeleteChapter?: (chapterId: number) => void;
    /** ID of chapter currently being deleted */
    deletingChapterId?: number;
    /** Callback to open the volume modal (used for volume file clicks) */
    onOpenVolumeModal?: () => void;
}

/**
 * Hook for generating DataTable column definitions
 *
 * Provides memoized column definitions with all interactive features:
 * - Monitoring toggles
 * - Reading progress
 * - Download status
 * - Action buttons
 *
 * @param params - Hook parameters
 * @returns Array of DataTable column definitions
 *
 * @example
 * ```tsx
 * const columns = useVolumeTableColumns({
 *   mangaId,
 *   progressMap,
 *   fileVerification,
 *   volumeData,
 *   onAutoSearch,
 *   onManualSearch,
 *   onChapterClick,
 *   onToggleChapterBookmark,
 *   isTogglingChapter
 * });
 * ```
 */
export function useVolumeTableColumns({
    mangaId,
    mangaTitle,
    progressMap,
    fileVerification,
    volumeData,
    chapters,
    onChapterClick,
    onToggleChapterBookmark,
    isTogglingChapter,
    volumeNumber,
    onDeleteChapter,
    deletingChapterId,
    onOpenVolumeModal
}: UseVolumeTableColumnsParams): Array<Record<string, unknown>> {
    const { navigateTo } = useNavigation();

    // Compute chapter range for volume-file entries (NULL chapterNumber)
    const volumeChapterRange = useMemo(() => {
        const numbered = chapters
            .filter(ch => ch.chapterNumber !== null && Number.isInteger(ch.chapterNumber) && ch.chapterNumber > 0)
            .map(ch => ch.chapterNumber as number);
        if (numbered.length === 0) return '';
        return `${Math.min(...numbered)}-${Math.max(...numbered)}`;
    }, [chapters]);

    /**
     * DataTable column definitions
     * Includes all chapter information and action buttons
     */
    const columns = useMemo(() => [
        {
            accessor: "bookmark",
            title: "Monitoring",
            width: 80,
            render: (record: Chapter) => {
                const isChapterMonitored = record.monitored || false;
                return (
                    <ActionIcon
                        variant="subtle"
                        color={isChapterMonitored ? "white" : "gray"}
                        onClick={() => onToggleChapterBookmark(record.id, isChapterMonitored)}
                        title={isChapterMonitored ? "Monitored - Click to disable" : "Not monitored - Click to enable"}
                        loading={isTogglingChapter}
                    >
                        {isChapterMonitored ? <IconBookmark size={18}/> : <IconBookmarkOff size={18}/>}
                    </ActionIcon>
                );
            }
        },
        {
            accessor: "volume",
            title: "Volume",
            width: 70,
            render: (record: Chapter) => {
                const vol = record.volume;
                if (vol === null) return <Text size="sm" c="dimmed">—</Text>;
                return <Text size="sm">{vol}</Text>;
            }
        },
        {
            accessor: "chapterNumber",
            title: "Chapter",
            width: 100,
            render: (record: Chapter) => {
                // Volume files (NULL chapterNumber) show the chapter range they contain
                if (record.chapterNumber === null && volumeChapterRange) {
                    return <Text size="sm">{volumeChapterRange}</Text>;
                }
                // Detect volume files by filePath or chapterNumber offset
                if (isVolumeEntry(record)) {
                    return (
                        <Badge size="sm" variant="light" color="violet">
                            Vol. {getChapterNumber(record)}
                        </Badge>
                    );
                }
                return <Text size="sm">{getChapterNumber(record)}</Text>;
            }
        },
        {
            accessor: "title",
            title: "Title",
            render: (record: Chapter) => {
                const progress = progressMap.get(record.id);
                const recordIsVolumeFile = isVolumeFileRow(record);
                // Match the header label exactly: "Volume N (X-Y) - VolumeTitle"
                // where the " - VolumeTitle" suffix is only added when a real
                // title exists. See VolumeHeader.tsx for the source of truth.
                const renderVolumeFileTitle = (): string => {
                    const num = record.volume ?? (record.chapterNumber !== null && record.chapterNumber >= 100_000
                        ? record.chapterNumber - 100_000
                        : record.chapterNumber);
                    const realTitle = volumeData?.volumeTitle ?? volumeData?.title ?? volumeData?.name ?? null;
                    const base = `Volume ${num}${volumeChapterRange ? ` (${volumeChapterRange})` : ''}`;
                    return realTitle ? `${base} - ${realTitle}` : `${base} - Volume ${num}`;
                };

                return (
                    <Group gap="xs" wrap="nowrap">
                        <Text
                            size="sm"
                            style={{ cursor: 'pointer', textDecoration: 'underline' }}
                            onClick={() => {
                                // Volume files open the volume modal instead of chapter modal
                                if (recordIsVolumeFile && onOpenVolumeModal) {
                                    onOpenVolumeModal();
                                    return;
                                }
                                const enrichedChapterData = enrichChapter(record, volumeData);
                                if (onChapterClick) {
                                    onChapterClick(record, enrichedChapterData);
                                }
                            }}
                        >
                            {recordIsVolumeFile
                                ? renderVolumeFileTitle()
                                : getChapterName(record)}
                        </Text>

                        {progress && (
                            <Badge
                                size="xs"
                                color={
                                    progress.completedAt
                                        ? 'green'
                                        : progress.currentPage > 1
                                            ? 'blue'
                                            : 'gray'
                                }
                                variant="light"
                            >
                                {progress.currentPage}/{progress.totalPages}
                            </Badge>
                        )}
                    </Group>
                );
            }
        },
        {
            accessor: "status",
            title: "Status",
            width: 100,
            textAlign: 'right',
            sortable: false,
            titleClassName: classes.headerStatus,
            render: (record: Chapter) => {
                const statusInfo = getStatusBadge(record, fileVerification);
                const badge = (
                    <Badge color={statusInfo.color} size="sm">
                        {statusInfo.label}
                    </Badge>
                );
                return (
                    <Group justify="flex-end" style={{ width: '100%' }}>
                        {statusInfo.tooltip ? (
                            <Tooltip label={statusInfo.tooltip} multiline w={260} withArrow>
                                <span>{badge}</span>
                            </Tooltip>
                        ) : badge}
                    </Group>
                );
            }
        },
        {
            accessor: "pageCount",
            title: "Pages",
            width: 60,
            textAlign: 'right',
            sortable: true,
            titleClassName: classes.headerRight,
            render: (record: Chapter) => (
                <Group justify="flex-end" style={{ width: '100%' }}>
                    <Text size="sm" c={record.pageCount ? 'dimmed' : 'dark.3'}>
                        {record.pageCount ?? '-'}
                    </Text>
                </Group>
            )
        },
        {
            accessor: "releaseDate",
            title: "Release Date",
            width: 100,
            textAlign: 'right',
            sortable: false,
            titleClassName: classes.headerRight,
            render: (record: Chapter) => (
                <Group justify="flex-end" style={{ width: '100%' }}>
                    <Text size="sm" c={record.releaseDate ? 'dimmed' : 'dark'}>
                        {formatReleaseDate(record.releaseDate)}
                    </Text>
                </Group>
            )
        },
        {
            accessor: "read",
            title: "Read",
            width: 100,
            textAlign: 'center',
            sortable: false,
            render: (record: Chapter) => {
                const progress = progressMap.get(record.id);
                const fileExists = fileVerification?.[record.id]?.exists ?? true; // Default to true if not verified yet
                const isDownloaded = record.downloadStatus === ChapterStatus.COMPLETED && fileExists;

                // Determine button text and icon
                let buttonText = 'Read';
                let buttonIcon = <IconBook size={16} />;
                let buttonColor: string | undefined = 'blue';

                if (progress) {
                    const isCompleted = progress.completedAt !== null || progress.currentPage === progress.totalPages;
                    if (isCompleted) {
                        buttonText = 'Re-read';
                        buttonColor = 'gray';
                    } else if (progress.currentPage > 1) {
                        buttonText = 'Continue';
                        buttonIcon = <IconPlayerPlay size={16} />;
                        buttonColor = 'green';
                    }
                }

                const handleRead = (): void => {
                    if (!mangaId) return;
                    const page = progress?.currentPage ?? 1;
                    void navigateTo(`/read/${mangaId}/${record.id}?page=${page}`);
                };

                if (!isDownloaded) {
                    return <Group justify="center" style={{ width: '100%' }} />;
                }

                return (
                    <Group justify="center" style={{ width: '100%' }}>
                        <Button
                            size="xs"
                            variant="light"
                            color={buttonColor}
                            leftSection={buttonIcon}
                            onClick={handleRead}
                        >
                            {buttonText}
                        </Button>
                    </Group>
                );
            }
        },
        {
            accessor: "actions",
            title: "Actions",
            width: volumeNumber === -1 ? 110 : 100,
            textAlign: 'right',
            sortable: false,
            titleClassName: classes.headerRight,
            render: (record: Chapter) => (
                <ChapterRowActions
                    chapter={record}
                    mangaId={mangaId}
                    mangaTitle={mangaTitle}
                    {...(volumeNumber !== undefined ? { volumeNumber } : {})}
                    {...(onDeleteChapter ? { onDelete: onDeleteChapter } : {})}
                    {...(deletingChapterId === record.id ? { isDeleting: true } : {})}
                />
            )
        }
    ], [onToggleChapterBookmark, isTogglingChapter, onChapterClick, progressMap, navigateTo, mangaId, mangaTitle, fileVerification, volumeData, volumeChapterRange, volumeNumber, onDeleteChapter, deletingChapterId, onOpenVolumeModal]);

    return columns;
}
