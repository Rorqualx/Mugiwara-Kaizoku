/**
 * Chapter Row Actions Component
 *
 * Renders action buttons for a chapter row in the volume table.
 * Uses the unified DownloadButton component for consistent download experience.
 *
 * @module ChapterRowActions
 */

import * as React from 'react';
import { useState } from 'react';

import { ActionIcon, Group, Tooltip } from '@mantine/core';
import { ChapterStatus } from '@prisma/client';
import { IconRefresh, IconTrash } from '@tabler/icons-react';

import { DownloadButton, UnifiedSearchModal, type DownloadContext } from '@/components/download';
import { notify } from '@/utils/notify';
import { trpc } from '@/utils/trpc-client/index';

import classes from '../chaptersTable.module.css';

import type { Manga as MangaEntity, Chapter as ChapterEntity } from '@prisma/client';

/**
 * Props for the ChapterRowActions component
 */
export interface ChapterRowActionsProps {
    /** The chapter to render actions for */
    chapter: ChapterEntity;
    /** Manga ID for download context */
    mangaId: number | undefined;
    /** Manga title for download context */
    mangaTitle?: string | undefined;
    /** Volume number (-1 for unassigned) */
    volumeNumber?: number;
    /** Callback for deleting this chapter */
    onDelete?: (chapterId: number) => void;
    /** Whether deletion is in progress for this chapter */
    isDeleting?: boolean;
}

/**
 * Chapter Row Actions Component
 *
 * Renders download actions for a single chapter row.
 * Uses the unified DownloadButton with search modal.
 *
 * @param props - Component props
 * @returns Action buttons or null
 */
export function ChapterRowActions({
    chapter,
    mangaId,
    mangaTitle,
    volumeNumber,
    onDelete,
    isDeleting
}: ChapterRowActionsProps): JSX.Element | null {
    const [searchModalOpen, setSearchModalOpen] = useState(false);

    const utils = trpc.useUtils();
    const retryMutation = trpc.manga.resetFailedDownloadForChapter.useMutation({
        onSuccess: async (data) => {
            if (mangaId) {
                await Promise.all([
                    utils.manga.get.invalidate({ id: mangaId }),
                    utils.manga.detail.invalidate({ id: mangaId }),
                ]);
            }
            notify({
                severity: data.success ? 'SUCCESS' : 'INFO',
                title: data.success ? 'Retrying Chapter' : 'Nothing to Retry',
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

    // Don't render actions if no mangaId
    if (!mangaId) {
        return null;
    }

    // Build download context for the DownloadButton
    const downloadContext: DownloadContext = {
        type: 'chapter' as const,
        manga: {
            id: mangaId,
            title: mangaTitle ?? 'Unknown',
            source: 'unknown',
        } as unknown as MangaEntity,
        chapter: chapter,
    };

    // Show delete button only for unassigned chapters
    const showDelete = volumeNumber === -1 && onDelete;
    const showRetry = chapter.downloadStatus === ChapterStatus.ERROR;
    const groupWrap = 'nowrap' as const;

    return (
        <Group gap="xs" justify="flex-end" wrap={groupWrap} style={{ width: '100%' }}>
            {showRetry && (
                <Tooltip label="Retry: clear failed-source history and search again" withArrow>
                    <ActionIcon
                        variant="subtle"
                        color="orange"
                        size="sm"
                        onClick={(e) => {
                            e.stopPropagation();
                            retryMutation.mutate({ chapterId: chapter.id });
                        }}
                        loading={retryMutation.isPending}
                        aria-label="Retry chapter download"
                        className={classes['actionIcon']}
                    >
                        <IconRefresh size={16} />
                    </ActionIcon>
                </Tooltip>
            )}

            <DownloadButton
                context={downloadContext}
                onOpenSearch={() => setSearchModalOpen(true)}
                size="xs"
                variant="light"
                compact={true}
            />

            {/* Delete button for unassigned chapters */}
            {showDelete && (
                <ActionIcon
                    variant="subtle"
                    color="red"
                    size="sm"
                    onClick={(e) => {
                        e.stopPropagation();
                        onDelete(chapter.id);
                    }}
                    title="Delete this file"
                    className={classes['actionIcon']}
                    loading={isDeleting ?? false}
                >
                    <IconTrash size={16} />
                </ActionIcon>
            )}

            {/* Unified Search Modal */}
            <UnifiedSearchModal
                opened={searchModalOpen}
                onClose={() => setSearchModalOpen(false)}
                context={downloadContext}
            />
        </Group>
    );
}
