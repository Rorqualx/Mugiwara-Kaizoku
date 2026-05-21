/**
 * Training Mutations Module
 *
 * React Query mutation hooks for pattern training operations.
 *
 * Extracted from: mutations.ts (lines 126-144)
 */

import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';

import { patternLearningQueryKeys } from '../queries';

import { triggerTraining } from './core-mutations';

/**
 * Hook to trigger pattern training using tRPC
 */
export function useTriggerTraining(): UseMutationResult<void, unknown, void, unknown> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: triggerTraining,
    onSuccess: () => {
      // Invalidate training status and metrics queries
      void queryClient.invalidateQueries({
        queryKey: patternLearningQueryKeys.trainingStatus(),
      });
      void queryClient.invalidateQueries({
        queryKey: patternLearningQueryKeys.metrics(),
      });
    },
  });
}