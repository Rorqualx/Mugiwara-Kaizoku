/**
 * Page Action Handlers for Annotation Editor
 *
 * Extracts handleSave, handleMarkReviewed, handleReprocess from main component.
 */

import { useCallback } from 'react';

import { showNotification } from '@mantine/notifications';

import type { DisplayToken, TextSelection } from '@/features/annotation/editor';

import type { UseMutationResult } from '@tanstack/react-query';


// ============================================================================
// Types
// ============================================================================

interface SaveParams {
  pageId: string | string[] | undefined;
  tokens: DisplayToken[];
  selections: TextSelection[];
  urlAnnotations: Array<{ label: string; url: string; text: string }>;
  currentVersion: number;
  isSaving: boolean;
  setIsSaving: (v: boolean) => void;
  setHasChanges: (v: boolean) => void;
  updateLabelsMutation: UseMutationResult<{ version: number }, unknown, {
    id: string;
    labels: string[];
    selections?: TextSelection[] | undefined;
    urlAnnotations?: Array<{ label: string; url: string; text: string }> | undefined;
    version?: number | undefined;
  }>;
}

interface MarkReviewedParams {
  pageId: string | string[] | undefined;
  hasChanges: boolean;
  handleSave: () => Promise<boolean>;
  updateStatusMutation: UseMutationResult<unknown, unknown, { id: string; status: string }>;
  navigateToList: () => void;
}

interface ReprocessParams {
  pageId: string | string[] | undefined;
  hasChanges: boolean;
  handleSave: () => Promise<boolean>;
  refetchHtml: boolean;
  setRefetchHtml: (v: boolean) => void;
  reprocessMutation: UseMutationResult<{ version: number }, unknown, { id: string; refetch: boolean }>;
}

// ============================================================================
// Helper: Show save error notification
// ============================================================================

function showSaveError(error: unknown): void {
  const trpcError = error as { data?: { code?: string }; message?: string };
  const isConflict = trpcError.data?.code === 'CONFLICT';

  showNotification({
    title: isConflict ? 'Save Conflict' : 'Save Failed',
    message: isConflict
      ? 'This page was modified by another user. Please refresh to see the latest changes.'
      : (trpcError.message ?? 'Unable to save annotations. Please try again.'),
    color: 'red',
    autoClose: isConflict ? false : 5000,
  });
}

// ============================================================================
// useHandleSave
// ============================================================================

export function useHandleSave({
  pageId,
  tokens,
  selections,
  urlAnnotations,
  currentVersion,
  isSaving,
  setIsSaving,
  setHasChanges,
  updateLabelsMutation,
}: SaveParams): () => Promise<boolean> {
  return useCallback(async (): Promise<boolean> => {
    if (!pageId || typeof pageId !== 'string' || isSaving) return false;

    setIsSaving(true);

    try {
      await updateLabelsMutation.mutateAsync({
        id: pageId,
        labels: tokens.map((t) => t.label),
        selections: selections.length > 0 ? selections : undefined,
        urlAnnotations: urlAnnotations.length > 0 ? urlAnnotations : undefined,
        version: currentVersion,
      });
      setHasChanges(false);
      showNotification({ title: 'Saved', message: 'Annotations saved successfully', color: 'green', autoClose: 2000 });
      return true;
    } catch (error) {
      showSaveError(error);
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [pageId, tokens, selections, urlAnnotations, currentVersion, isSaving, setIsSaving, setHasChanges, updateLabelsMutation]);
}

// ============================================================================
// useHandleMarkReviewed
// ============================================================================

export function useHandleMarkReviewed({
  pageId,
  hasChanges,
  handleSave,
  updateStatusMutation,
  navigateToList,
}: MarkReviewedParams): () => Promise<void> {
  return useCallback(async (): Promise<void> => {
    if (!pageId || typeof pageId !== 'string') return;

    if (hasChanges) {
      const saved = await handleSave();
      if (!saved) {
        showNotification({ title: 'Cannot Mark Reviewed', message: 'Please save your changes first.', color: 'red', autoClose: 5000 });
        return;
      }
    }

    try {
      await updateStatusMutation.mutateAsync({ id: pageId, status: 'REVIEWED' });
      navigateToList();
    } catch {
      showNotification({ title: 'Status Update Failed', message: 'Could not mark as reviewed.', color: 'red', autoClose: 5000 });
    }
  }, [pageId, hasChanges, handleSave, updateStatusMutation, navigateToList]);
}

// ============================================================================
// useHandleReprocess
// ============================================================================

export function useHandleReprocess({
  pageId,
  hasChanges,
  handleSave,
  refetchHtml,
  setRefetchHtml,
  reprocessMutation,
}: ReprocessParams): () => Promise<void> {
  return useCallback(async (): Promise<void> => {
    if (!pageId || typeof pageId !== 'string') return;

    if (hasChanges) {
      const msg = 'You have unsaved changes. Reprocessing will overwrite your annotations.\n\nClick OK to save first, then reprocess.';
      if (!window.confirm(msg)) return;

      const saved = await handleSave();
      if (!saved) {
        showNotification({ title: 'Cannot Reprocess', message: 'Please resolve the save issue first.', color: 'red', autoClose: 5000 });
        return;
      }
    }

    await reprocessMutation.mutateAsync({ id: pageId, refetch: refetchHtml });
    setRefetchHtml(false);
  }, [pageId, hasChanges, handleSave, refetchHtml, setRefetchHtml, reprocessMutation]);
}
