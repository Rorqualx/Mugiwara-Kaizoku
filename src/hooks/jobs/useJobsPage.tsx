/**
 * Jobs Page Hooks
 *
 * Custom hooks for fetching all job statuses and managing job mutations.
 * Extracted from active.tsx to keep page under 500 lines.
 *
 * @module hooks/jobs/useJobsPage
 */

import React, { useCallback } from 'react';

import { showNotification } from '@mantine/notifications';
import { IconCheck, IconX } from '@tabler/icons-react';

import { JobStatus } from '@/utils/job-validation';
import { trpc } from '@/utils/trpc-client';

// ============================================================================
// Query Hook
// ============================================================================

export interface JobQueriesReturn {
  pendingJobs: unknown[] | undefined;
  activeJobs: unknown[] | undefined;
  retryingJobs: unknown[] | undefined;
  completedJobs: unknown[] | undefined;
  failedJobs: unknown[] | undefined;
  refetchActiveStatuses: () => void;
  refetchAll: () => void;
  refetchCompleted: () => Promise<unknown>;
  refetchFailed: () => Promise<unknown>;
}

// In-progress statuses get a polling fallback so the page keeps updating
// even when the realtime socket is dropped (post-restart, network blips).
// Background polling stays off to avoid wasted DB cycles in hidden tabs.
const IN_PROGRESS_POLL_MS = 2000;
const inProgressQueryOpts = {
  refetchInterval: IN_PROGRESS_POLL_MS,
  refetchIntervalInBackground: false,
} as const;

export function useJobQueries(): JobQueriesReturn {
  const { data: pendingJobs, refetch: refetchPending } = trpc.jobs.getByStatus.useQuery({ status: JobStatus.pending }, inProgressQueryOpts);
  const { data: activeJobs, refetch: refetchActive } = trpc.jobs.getByStatus.useQuery({ status: JobStatus.active }, inProgressQueryOpts);
  const { data: retryingJobs, refetch: refetchRetrying } = trpc.jobs.getByStatus.useQuery({ status: JobStatus.retrying }, inProgressQueryOpts);
  const { data: completedJobs, refetch: refetchCompleted } = trpc.jobs.getByStatus.useQuery({ status: JobStatus.completed });
  const { data: failedJobs, refetch: refetchFailed } = trpc.jobs.getByStatus.useQuery({ status: JobStatus.failed });

  const refetchActiveStatuses = useCallback((): void => {
    void refetchPending(); void refetchActive(); void refetchRetrying();
  }, [refetchPending, refetchActive, refetchRetrying]);

  const refetchAll = useCallback((): void => {
    refetchActiveStatuses(); void refetchCompleted(); void refetchFailed();
  }, [refetchActiveStatuses, refetchCompleted, refetchFailed]);

  return {
    pendingJobs: pendingJobs as unknown[] | undefined,
    activeJobs: activeJobs as unknown[] | undefined,
    retryingJobs: retryingJobs as unknown[] | undefined,
    completedJobs: completedJobs as unknown[] | undefined,
    failedJobs: failedJobs as unknown[] | undefined,
    refetchActiveStatuses, refetchAll,
    refetchCompleted: refetchCompleted as unknown as () => Promise<unknown>,
    refetchFailed: refetchFailed as unknown as () => Promise<unknown>,
  };
}

// ============================================================================
// Mutation Hook
// ============================================================================

export interface JobMutationsReturn {
  cancelTask: ReturnType<typeof trpc.jobs.cancel.useMutation>;
  retryJob: ReturnType<typeof trpc.jobs.retry.useMutation>;
  deleteJob: ReturnType<typeof trpc.jobs.delete.useMutation>;
  deleteAllCompleted: ReturnType<typeof trpc.jobs.deleteCompleted.useMutation>;
  deleteAllFailed: ReturnType<typeof trpc.jobs.deleteFailed.useMutation>;
  retryImport: ReturnType<typeof trpc.jobs.retryImport.useMutation>;
  ignoreDownload: ReturnType<typeof trpc.jobs.ignoreDownload.useMutation>;
  blockRelease: ReturnType<typeof trpc.releaseBlocklist.block.useMutation>;
}

