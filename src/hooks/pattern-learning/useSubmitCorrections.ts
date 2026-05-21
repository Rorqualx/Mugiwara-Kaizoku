/**
 * Custom hook for submitting individual corrections to the pattern recognition system
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { notify } from '@/utils/notify';
import { isObject, isNumber } from '@/utils/type-guards';

import type { ExtractedData } from './types';

export interface CorrectionFeedback {
  corrections: Record<string, unknown>;
  userConfidence: number;
  teachingMode: boolean;
  url: string;
  patternsUsed: string[];
  originalConfidence: number;
}

interface SubmitCorrectionResponse {
  improvement: number;
}

interface SubmitCorrectionsParams {
  originalData: ExtractedData;
  correctedData: ExtractedData;
  feedback: CorrectionFeedback;
}

// Type guard for submit correction response
function isSubmitCorrectionResponse(value: unknown): value is SubmitCorrectionResponse {
  return isObject(value) && 'improvement' in value && isNumber(value['improvement']);
}

interface UseSubmitCorrectionsReturn {
  submitCorrections: (params: SubmitCorrectionsParams) => void;
  isSubmitting: boolean;
}

export const useSubmitCorrections = (): UseSubmitCorrectionsReturn => {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async ({
      originalData,
      correctedData,
      feedback
    }: SubmitCorrectionsParams): Promise<SubmitCorrectionResponse> => {
      const response = await fetch('/api/pattern-recognition/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          original: originalData,
          corrected: correctedData,
          feedback
        })
      });

      if (!response.ok) {
        throw new Error('Failed to submit corrections');
      }

      const data: unknown = await response.json();
      if (isSubmitCorrectionResponse(data)) {
        return data;
      }
      throw new Error('Invalid response format');
    },
    onSuccess: (data) => {
      // Invalidate related queries
      void queryClient.invalidateQueries({ queryKey: ['pattern-learning-metrics'] });
      void queryClient.invalidateQueries({ queryKey: ['pattern-performance'] });

      // Show success notification
      notify({ severity: 'SUCCESS', title: 'Learning Successful', message: `Pattern confidence improved by ${(data.improvement * 100).toFixed(1)}%` });
    },
    onError: (error) => {
      notify({ severity: 'ERROR', title: 'Learning Failed', message: (error instanceof Error ? error.message : String(error)) });
    }
  });

  return {
    submitCorrections: mutation.mutate,
    isSubmitting: mutation.isPending
  };
};