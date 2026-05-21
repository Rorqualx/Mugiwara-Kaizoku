/**
 * Native Downloads Component
 *
 * Displays and manages download queue for Custom Website Sources.
 * Uses real tRPC hooks for data fetching and mutations.
 *
 * @module native-download/NativeDownloads
 */
import React from 'react';

import { Paper, Table, Badge, Progress, ActionIcon, Group, Text, Stack, Alert, LoadingOverlay, Tooltip } from '@mantine/core';
import { NativeDownloadStatus } from '@prisma/client';
import { IconX, IconRefresh, IconReload } from '@tabler/icons-react';

import { notify } from '@/utils/notify';
import { mapToMangaStatus } from '@/utils/status-mapper';
import { trpc } from '@/utils/trpc-client';


import type { NativeDownload } from '@prisma/client';

/**
 * Extended download type with computed properties
 */
type DownloadWithSource = NativeDownload;

export function NativeDownloads(): React.ReactElement {
    const utils = trpc.useUtils();

    // Real tRPC query for downloads
    const downloadsQuery = trpc.nativeDownload.getDownloads.useQuery({});

    // Cancel download mutation
    const cancelDownload = trpc.nativeDownload.cancelDownload.useMutation({
        onSuccess: () => {
            void utils.nativeDownload.getDownloads.invalidate();
            notify({ severity: 'WARNING', title: 'Download cancelled', message: 'Download has been cancelled' });
        },
        onError: (error: { message?: string }) => {
            notify({ severity: 'ERROR', title: 'Failed to cancel download', message: error.message ?? 'Unknown error' });
        }
    });

    // Retry download mutation
    const retryDownload = trpc.nativeDownload.retryDownload.useMutation({
        onSuccess: () => {
            void utils.nativeDownload.getDownloads.invalidate();
            notify({ severity: 'SUCCESS', title: 'Download retried', message: 'Download has been queued for retry' });
        },
        onError: (error: { message?: string }) => {
            notify({ severity: 'ERROR', title: 'Failed to retry download', message: error.message ?? 'Unknown error' });
        }
    });
    const getStatusColor = (status: NativeDownloadStatus): string => {
        return mapToMangaStatus(status);
    };
    const formatDuration = (start: Date, end?: Date | null): string => {
        const startTime = new Date(start).getTime();
        const endTime = end ? new Date(end).getTime() : Date.now();
        const duration = Math.floor((endTime - startTime) / 1000);
        if (duration < 60)
            return `${duration}s`;
        if (duration < 3600)
            return `${Math.floor(duration / 60)}m ${duration % 60}s`;
        return `${Math.floor(duration / 3600)}h ${Math.floor(duration % 3600 / 60)}m`;
    };
    if (downloadsQuery.isError) {
        return (
            <Alert color="red" title="Error loading downloads">
                {downloadsQuery.error.message}
            </Alert>
        );
    }

    const downloads = (downloadsQuery.data ?? []) as DownloadWithSource[];

    return (
        <Paper p="md" pos="relative">
            <LoadingOverlay visible={downloadsQuery.isLoading} />

            <Stack gap="md">
                <Group justify="space-between">
                    <Text fw={600}>Download Queue</Text>
                    <Tooltip label="Refresh downloads">
                        <ActionIcon
                            onClick={() => { void utils.nativeDownload.getDownloads.invalidate(); }}
                            loading={downloadsQuery.isFetching}
                        >
                            <IconRefresh size={18} />
                        </ActionIcon>
                    </Tooltip>
                </Group>

                {downloads.length === 0 ? (
                    <Alert color="blue">
                        No active downloads. Search for manga to start downloading.
                    </Alert>
                ) : (
                    <Table>
                        <Table.Thead>
                            <Table.Tr>
                                <Table.Th>Source</Table.Th>
                                <Table.Th>Chapter</Table.Th>
                                <Table.Th>Status</Table.Th>
                                <Table.Th>Progress</Table.Th>
                                <Table.Th>Duration</Table.Th>
                                <Table.Th>Actions</Table.Th>
                            </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                            {downloads.map((download) => (
                                <Table.Tr key={download.id}>
                                    <Table.Td>
                                        <Text size="sm" fw={500}>
                                            {download.sourceType ?? 'Unknown'}
                                        </Text>
                                    </Table.Td>
                                    <Table.Td>
                                        <Text size="sm">
                                            Chapter {download.chapterNumber}
                                        </Text>
                                    </Table.Td>
                                    <Table.Td>
                                        <Badge color={getStatusColor(download.status)}>
                                            {download.status}
                                        </Badge>
                                    </Table.Td>
                                    <Table.Td>
                                        <Stack gap="xs">
                                            <Progress
                                                value={download.progress}
                                                size="sm"
                                                color={download.status === NativeDownloadStatus.FAILED ? 'red' : 'blue'}
                                            />
                                            <Text size="xs" c="dimmed">
                                                {download.progress}%
                                            </Text>
                                        </Stack>
                                    </Table.Td>
                                    <Table.Td>
                                        <Text size="sm" c="dimmed">
                                            {formatDuration(download.startTime, download.endTime)}
                                        </Text>
                                    </Table.Td>
                                    <Table.Td>
                                        <Group gap="xs">
                                            {/* Retry button for failed/cancelled downloads */}
                                            {(download.status === NativeDownloadStatus.FAILED ||
                                              download.status === NativeDownloadStatus.CANCELLED) && (
                                                <Tooltip label="Retry download">
                                                    <ActionIcon
                                                        variant="subtle"
                                                        color="green"
                                                        onClick={() => retryDownload.mutate({ id: download.id })}
                                                        loading={retryDownload.isPending}
                                                    >
                                                        <IconReload size={16} />
                                                    </ActionIcon>
                                                </Tooltip>
                                            )}
                                            {/* Cancel button for active downloads */}
                                            {(download.status === NativeDownloadStatus.QUEUED ||
                                              download.status === NativeDownloadStatus.DOWNLOADING) && (
                                                <Tooltip label="Cancel download">
                                                    <ActionIcon
                                                        variant="subtle"
                                                        color="red"
                                                        onClick={() => {
                                                            if (confirm('Cancel this download?')) {
                                                                cancelDownload.mutate({ id: download.id });
                                                            }
                                                        }}
                                                        loading={cancelDownload.isPending}
                                                    >
                                                        <IconX size={16} />
                                                    </ActionIcon>
                                                </Tooltip>
                                            )}
                                        </Group>
                                    </Table.Td>
                                </Table.Tr>
                            ))}
                        </Table.Tbody>
                    </Table>
                )}
            </Stack>
        </Paper>
    );
}
