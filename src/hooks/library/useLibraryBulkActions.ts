/**
 * Bulk actions for the library page's selection mode: refresh metadata,
 * remove titles, and change monitoring for every selected title.
 *
 * @module hooks/library/useLibraryBulkActions
 */
import { useNotification } from '@/hooks/useNotification';
import { useLibraryViewStore } from '@/store/index';
import { withRemovalToast } from '@/utils/removalToast';
import { trpc } from '@/utils/trpc-client/index';

/** Handlers returned by {@link useLibraryBulkActions}. */
export interface LibraryBulkActions {
  handleBulkRefresh: () => Promise<void>;
  handleBulkDelete: (deleteFiles: boolean) => Promise<void>;
  handleBulkMonitor: (monitored: boolean) => Promise<void>;
  /** True while the bulk metadata refresh request is in flight. */
  isBulkRefreshPending: boolean;
}

/**
 * @param selectedItems - ids of the selected titles
 * @param refetchAll - reloads the grid from the first page
 */
export function useLibraryBulkActions(
  selectedItems: readonly (string | number)[],
  refetchAll: () => Promise<unknown>,
): LibraryBulkActions {
  const setSelectionMode = useLibraryViewStore(state => state.setSelectionMode);
  const clearSelection = useLibraryViewStore(state => state.clearSelection);
  const { showSuccess, showError } = useNotification();

  const bulkRefreshMutation = trpc.bulk.bulkRefreshMetadata.useMutation();
  const bulkDeleteMutation = trpc.bulk.removeManga.useMutation();
  const bulkMonitorMutation = trpc.manga.bulkToggleMonitoring.useMutation();

  const leaveSelection = (): void => {
    clearSelection();
    setSelectionMode(false);
  };

  const handleBulkRefresh = async (): Promise<void> => {
    try {
      const result = await bulkRefreshMutation.mutateAsync({
        mangaIds: selectedItems.map(id => Number(id))
      });
      showSuccess({
        title: 'Metadata Refresh Queued',
        message: result.message
      });
      leaveSelection();
    } catch (error: unknown) {
      showError({
        title: 'Bulk Refresh Failed',
        message: error instanceof Error ? error.message : 'Failed to queue metadata refresh'
      });
    }
  };

  const handleBulkDelete = async (deleteFiles: boolean): Promise<void> => {
    const count = selectedItems.length;
    const mangaIds = selectedItems.map(id => Number(id));
    await withRemovalToast(
      {
        id: 'bulk-remove-manga',
        processingTitle: 'Removing manga',
        processingMessage: `Removing ${count} manga…`,
        successTitle: 'Bulk Delete Complete',
        successMessage: `${count} manga removed${deleteFiles ? ' along with their files' : ''}`,
        errorTitle: 'Bulk Delete Failed',
        fallbackErrorMessage: 'Failed to delete manga',
      },
      async () => {
        await bulkDeleteMutation.mutateAsync({ mangaIds, deleteFiles });
        // refetchAll refreshes BOTH the paginated query and listTitlesByLibrary,
        // so removed manga leave no ghost skeleton placeholders.
        await refetchAll();
        leaveSelection();
      },
    );
  };

  const handleBulkMonitor = async (monitored: boolean): Promise<void> => {
    try {
      const result = await bulkMonitorMutation.mutateAsync({
        mangaIds: selectedItems.map(id => Number(id)),
        monitored
      });
      showSuccess({
        title: 'Monitoring Updated',
        message: `Updated ${result.totalUpdated} chapters across ${result.mangaCount} manga`
      });
      // The cards show a monitoring badge; without this they kept the old
      // state until the page was reloaded.
      await refetchAll();
      leaveSelection();
    } catch (error: unknown) {
      showError({
        title: 'Monitoring Update Failed',
        message: error instanceof Error ? error.message : 'Failed to update monitoring'
      });
      throw error;
    }
  };

  return {
    handleBulkRefresh,
    handleBulkDelete,
    handleBulkMonitor,
    isBulkRefreshPending: bulkRefreshMutation.isPending,
  };
}
