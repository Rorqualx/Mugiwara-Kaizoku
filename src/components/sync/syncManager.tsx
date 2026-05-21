/**
 * Sync Manager Component
 *
 * This component provides a user interface for managing chapter synchronization
 * tasks across the library. It displays out-of-sync statistics, tracks sync
 * progress, and allows users to initiate and monitor synchronization tasks.
 *
 * Features:
 * - Out-of-sync chapter statistics
 * - Real-time sync progress tracking
 * - Task status visualization
 * - Error handling and retry functionality
 * - Batch sync operations
 * - Task history management
 *
 * @module components/sync/syncManager
 */
import React from "react";
import { useEffect } from 'react';

import { Box, Text, Progress, Timeline, Button, Alert } from '@mantine/core';
import { useInterval } from '@mantine/hooks';

import type { SyncTask } from '@/store/syncSlice';
import { useSyncStore } from '@/store/syncSlice';
// string no longer exists - removed with OutOfSyncChapter model
import { useStoreSelectors } from '@/store/useStoreSelectors';
import { toStringId } from '@/utils/id-converters';
import { toNumberId} from '@/utils/id-converters';
import { JobStatus } from '@/utils/job-validation';
import { logger } from '@/utils/logger';
import { trpc } from '@/utils/trpc-client/index';
// We now use the shared utility functions from id-conversion.ts
/**
 * Sync manager interface component
 *
 * Provides a comprehensive interface for managing chapter synchronization
 * tasks, including progress tracking, error handling, and task management.
 *
 * @returns {JSX.Element} The rendered sync manager interface
 *
 * @example
 * ```tsx
 * <SyncManager />
 * ```
 */
export function SyncManager(): JSX.Element {
    const { outOfSyncStats, currentLibrary } = useStoreSelectors();
    const { syncTasks, addSyncTask: handleSync, updateSyncTask, removeSyncTask, clearCompletedTasks } = useSyncStore();
    /**
     * Poll for sync status updates
     *
     * Checks progress of in-progress tasks every second and
     * updates their status in the store.
     */
    const interval = useInterval(() => {
        syncTasks.filter((task: SyncTask) => task["status"] === JobStatus.active).forEach((task: SyncTask) => { void (async () => {
            try {
                // Use tRPC to check task progress
                const data = await trpc.sync.getTaskStatus.useQuery({
                    taskId: toStringId(task["id"])
                });
                updateSyncTask(task["id"], {
                    progress: data.data?.progress ?? 0,
                    status: (data.data?.status as JobStatus | undefined) ?? JobStatus.failed,
                    ...(data.error?.message ? { error: data.error.message } : {})
                });
            }
            catch (error: unknown) {
                logger.error(`Failed to get status for task ${task["id"]}:`, error);
            }
        })(); });
    }, 1000);
    /**
     * Effect to manage polling interval
     *
     * Starts polling when there are active tasks and stops
     * when all tasks are complete.
     */
    useEffect(() => {
        if (syncTasks.some((task: SyncTask) => task["status"] === JobStatus.active)) {
            interval.start();
        }
        else {
            interval.stop();
        }
    }, [syncTasks, interval]);
    return <Box>
      <Text size="xl" mb="md">Sync Manager</Text>

      {outOfSyncStats.total > 0 && <Alert title={`${outOfSyncStats.total} chapters out of sync`} color="yellow" mb="md">

          <Box fz="sm">
            {Object.entries(outOfSyncStats.byManga).map(([mangaId, count]: [
                string,
                number
            ]) => <Box key={mangaId}>
                {`${count} chapters in ${currentLibrary?.mangas.find((m: {
                    id: number | string;
                    title: string;
                }) => typeof m["id"] === 'number' ? m["id"] === toNumberId(mangaId) : m["id"] === mangaId)?.title}`}
              </Box>)}
          </Box>
          <Button variant="light" color="yellow" size="sm" mt="xs" onClick={() => {
                Object.keys(outOfSyncStats.byManga).forEach(mangaId => {
                    // Use our safe ID conversion function
                    handleSync(toNumberId(mangaId));
                });
            }}>

            Sync All
          </Button>
        </Alert>}

      <Timeline active={syncTasks.findIndex((t: SyncTask) => t["status"] === JobStatus.active)}>
        {syncTasks.map((task: SyncTask) => <Timeline.Item key={task["id"]} title={`Syncing ${currentLibrary?.mangas.find((m: {
                id: number | string;
                title: string;
            }) => typeof m["id"] === 'number' ? m["id"] === task.mangaId : toNumberId(m["id"]) === task.mangaId)?.title}`} bullet={task["status"] === JobStatus.completed ? '✓' : task["status"] === JobStatus.failed ? '✗' : '●'}>

            {task["status"] === JobStatus.active && <Box mb="xs">
                <Text size="sm" mb={4}>{`${task.progress}%`}</Text>
                <Progress value={task.progress} size="sm"/>

              </Box>}
            {task["status"] === JobStatus.failed && task.error && <Alert color="red" mb="xs">
                {task.error}
                <Button variant="subtle" color="red" size="xs" ml="auto" onClick={() => {
                    removeSyncTask(task["id"]);
                    // Ensure we're using a numeric ID
                    handleSync(toNumberId(task.mangaId));
                }}>

                  Retry
                </Button>
              </Alert>}
            <Text size="xs" color="dimmed">
              Started {new Date(task.startedAt).toLocaleString()}
            </Text>
          </Timeline.Item>)}
      </Timeline>

      {syncTasks.some((t: SyncTask) => t["status"] === JobStatus.completed) && <Button variant="subtle" size="sm" onClick={() => { void clearCompletedTasks(); }}>

          Clear Completed
        </Button>}
    </Box>;
}
