/**
 * Annotation Mutations Hook
 *
 * Centralizes all tRPC mutation setup for the annotation editor.
 * Extracts mutation definitions from the main page component.
 */

import { useRef } from 'react';

import { showNotification } from '@mantine/notifications';
import { useRouter } from 'next/router';

import type { TextSelection } from '@/features/annotation/editor';
import { api } from '@/utils/api';

// ============================================================================
// Types
// ============================================================================

interface AnnotationMutationsParams {
  pageId: string | string[] | undefined;
  setCurrentVersion: (v: number) => void;
  setHasChanges: (v: boolean) => void;
  setSelections: (s: TextSelection[]) => void;
  setUrlAnnotations: (a: Array<{ label: string; url: string; text: string }>) => void;
  setNavigatedPage: (page: { url: string; html: string } | null) => void;
  setIsFetchingPage: (v: boolean) => void;
  refetch: () => void;
}

export interface AnnotationMutationsResult {
  updateLabelsMutation: ReturnType<typeof api.annotation.updateLabels.useMutation>;
  updateStatusMutation: ReturnType<typeof api.annotation.updateStatus.useMutation>;
  updateMangaTitleMutation: ReturnType<typeof api.annotation.updateMangaTitle.useMutation>;
  fetchHtmlOnlyMutation: ReturnType<typeof api.annotation.fetchHtmlOnly.useMutation>;
  addFromUrlMutation: ReturnType<typeof api.annotation.addFromUrl.useMutation>;
  reprocessMutation: ReturnType<typeof api.annotation.reprocess.useMutation>;
  initialDataLoadedRef: React.MutableRefObject<boolean>;
}

// ============================================================================
// Hook
// ============================================================================

export function useAnnotationMutations({
  pageId,
  setCurrentVersion,
  setHasChanges,
  setSelections,
  setUrlAnnotations,
  setNavigatedPage,
  setIsFetchingPage,
  refetch,
}: AnnotationMutationsParams): AnnotationMutationsResult {
  const utils = api.useUtils();
  const router = useRouter();
  const initialDataLoadedRef = useRef(false);

  const updateLabelsMutation = api.annotation.updateLabels.useMutation({
    onSuccess: (data) => {
      setCurrentVersion(data.version);
      void utils.annotation.getById.invalidate({ id: pageId as string });
      void utils.annotation.getStats.invalidate();
    },
  });

  const updateStatusMutation = api.annotation.updateStatus.useMutation();

  const updateMangaTitleMutation = api.annotation.updateMangaTitle.useMutation({
    onSuccess: () => {
      void utils.annotation.getById.invalidate({ id: pageId as string });
      void utils.annotation.getPages.invalidate();
      showNotification({
        title: 'Title Updated',
        message: 'Page title has been saved.',
        color: 'green',
        autoClose: 2000,
      });
    },
    onError: (err) => {
      showNotification({
        title: 'Update Failed',
        message: err.message,
        color: 'red',
      });
    },
  });

  const fetchHtmlOnlyMutation = api.annotation.fetchHtmlOnly.useMutation({
    onSuccess: (data) => {
      setNavigatedPage({ url: data.url, html: data.html });
      setIsFetchingPage(false);
    },
    onError: (err) => {
      setIsFetchingPage(false);
      showNotification({
        title: 'Failed to Load Page',
        message: err.message,
        color: 'red',
      });
    },
  });

  const addFromUrlMutation = api.annotation.addFromUrl.useMutation({
    onSuccess: (data) => {
      setNavigatedPage(null);
      void utils.annotation.getPages.invalidate();
      showNotification({
        title: 'Page Added',
        message: 'The page has been added to training data.',
        color: 'green',
        autoClose: 3000,
      });
      router.push(`/annotation/${data.id}`).catch(console.error);
    },
    onError: (err) => {
      showNotification({
        title: 'Failed to Add Page',
        message: err.message,
        color: 'red',
      });
    },
  });

  const reprocessMutation = api.annotation.reprocess.useMutation({
    onMutate: (variables) => {
      console.warn('[CLIENT] Reprocess mutation starting', { pageId: variables.id, refetch: variables.refetch });
    },
    onSuccess: (data) => {
      console.warn('[CLIENT] Reprocess mutation succeeded', { newVersion: data.version });
      initialDataLoadedRef.current = false;
      setHasChanges(false);
      setCurrentVersion(data.version);
      setSelections([]);
      setUrlAnnotations([]);
      void refetch();
      void utils.annotation.getStats.invalidate();
      showNotification({
        title: 'Reprocess Complete',
        message: 'Page has been re-tokenized with updated ML features.',
        color: 'green',
        autoClose: 3000,
      });
    },
    onError: (error) => {
      console.error('[CLIENT] Reprocess mutation failed', { error: error.message });
    },
  });

  return {
    updateLabelsMutation,
    updateStatusMutation,
    updateMangaTitleMutation,
    fetchHtmlOnlyMutation,
    addFromUrlMutation,
    reprocessMutation,
    initialDataLoadedRef,
  };
}
