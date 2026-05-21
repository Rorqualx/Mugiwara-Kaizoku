/**
 * Custom hook for undoing the last correction in the pattern recognition system
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { notify } from '@/utils/notify';
interface UseUndoLastCorrectionReturn {
  undoLastCorrection: () => void;
  isUndoing: boolean;
}

export const useUndoLastCorrection = (): UseUndoLastCorrectionReturn => {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (): Promise<unknown> => {
      const response = await fetch('/api/pattern-recognition/corrections/undo', {
        method: 'POST'
      });

      if (!response.ok) {
        throw new Error('Failed to undo correction');
      }

      const data: unknown = await response.json();
      return data;
    },
    onSuccess: () => {
      notify({ severity: 'WARNING', title: 'Correction Undone', message: 'The last correction has been reverted' });

      void queryClient.invalidateQueries({ queryKey: ['pattern-learning-metrics'] });
    }
  });

  return {
    undoLastCorrection: mutation.mutate,
    isUndoing: mutation.isPending
  };
};