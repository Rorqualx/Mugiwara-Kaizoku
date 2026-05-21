/**
 * useVolumeTableState Hook
 *
 * Manages delete mutations and deletion state for VolumeChaptersTable.
 *
 * @module components/volumeChapters/hooks/useVolumeTableState
 */

import { useState, useCallback, useMemo } from 'react';

import { notifications } from '@mantine/notifications';

import { logger } from '@/utils/logger';
import { notify } from '@/utils/notify';
import { trpc } from '@/utils/trpc-client';

import type { Chapter } from '@prisma/client';

interface UseVolumeTableStateParams {
  mangaId: number | undefined;
  volumeNumber: number;
  chapters: Chapter[];
  onForceRefresh?: (() => void) | undefined;
}

interface UseVolumeTableStateResult {
  deletingChapterId: number | undefined;
  handleDeleteChapter: (chapterId: number) => void;
  handleDeleteAllUnassigned: () => void;
  isDeletingAll: boolean;
}

function showSuccessNotification(message: string): void {
  notifications.show({ title: 'Deleted', message, color: 'green' });
}

function showErrorNotification(message: string): void {
  notifications.show({ title: 'Error', message, color: 'red' });
}

/**
 * Hook for managing chapter deletion state and mutations
 */
export function useVolumeTableState(params: UseVolumeTableStateParams): UseVolumeTableStateResult {
  const { mangaId, volumeNumber, chapters, onForceRefresh } = params;
  const utils = trpc.useUtils();
  const [deletingChapterId, setDeletingChapterId] = useState<number | undefined>(undefined);

  const invalidateAndRefresh = useCallback(() => {
    if (mangaId) {
      void utils.manga.get.invalidate({ id: mangaId });
      void utils.manga.detail.invalidate({ id: mangaId });
    }
    onForceRefresh?.();
  }, [mangaId, utils, onForceRefresh]);

  const deleteChaptersMutation = trpc.chapter.deleteMany.useMutation({
    onSuccess: (result) => {
      logger.info('[useVolumeTableState] deleteMany:', result);
      if (result.status === 'success') showSuccessNotification(result.data.message);
      invalidateAndRefresh();
    },
    onError: (error) => showErrorNotification(error.message)
  });

  const deleteChapterMutation = trpc.chapter.deleteOne.useMutation({
    onSuccess: (result) => {
      if (result.status === 'success') showSuccessNotification(result.data.message);
      invalidateAndRefresh();
      setDeletingChapterId(undefined);
    },
    onError: (error) => {
      showErrorNotification(error.message);
      setDeletingChapterId(undefined);
    }
  });

  const handleDeleteChapter = useCallback((chapterId: number): void => {
    if (!mangaId || volumeNumber !== -1) return;
    setDeletingChapterId(chapterId);
    deleteChapterMutation.mutate({ mangaId, chapterId });
  }, [mangaId, volumeNumber, deleteChapterMutation]);

  const chapterIdsToDelete = useMemo(() => {
    if (!mangaId || volumeNumber !== -1) return [];
    return chapters.filter(ch => ch.mangaId === mangaId).map(ch => ch.id);
  }, [mangaId, volumeNumber, chapters]);

  const handleDeleteAllUnassigned = useCallback((): void => {
    if (!mangaId || volumeNumber !== -1) return;
    if (chapterIdsToDelete.length === 0) {
      notify({ severity: 'WARNING', title: 'No chapters', message: 'No unassigned chapters to delete' });
      return;
    }
    deleteChaptersMutation.mutate({ mangaId, chapterIds: chapterIdsToDelete });
  }, [mangaId, volumeNumber, chapterIdsToDelete, deleteChaptersMutation]);

  return { deletingChapterId, handleDeleteChapter, handleDeleteAllUnassigned, isDeletingAll: deleteChaptersMutation.isPending };
}
