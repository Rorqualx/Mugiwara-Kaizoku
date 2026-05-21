/**
 * Management Mutations Module
 *
 * React Query mutation hooks for pattern management operations.
 * Includes reset, export, and import functionality.
 *
 * Extracted from: mutations.ts (lines 146-199)
 */

import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';

import { patternLearningQueryKeys } from '../queries';

/**
 * Hook to reset pattern learning data using tRPC
 */
export function useResetPatterns(): UseMutationResult<unknown, unknown, void, unknown> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => {
      // TODO: Fix tRPC type issues
      // return trpc.patternLearning.resetPatterns.mutate();
      throw new Error('tRPC patternLearning not implemented yet');
    },
    onSuccess: () => {
      // Invalidate all pattern learning queries
      void queryClient.invalidateQueries({
        queryKey: patternLearningQueryKeys.all,
      });
    },
  });
}

/**
 * Hook to export pattern data using tRPC
 */
export function useExportPatterns(): UseMutationResult<unknown, unknown, void, unknown> {
  return useMutation({
    mutationFn: () => {
      // TODO: Fix tRPC type issues
      // return trpc.patternLearning.exportPatterns.mutate();
      throw new Error('tRPC patternLearning not implemented yet');
    },
  });
}

/**
 * Hook to import pattern data using tRPC
 */
export function useImportPatterns(): UseMutationResult<unknown, unknown, string, unknown> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (_data: string) => {
      // TODO: Fix tRPC type issues
      // return trpc.patternLearning.importPatterns.mutate(_data);
      throw new Error('tRPC patternLearning not implemented yet');
    },
    onSuccess: () => {
      // Invalidate all pattern learning queries
      void queryClient.invalidateQueries({
        queryKey: patternLearningQueryKeys.all,
      });
    },
  });
}