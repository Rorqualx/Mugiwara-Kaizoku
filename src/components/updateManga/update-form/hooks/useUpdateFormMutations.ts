/**
 * useUpdateFormMutations Hook
 *
 * Manages tRPC mutations for updating and removing manga.
 * Extracted to reduce component complexity and fix ESLint violations.
 *
 * @module components/updateManga/update-form/hooks/useUpdateFormMutations
 */

import type { JSX } from 'react';
import React, { useState, useCallback } from 'react';

import { showNotification } from '@mantine/notifications';
import { IconCheck, IconX } from '@tabler/icons-react';

import { toNumberId } from '@/utils/id-converters';
import { logger } from '@/utils/logger';
import { withRemovalToast } from '@/utils/removalToast';
import { trpc } from '@/utils/trpc-client';

import type { FormValues } from '../types';

/**
 * Props for the useUpdateFormMutations hook
 */
interface UseUpdateFormMutationsProps {
  mangaTitle: string;
  onUpdate: () => void;
  onClose?: (() => void) | undefined;
  resetForm: () => void;
}

/**
 * Return type for the useUpdateFormMutations hook
 */
interface UseUpdateFormMutationsReturn {
  handleSubmit: (values: FormValues) => Promise<void>;
  handleRemoveManga: (mangaId: number | string, shouldRemoveFiles: boolean) => Promise<void>;
  isUpdating: boolean;
  isRemoving: boolean;
  loading: boolean;
  error: string | null;
  clearError: () => void;
}

/**
 * Hook for managing update form mutations
 *
 * @param props - Hook configuration
 * @returns Mutation handlers and loading/error states
 */
export function useUpdateFormMutations({
  mangaTitle,
  onUpdate,
  onClose,
  resetForm,
}: UseUpdateFormMutationsProps): UseUpdateFormMutationsReturn {
  const [updateError, setUpdateError] = useState<Error | null>(null);
  const [removeError, setRemoveError] = useState<Error | null>(null);

  // Direct tRPC mutation access - no unnecessary conditionals
  const updateMutation = trpc.manga.update.useMutation();
  const removeMutation = trpc.manga.remove.useMutation();
  const utils = trpc.useUtils();

  // Derived states
  const isUpdating = updateMutation.isPending;
  const isRemoving = removeMutation.isPending;
  const loading = isUpdating || isRemoving;
  const error = updateError?.message ?? removeError?.message ?? null;

  // Clear error handler
  const clearError = useCallback((): void => {
    setUpdateError(null);
    setRemoveError(null);
  }, []);

  /**
   * Handles form submission for manga updates
   */
  const handleSubmit = useCallback(async (values: FormValues): Promise<void> => {
    setUpdateError(null);

    const mangaId = toNumberId(values.id);
    if (mangaId === 0) {
      const err = new Error('Invalid manga ID');
      setUpdateError(err);
      showNotification({
        icon: React.createElement(IconX, { size: 18 }) as JSX.Element,
        color: 'red',
        title: 'Update Failed',
        message: 'Invalid manga ID',
      });
      return;
    }

    try {
      await updateMutation.mutateAsync({
        id: mangaId,
        title: values.title,
        anilistId: values.anilistId || undefined,  // Convert empty string to undefined
      });

      onUpdate();
      resetForm();

      showNotification({
        icon: React.createElement(IconCheck, { size: 18 }) as JSX.Element,
        color: 'teal',
        title: 'Manga Updated',
        message: `${mangaTitle} updated successfully.`,
      });

      onClose?.();
    } catch (err: unknown) {
      const errorObj = err instanceof Error ? err : new Error(String(err ?? 'Unknown error updating manga'));
      setUpdateError(errorObj);

      showNotification({
        icon: React.createElement(IconX, { size: 18 }) as JSX.Element,
        color: 'red',
        title: 'Update Failed',
        message: errorObj.message,
      });
    }
  }, [updateMutation, onUpdate, resetForm, mangaTitle, onClose]);

  /**
   * Handles manga removal from the library
   */
  const handleRemoveManga = useCallback(async (
    mangaId: number | string,
    shouldRemoveFiles: boolean
  ): Promise<void> => {
    if (!mangaId) return;

    setRemoveError(null);

    const numericId = typeof mangaId === 'string' ? toNumberId(mangaId) : mangaId;
    if (isNaN(numericId)) {
      const err = new Error('Invalid manga ID');
      setRemoveError(err);

      logger.error('UpdateForm: Invalid manga ID');
      showNotification({
        icon: React.createElement(IconX, { size: 18 }) as JSX.Element,
        color: 'red',
        title: 'Removal Failed',
        message: 'Invalid manga ID',
      });
      return;
    }

    logger.info(`UpdateForm: Removing manga ID ${numericId}, shouldRemoveFiles: ${shouldRemoveFiles}`);
    const filesSuffix = shouldRemoveFiles ? ' along with its files' : '';

    try {
      // Loading toast → await removal AND the library refetch (so the card is
      // gone and no ghost skeleton lingers) → success. Fixes the success toast
      // firing seconds before the grid updated.
      await withRemovalToast(
        {
          id: `remove-manga-${numericId}`,
          processingTitle: 'Removing manga',
          processingMessage: `Removing “${mangaTitle}”…`,
          successTitle: 'Manga Removed',
          successMessage: `“${mangaTitle}” was removed${filesSuffix}`,
          errorTitle: 'Removal Failed',
          fallbackErrorMessage: 'Failed to remove manga',
        },
        async () => {
          await removeMutation.mutateAsync({ id: numericId, shouldRemoveFiles });
          await Promise.all([
            utils.manga.query.invalidate(),
            utils.manga.listTitlesByLibrary.invalidate(),
          ]);
        },
      );

      logger.info('UpdateForm: Successfully removed manga');
      // Rebuild from page 0 (covers multi-page libraries), then close the modal.
      onUpdate();
      onClose?.();
    } catch (err: unknown) {
      logger.error('UpdateForm: Error removing manga:', err);
      // Error toast already shown by withRemovalToast.
      setRemoveError(err instanceof Error ? err : new Error(String(err ?? 'Unknown error removing manga')));
    }
  }, [removeMutation, onClose, onUpdate, mangaTitle, utils]);

  return {
    handleSubmit,
    handleRemoveManga,
    isUpdating,
    isRemoving,
    loading,
    error,
    clearError,
  };
}

export default useUpdateFormMutations;
