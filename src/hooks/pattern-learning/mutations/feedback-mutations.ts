/**
 * Feedback Mutations Module
 *
 * React Query mutation hooks for pattern feedback operations.
 *
 * Extracted from: mutations.ts (lines 92-107)
 */

import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';

import { patternLearningQueryKeys } from '../queries';

import { submitFeedback } from './core-mutations';

import type { PatternFeedback } from '../utils';

/**
 * Hook to submit pattern feedback
 */
export function useSubmitFeedback(): UseMutationResult<void, unknown, PatternFeedback, unknown> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: submitFeedback,
    onSuccess: () => {
      // Invalidate metrics query to refresh data
      void queryClient.invalidateQueries({
        queryKey: patternLearningQueryKeys.metrics(),
      });
    },
  });
}