/**
 * Mutation Callbacks for Annotation Editor
 *
 * Extracts mutation onSuccess/onError handlers from the main page component.
 */

import { showNotification } from '@mantine/notifications';

// ============================================================================
// Update Labels Callbacks
// ============================================================================

export interface UpdateLabelsCallbacksParams {
  setCurrentVersion: (v: number) => void;
  invalidateGetById: () => void;
  invalidateStats: () => void;
}

export function createUpdateLabelsCallbacks({
  setCurrentVersion,
  invalidateGetById,
  invalidateStats,
}: UpdateLabelsCallbacksParams): { onSuccess: (data: { version: number }) => void } {
  return {
    onSuccess: (data) => {
      setCurrentVersion(data.version);
      invalidateGetById();
      invalidateStats();
    },
  };
}

// ============================================================================
// Update Manga Title Callbacks
// ============================================================================

export interface UpdateMangaTitleCallbacksParams {
  invalidateGetById: () => void;
  invalidatePages: () => void;
}

export function createUpdateMangaTitleCallbacks({
  invalidateGetById,
  invalidatePages,
}: UpdateMangaTitleCallbacksParams): { onSuccess: () => void; onError: (err: { message: string }) => void } {
  return {
    onSuccess: () => {
      invalidateGetById();
      invalidatePages();
      showNotification({ title: 'Title Updated', message: 'Page title has been saved.', color: 'green', autoClose: 2000 });
    },
    onError: (err) => {
      showNotification({ title: 'Update Failed', message: err.message, color: 'red' });
    },
  };
}

// ============================================================================
// Fetch HTML Only Callbacks
// ============================================================================

export interface FetchHtmlOnlyCallbacksParams {
  setNavigatedPage: (page: { url: string; html: string } | null) => void;
  setIsFetchingPage: (v: boolean) => void;
}

export function createFetchHtmlOnlyCallbacks({
  setNavigatedPage,
  setIsFetchingPage,
}: FetchHtmlOnlyCallbacksParams): { onSuccess: (data: { url: string; html: string }) => void; onError: (err: { message: string }) => void } {
  return {
    onSuccess: (data) => {
      setNavigatedPage({ url: data.url, html: data.html });
      setIsFetchingPage(false);
    },
    onError: (err) => {
      setIsFetchingPage(false);
      showNotification({ title: 'Failed to Load Page', message: err.message, color: 'red' });
    },
  };
}

// ============================================================================
// Add From URL Callbacks
// ============================================================================

export interface AddFromUrlCallbacksParams {
  setNavigatedPage: (page: { url: string; html: string } | null) => void;
  invalidatePages: () => void;
  navigateToPage: (id: string) => void;
}

export function createAddFromUrlCallbacks({
  setNavigatedPage,
  invalidatePages,
  navigateToPage,
}: AddFromUrlCallbacksParams): { onSuccess: (data: { id: string }) => void; onError: (err: { message: string }) => void } {
  return {
    onSuccess: (data) => {
      setNavigatedPage(null);
      invalidatePages();
      showNotification({ title: 'Page Added', message: 'The page has been added to training data.', color: 'green', autoClose: 3000 });
      navigateToPage(data.id);
    },
    onError: (err) => {
      showNotification({ title: 'Failed to Add Page', message: err.message, color: 'red' });
    },
  };
}

// ============================================================================
// Reprocess Callbacks
// ============================================================================

export interface ReprocessCallbacksParams {
  initialDataLoadedRef: React.MutableRefObject<boolean>;
  setHasChanges: (v: boolean) => void;
  setCurrentVersion: (v: number) => void;
  setSelections: (s: []) => void;
  setUrlAnnotations: (a: []) => void;
  refetch: () => void;
  invalidateStats: () => void;
}

export function createReprocessCallbacks({
  initialDataLoadedRef,
  setHasChanges,
  setCurrentVersion,
  setSelections,
  setUrlAnnotations,
  refetch,
  invalidateStats,
}: ReprocessCallbacksParams): { onSuccess: (data: { version: number }) => void } {
  return {
    onSuccess: (data) => {
      // eslint-disable-next-line no-param-reassign -- Refs are mutable by design
      initialDataLoadedRef.current = false;
      setHasChanges(false);
      setCurrentVersion(data.version);
      setSelections([]);
      setUrlAnnotations([]);
      refetch();
      invalidateStats();
      showNotification({ title: 'Reprocess Complete', message: 'Page has been re-tokenized.', color: 'green', autoClose: 3000 });
    },
  };
}
