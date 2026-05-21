/**
 * DownloadManagerModal component for managing downloads
 *
 * This component provides a modal interface for viewing and managing
 * the download queue and currently downloading items.
 *
 * Now uses WebSocket for real-time updates with fallback to polling.
 */
import React, { useState, useCallback, useMemo, useEffect } from 'react';

import { Modal, ScrollArea, Table, Button, Group, Text, Stack, Divider, Badge, ActionIcon, Progress, Tabs, Alert, Tooltip } from '@mantine/core';
import { modals } from '@mantine/modals';
import { IconDownload, IconPlayerPause, IconTrash, IconRefresh, IconAlertCircle, IconCheck, IconX, IconClock, IconWifi, IconWifiOff } from '@tabler/icons-react';

import { useRealTime } from '@/providers/RealTimeProvider';
import type { WebSocketEvent } from '@/types/api/v1/websocket';
import { toNumberId } from '@/utils/id-converters';
import { JobStatus, JobType } from '@/utils/job-validation';
import { notify } from '@/utils/notify';
import { trpc } from '@/utils/trpc-client/index';

interface DownloadManagerModalProps {
    opened: boolean;
    onClose: () => void;
}
export function DownloadManagerModal({ opened, onClose }: DownloadManagerModalProps): React.ReactElement {
    const [selectedTab, setSelectedTab] = useState<string>('active');
    const { isConnected, subscribe } = useRealTime();
    const utils = trpc.useUtils();

    // Use polling only when WebSocket is disconnected
    const fallbackPollingInterval = isConnected ? false : 3000;

    // Fetch all tasks and filter for downloads
    const downloadJobsQuery = trpc.jobs.getAll.useQuery(undefined, {
        enabled: opened,
        refetchInterval: fallbackPollingInterval
    });

    // Subscribe to download updates via WebSocket. The handler is defined inside
    // the effect so we don't depend on a memoized callback whose identity may
    // churn — repeated unsubscribe/resubscribe risks missing events between
    // teardown and the next subscribe.
    useEffect(() => {
        if (!opened) return;
        const handleDownloadUpdate = (_event: WebSocketEvent): void => {
            void utils.jobs.getAll.invalidate();
        };
        const unsubscribeDownloads = subscribe('downloads:progress', handleDownloadUpdate);
        const unsubscribeJobs = subscribe('jobs:active', handleDownloadUpdate);
        return () => {
            unsubscribeDownloads();
            unsubscribeJobs();
        };
    }, [opened, subscribe, utils]);
    // Get available mutations
    const cancelTaskMutation = trpc.jobs.cancel.useMutation();
    const retryTaskMutation = trpc.jobs.retry.useMutation();
    // Filter tasks by type and status
    const downloadJobs = useMemo(() => {
        if (!downloadJobsQuery.data)
            return [];
        // Filter for download-related tasks
        return downloadJobsQuery.data.jobs.filter((task: unknown) => {
            const t = task as Record<string, unknown>;
            return t["type"] === JobType.chapter_download || t["type"] === 'DOWNLOAD_VOLUME' || t["type"] === 'DOWNLOAD_PACK';
        });
    }, [downloadJobsQuery.data]);
    const activeJobs = useMemo(() => {
        return downloadJobs.filter((task: unknown) => {
            const t = task as Record<string, unknown>;
            return t["status"] === JobStatus.active || t["status"] === JobStatus.pending;
        });
    }, [downloadJobs]);
    const completedTasks = useMemo(() => {
        return downloadJobs.filter((task: unknown) => {
            const t = task as Record<string, unknown>;
            return t["status"] === JobStatus.completed;
        });
    }, [downloadJobs]);
    const failedTasks = useMemo(() => {
        return downloadJobs.filter((task: unknown) => {
            const t = task as Record<string, unknown>;
            return t["status"] === JobStatus.failed;
        });
    }, [downloadJobs]);
    const getStatusBadge = useCallback((status: JobStatus): React.ReactElement => {
        const statusConfig: Record<string, { color: string; icon: React.ReactNode }> = {
            'pending': {
                color: 'gray',
                icon: <IconClock size={14}/>
            },
            'active': {
                color: 'blue',
                icon: <IconDownload size={14}/>
            },
            'completed': {
                color: 'green',
                icon: <IconCheck size={14}/>
            },
            'failed': {
                color: 'red',
                icon: <IconX size={14}/>
            },
            'cancelled': {
                color: 'orange',
                icon: <IconX size={14}/>
            },
            'retrying': {
                color: 'yellow',
                icon: <IconRefresh size={14}/>
            },
            'paused': {
                color: 'yellow',
                icon: <IconPlayerPause size={14}/>
            }
        };
        const config = statusConfig[status as string] ?? {
            color: 'gray',
            icon: null
        };
        return <Badge color={config.color} size="sm" leftSection={config.icon}>

        {status}
      </Badge>;
    }, []);
    const handlePauseTask = useCallback((_taskId: number): Promise<void> => {
        // Pause functionality not yet implemented in backend
        notify({ severity: 'WARNING', title: 'Not Available', message: 'Pause functionality is not yet implemented' });
        return Promise.resolve();
    }, []);
    const handleCancelTask = useCallback(async (taskId: number) => {
        const confirmed = await new Promise<boolean>((resolve) => {
            modals.openConfirmModal({
                title: 'Cancel download',
                centered: true,
                children: <Text size="sm">Are you sure you want to cancel this download?</Text>,
                labels: { confirm: 'Cancel download', cancel: 'Keep downloading' },
                confirmProps: { color: 'red' },
                onConfirm: () => resolve(true),
                onCancel: () => resolve(false),
                onClose: () => resolve(false),
            });
        });
        if (!confirmed) {
            return;
        }
        try {
            await cancelTaskMutation.mutateAsync({
                id: taskId.toString()
            });
            notify({ severity: 'WARNING', title: 'Task Cancelled', message: 'Download task has been cancelled' });
        }
        catch (error: unknown) {
            notify({ severity: 'ERROR', title: 'Failed to Cancel', message: error instanceof Error ? error.message : 'Failed to cancel task' });
        }
    }, [cancelTaskMutation]);
    const handleRetryTask = useCallback(async (taskId: number) => {
        try {
            await retryTaskMutation.mutateAsync({
                id: taskId.toString()
            });
            notify({ severity: 'INFO', title: 'Task Retried', message: 'Download task has been queued for retry' });
        }
        catch (error: unknown) {
            notify({ severity: 'ERROR', title: 'Failed to Retry', message: error instanceof Error ? error.message : 'Failed to retry task' });
        }
    }, [retryTaskMutation]);
    const renderTaskRow = useCallback((task: unknown): React.ReactElement => {
        const t = task as Record<string, unknown>;
        const metadata = (t["metadata"] ?? {}) as Record<string, unknown>;
        const progress = typeof metadata["progress"] === 'number' ? metadata["progress"] : 0;
        const mangaTitle = (metadata["mangaTitle"] ?? 'Unknown Manga') as string;
        const chapterTitle = (metadata["chapterTitle"] ?? 'Unknown Chapter') as string;
        const taskStatus = t["status"] as string;
        const taskId = t["id"];

        return <Table.Tr key={String(taskId)}>
        <Table.Td>
          <Stack gap={2}>
            <Text size="sm" fw={500}>{mangaTitle}</Text>
            <Text size="xs" c="dimmed">{chapterTitle}</Text>
          </Stack>
        </Table.Td>
        <Table.Td>{getStatusBadge(taskStatus as JobStatus)}</Table.Td>
        <Table.Td>
          {taskStatus === JobStatus.active ? <Progress value={progress} size="sm" animated/> : null}
        </Table.Td>
        <Table.Td>
          <Group gap="xs">
            {taskStatus === JobStatus.active ? <ActionIcon variant="subtle" size="sm" onClick={() => { void handlePauseTask(toNumberId(taskId)); }} title="Pause download">

                <IconPlayerPause size={16}/>
              </ActionIcon> : taskStatus === JobStatus.failed ? <ActionIcon variant="subtle" size="sm" onClick={() => { void handleRetryTask(toNumberId(taskId)); }} title="Retry download">

                <IconRefresh size={16}/>
              </ActionIcon> : null}

            {taskStatus !== JobStatus.completed ? <ActionIcon variant="subtle" size="sm" color="red" onClick={() => { void handleCancelTask(toNumberId(taskId)); }} title="Cancel download">

                <IconTrash size={16}/>
              </ActionIcon> : null}
          </Group>
        </Table.Td>
      </Table.Tr>;
    }, [getStatusBadge, handlePauseTask, handleCancelTask, handleRetryTask]);
    return <Modal opened={opened} onClose={() => { void onClose(); }} title="Download Manager" size="xl">

      <Stack gap="md">
        <Group justify="space-between">
          <Text size="sm" c="dimmed">
            Manage your download queue and monitor download progress.
          </Text>
          <Tooltip label={isConnected ? 'Real-time updates active' : 'Using fallback polling'}>
            <Badge
              color={isConnected ? 'green' : 'yellow'}
              variant="light"
              leftSection={isConnected ? <IconWifi size={12} /> : <IconWifiOff size={12} />}
              size="sm"
            >
              {isConnected ? 'Live' : 'Polling'}
            </Badge>
          </Tooltip>
        </Group>
        
        <Divider />
        
        <Tabs value={selectedTab} onChange={value => setSelectedTab(value ?? 'active')}>
          <Tabs.List>
            <Tabs.Tab value="active" leftSection={<IconDownload size={14}/>}>
              Active ({activeJobs.length})
            </Tabs.Tab>
            <Tabs.Tab value="completed" leftSection={<IconCheck size={14}/>}>
              Completed ({completedTasks.length})
            </Tabs.Tab>
            <Tabs.Tab value="failed" leftSection={<IconAlertCircle size={14}/>}>
              Failed ({failedTasks.length})
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="active" pt="md">
            {activeJobs.length === 0 ? <Alert icon={<IconAlertCircle size={16}/>} title="No Active Downloads" color="gray">

                There are no active downloads at the moment.
              </Alert> : <ScrollArea style={{
                height: 400
            }}>
                <Table highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Manga / Chapter</Table.Th>
                      <Table.Th>Status</Table.Th>
                      <Table.Th>Progress</Table.Th>
                      <Table.Th w={100}>Actions</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {activeJobs.map(renderTaskRow)}
                  </Table.Tbody>
                </Table>
              </ScrollArea>}
          </Tabs.Panel>

          <Tabs.Panel value="completed" pt="md">
            {completedTasks.length === 0 ? <Alert icon={<IconAlertCircle size={16}/>} title="No Completed Downloads" color="gray">

                No downloads have been completed yet.
              </Alert> : <ScrollArea style={{
                height: 400
            }}>
                <Table highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Manga / Chapter</Table.Th>
                      <Table.Th>Status</Table.Th>
                      <Table.Th>Progress</Table.Th>
                      <Table.Th w={100}>Actions</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {completedTasks.map(renderTaskRow)}
                  </Table.Tbody>
                </Table>
              </ScrollArea>}
          </Tabs.Panel>

          <Tabs.Panel value="failed" pt="md">
            {failedTasks.length === 0 ? <Alert icon={<IconCheck size={16}/>} title="No Failed Downloads" color="green">

                Great! No downloads have failed.
              </Alert> : <ScrollArea style={{
                height: 400
            }}>
                <Table highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Manga / Chapter</Table.Th>
                      <Table.Th>Status</Table.Th>
                      <Table.Th>Progress</Table.Th>
                      <Table.Th w={100}>Actions</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {failedTasks.map(renderTaskRow)}
                  </Table.Tbody>
                </Table>
              </ScrollArea>}
          </Tabs.Panel>
        </Tabs>
        
        <Group gap="sm" justify="flex-end">
          <Button variant="outline" onClick={() => { void onClose(); }}>
            Close
          </Button>
        </Group>
      </Stack>
    </Modal>;
}
