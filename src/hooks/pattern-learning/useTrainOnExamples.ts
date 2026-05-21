/**
 * Custom hook for training the pattern recognition system on specific examples
 */

import { useMutation } from '@tanstack/react-query';

import { notify } from '@/utils/notify';
import { isObject, isNumber } from '@/utils/type-guards';

import type { ExtractedData } from './types';

interface TrainingExample {
  html: string;
  url: string;
  expected: ExtractedData;
}

interface TrainingResponse {
  patternsLearned: number;
}

// Type guard for training response
function isTrainingResponse(value: unknown): value is TrainingResponse {
  return isObject(value) && 'patternsLearned' in value && isNumber(value['patternsLearned']);
}

interface UseTrainOnExamplesReturn {
  trainOnExamples: (examples: TrainingExample[]) => void;
  isTraining: boolean;
}

export const useTrainOnExamples = (): UseTrainOnExamplesReturn => {
  const mutation = useMutation({
    mutationFn: async (examples: TrainingExample[]): Promise<TrainingResponse> => {
      const response = await fetch('/api/pattern-recognition/train', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ examples })
      });

      if (!response.ok) {
        throw new Error('Failed to train');
      }

      const data: unknown = await response.json();
      if (isTrainingResponse(data)) {
        return data;
      }
      throw new Error('Invalid response format');
    },
    onSuccess: (data) => {
      notify({ severity: 'SUCCESS', title: 'Training Complete', message: `Learned ${data.patternsLearned} new patterns` });
    }
  });

  return {
    trainOnExamples: mutation.mutate,
    isTraining: mutation.isPending
  };
};