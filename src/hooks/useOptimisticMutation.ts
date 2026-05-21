import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';

import { useNotification } from './useNotification';

import type { ApiError as APIError } from '../types/api/v1/errors';

// Using APIError from domain types instead of defining a local interface

/**
 * Configuration options for optimistic mutations
 * 
 * @interface OptimisticConfig
 * @template TData Type of data returned by mutation
 * @template TVariables Type of variables passed to mutation
 * @property {(variables: TVariables) => Promise<TData>} mutationFn - Function that performs the mutation
 * @property {(variables: TVariables) => Promise<TData>} [onMutate] - Function to perform optimistic update
 * @property {string[]} [invalidateQueries] - Query keys to invalidate after mutation
 * @property {string} [successMessage] - Message to show on success
 * @property {string} [errorMessage] - Message to show on error
 */
interface OptimisticConfig<TData = unknown, TVariables = unknown> {
  mutationFn: (variables: TVariables) => Promise<TData>;
  onMutate?: (variables: TVariables) => Promise<TData>;
  invalidateQueries?: string[];
  successMessage?: string;
  errorMessage?: string;
}

/**
 * Hook for performing mutations with optimistic updates
 * 
 * This hook wraps react-query's useMutation with optimistic update functionality.
 * It automatically handles rolling back optimistic updates on error, showing
 * success/error notifications, and invalidating related queries.
 * 
 * @template TData Type of data returned by mutation
 * @template TVariables Type of variables passed to mutation
 * @param {OptimisticConfig<TData, TVariables>} config - Configuration options
 * @returns {UseMutationResult<AsyncResult<TData, APIError>>} Mutation result with all react-query mutation functionality
 * 
 * @example
 * ```tsx
 * const mutation = useOptimisticMutation({
 *   mutationFn: updateManga,
 *   onMutate: (variables) => ({
 *     ...manga,
 *     ...variables
 *   }),
 *   invalidateQueries: ['manga'],
 *   successMessage: 'Manga updated successfully'
 * });
 * ```
 */
export function useOptimisticMutation<TData = unknown, TVariables = unknown>({
  mutationFn,
  onMutate,
  invalidateQueries = [],
  successMessage,
  errorMessage,
}: OptimisticConfig<TData, TVariables>): UseMutationResult<TData, unknown, TVariables, { previousData: unknown[] }> {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useNotification();

  return useMutation({
    mutationFn,
    onMutate: async (variables) => {
      // Cancel any outgoing refetches
      await Promise.all(
        invalidateQueries.map((query) =>
          queryClient.cancelQueries({ queryKey: [query] })
        )
      );

      // Save the previous value
      const previousData = invalidateQueries.map((query) =>
        queryClient.getQueryData([query])
      );

      // Perform optimistic update
      if (onMutate) {
        const optimisticData = await onMutate(variables);
        invalidateQueries.forEach((query) => {
          // Use double assertion for generic query data handling
          // This is necessary because query data types are dynamic
          queryClient.setQueryData([query], optimisticData as unknown as never);
        });
      }

      return { previousData };
    },
    onSuccess: () => {
      if (successMessage) {
        showSuccess({
          title: 'Success',
          message: successMessage,
        });
      }
    },
    onError: (error: unknown, _variables: unknown, context: { previousData: unknown[] } | undefined) => {
      // Rollback to previous value
      if (context?.previousData) {
        invalidateQueries.forEach((query, index) => {
          const previousValue = context.previousData[index];
          if (previousValue !== undefined) {
            queryClient.setQueryData([query], previousValue);
          }
        });
      }

      const errorMsg = errorMessage || 
        (error instanceof Error ? error.message : 
        typeof error === 'object' && error !== null && 'message' in error ? 
        (error as APIError).message : 'An unknown error occurred');

      showError({
        title: 'Error',
        message: errorMsg,
      });
    },
    onSettled: () => {
      // Invalidate relevant queries
      void Promise.all(
        invalidateQueries.map((query) =>
          queryClient.invalidateQueries({ queryKey: [query] })
        )
      );
    },
  });
}
