/**
 * Correction Mutations Module
 *
 * React Query mutation hooks for pattern correction operations.
 *
 * Extracted from: mutations.ts (lines 109-124)
 */

import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';

import { patternLearningQueryKeys } from '../queries';

import { submitCorrection } from './core-mutations';

import type { PatternCorrection } from '../utils';

/**
 * Hook to submit pattern correction
 */
export function useSubmitCorrection(): UseMutationResult<void, unknown, PatternCorrection, unknown> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: submitCorrection,
    onSuccess: () => {
      // Invalidate metrics query to refresh data
      void queryClient.invalidateQueries({
        queryKey: patternLearningQueryKeys.metrics(),
      });
    },
  });
}