export function useJobMutations(refetchActiveStatuses: () => void): JobMutationsReturn {
  const utils = trpc.useUtils();

  const invalidateAll = useCallback((): void => {
    void utils.jobs.getByStatus.invalidate();
    void utils.activity.query.invalidate();
  }, [utils]);

  // Optimistic removal: the cancel mutation awaits `tryRemoveTorrent` server-side
  // (Transmission/SAB/NZBGet network call, can take 5-10s) *before* flipping the
  // DB row to cancelled. Without optimistic update, the row keeps showing through
  // every poll/refetch until the server-side cancel actually completes — the
  // user reported having to manually refresh to clear the row after cancel+block.
  // Pull the row out of the active/pending/retrying query caches immediately;
  // onSuccess's refetch confirms; onError doesn't need to rollback because the
  // 2s poll will restore the row from the server.
  const cancelTask = trpc.jobs.cancel.useMutation({
    onMutate: async ({ id }) => {
      await utils.jobs.getByStatus.cancel();
      const inProgress = [JobStatus.pending, JobStatus.active, JobStatus.retrying] as const;
      for (const status of inProgress) {
        utils.jobs.getByStatus.setData({ status }, (prev) => {
          if (!prev) return prev;
          return prev.filter((j) => String(j.id) !== id);
        });
      }
    },
    onSuccess: () => {
      showNotification({ title: 'Task Cancelled', message: 'Task has been cancelled', color: 'blue', icon: <IconCheck size={16} /> });
      refetchActiveStatuses();
    },
    onError: (error) => {
      showNotification({ title: 'Error', message: String(error.message), color: 'red', icon: <IconX size={16} /> });
      refetchActiveStatuses();
    },
  });

  const retryJob = trpc.jobs.retry.useMutation({
    onSuccess: () => {
      showNotification({ title: 'Job Retried', message: 'Job queued for retry', color: 'blue', icon: <IconCheck size={16} /> });
      invalidateAll();
    },
    onError: (error) => {
      showNotification({ title: 'Error', message: String(error.message), color: 'red', icon: <IconX size={16} /> });
    },
  });

  const deleteJob = trpc.jobs.delete.useMutation({
    onSuccess: () => {
      showNotification({ title: 'Job Deleted', message: 'Job has been removed', color: 'green', icon: <IconCheck size={16} /> });
      invalidateAll();
    },
    onError: (error) => {
      showNotification({ title: 'Error', message: String(error.message), color: 'red', icon: <IconX size={16} /> });
    },
  });

  const deleteAllCompleted = trpc.jobs.deleteCompleted.useMutation({
    onSuccess: () => {
      showNotification({ title: 'Completed Jobs Cleared', message: 'All completed jobs removed', color: 'green', icon: <IconCheck size={16} /> });
      invalidateAll();
    },
    onError: (error) => {
      showNotification({ title: 'Error', message: String(error.message), color: 'red', icon: <IconX size={16} /> });
    },
  });

  const deleteAllFailed = trpc.jobs.deleteFailed.useMutation({
    onSuccess: () => {
      showNotification({ title: 'Failed Jobs Cleared', message: 'All failed jobs removed', color: 'green', icon: <IconCheck size={16} /> });
      invalidateAll();
    },
    onError: (error) => {
      showNotification({ title: 'Error', message: String(error.message), color: 'red', icon: <IconX size={16} /> });
    },
  });

  const retryImport = trpc.jobs.retryImport.useMutation({
    onSuccess: () => {
      showNotification({ title: 'Import Retry', message: 'Import retry initiated', color: 'teal', icon: <IconCheck size={16} /> });
      invalidateAll();
    },
    onError: (error) => {
      showNotification({ title: 'Error', message: String(error.message), color: 'red', icon: <IconX size={16} /> });
    },
  });

  const ignoreDownload = trpc.jobs.ignoreDownload.useMutation({
    onSuccess: () => {
      showNotification({ title: 'Download Ignored', message: 'Download marked as ignored', color: 'gray', icon: <IconCheck size={16} /> });
      invalidateAll();
    },
    onError: (error) => {
      showNotification({ title: 'Error', message: String(error.message), color: 'red', icon: <IconX size={16} /> });
    },
  });

  // Paired with cancelTask in the "Cancel & blocklist" jobs-page action — the
  // notification fires once per release, but the actual cancel + block run as
  // two awaited mutations from the page handler so failure in either surfaces.
  const blockRelease = trpc.releaseBlocklist.block.useMutation({
    onSuccess: () => {
      showNotification({ title: 'Release Blocklisted', message: 'Release added to blocklist — future searches will skip it', color: 'orange', icon: <IconCheck size={16} /> });
    },
    onError: (error) => {
      showNotification({ title: 'Blocklist Error', message: String(error.message), color: 'red', icon: <IconX size={16} /> });
    },
  });

  return { cancelTask, retryJob, deleteJob, deleteAllCompleted, deleteAllFailed, retryImport, ignoreDownload, blockRelease };
}
