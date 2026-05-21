/**
 * Custom hooks for Job History Page
 */
import { useState, useCallback, useMemo } from 'react';

import { showNotification } from '@mantine/notifications';

import { trpc } from '@/utils/trpc-client';

import { isRecord } from './helpers';

import type { JobStatus, JobType, Prisma } from '@prisma/client';

/**
 * Job data structure from the API
 */
interface JobItem {
  id: bigint | string;
  job_type: JobType;
  status: JobStatus;
  progress: number | null;
  created_at: Date | null;
  started_at: Date | null;
  completed_at: Date | null;
  attempt_count: number;
  last_error: Prisma.JsonValue | null;
  metadata: Prisma.JsonValue | null;
  manga_id: number | null;
  manga: { id: number; title: string; libraryPath: string | null } | null;
  chapter: { id: number; title: string | null; chapterNumber: number | null } | null;
}

interface JobsData {
  jobs: JobItem[];
  pagination?: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

interface UseJobSelectionReturn {
  selectedIds: Set<string>;
  taskIds: string[];
  allSelected: boolean;
  someSelected: boolean;
  handleSelectAll: () => void;
  handleSelectItem: (id: string) => void;
  clearSelection: () => void;
}

/**
 * Hook for managing job selection state
 */
export function useJobSelection(jobsData: JobsData | undefined): UseJobSelectionReturn {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const taskIds = useMemo((): string[] => {
    const tasks = jobsData?.jobs ?? [];
    return tasks.filter(isRecord).map(task => String(task['id']));
  }, [jobsData?.jobs]);

  const allSelected = taskIds.length > 0 && taskIds.every(id => selectedIds.has(id));
  const someSelected = taskIds.some(id => selectedIds.has(id));

  const handleSelectAll = useCallback((): void => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(taskIds));
    }
  }, [allSelected, taskIds]);

  const handleSelectItem = useCallback((id: string): void => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const clearSelection = useCallback((): void => {
    setSelectedIds(new Set());
  }, []);

  return {
    selectedIds,
    taskIds,
    allSelected,
    someSelected,
    handleSelectAll,
    handleSelectItem,
    clearSelection
  };
}

interface UseBulkDeleteReturn {
  deleteByIds: ReturnType<typeof trpc.jobs.deleteByIds.useMutation>;
  deleteCompleted: ReturnType<typeof trpc.jobs.deleteCompleted.useMutation>;
  deleteFailed: ReturnType<typeof trpc.jobs.deleteFailed.useMutation>;
  handleDeleteSelected: () => void;
  handleDeleteCompleted: () => void;
  handleDeleteFailed: () => void;
  isDeleting: boolean;
}

/**
 * Hook for bulk delete operations
 */
export function useBulkDelete(
  selectedIds: Set<string>,
  clearSelection: () => void,
  refetch: () => Promise<unknown>
): UseBulkDeleteReturn {
  const utils = trpc.useUtils();

  const deleteByIds = trpc.jobs.deleteByIds.useMutation({
    onSuccess: async (result) => {
      showNotification({
        title: 'Jobs Deleted',
        message: `Successfully deleted ${result.deleted} job${result.deleted === 1 ? '' : 's'}`,
        color: 'green'
      });
      clearSelection();
      await utils.jobs.getAll.invalidate();
      await utils.activity.query.invalidate();
      await refetch();
    },
    onError: (error) => {
      showNotification({
        title: 'Error',
        message: error instanceof Error ? error.message : 'Failed to delete jobs',
        color: 'red'
      });
    }
  });

  const deleteCompleted = trpc.jobs.deleteCompleted.useMutation({
    onSuccess: async (result) => {
      showNotification({
        title: 'Completed Jobs Deleted',
        message: `Successfully deleted ${result.count} completed job${result.count === 1 ? '' : 's'}`,
        color: 'green'
      });
      clearSelection();
      await utils.jobs.getAll.invalidate();
      await utils.activity.query.invalidate();
      await refetch();
    },
    onError: (error) => {
      showNotification({
        title: 'Error',
        message: error instanceof Error ? error.message : 'Failed to delete completed jobs',
        color: 'red'
      });
    }
  });

  const deleteFailed = trpc.jobs.deleteFailed.useMutation({
    onSuccess: async (result) => {
      showNotification({
        title: 'Failed Jobs Deleted',
        message: `Successfully deleted ${result.count} failed job${result.count === 1 ? '' : 's'}`,
        color: 'green'
      });
      clearSelection();
      await utils.jobs.getAll.invalidate();
      await utils.activity.query.invalidate();
      await refetch();
    },
    onError: (error) => {
      showNotification({
        title: 'Error',
        message: error instanceof Error ? error.message : 'Failed to delete failed jobs',
        color: 'red'
      });
    }
  });

  const handleDeleteSelected = useCallback((): void => {
    if (selectedIds.size === 0) return;
    void deleteByIds.mutateAsync({ ids: Array.from(selectedIds) });
  }, [selectedIds, deleteByIds]);

  const handleDeleteCompleted = useCallback((): void => {
    void deleteCompleted.mutateAsync();
  }, [deleteCompleted]);

  const handleDeleteFailed = useCallback((): void => {
    void deleteFailed.mutateAsync();
  }, [deleteFailed]);

  const isDeleting = deleteByIds.isPending || deleteCompleted.isPending || deleteFailed.isPending;

  return {
    deleteByIds,
    deleteCompleted,
    deleteFailed,
    handleDeleteSelected,
    handleDeleteCompleted,
    handleDeleteFailed,
    isDeleting
  };
}
