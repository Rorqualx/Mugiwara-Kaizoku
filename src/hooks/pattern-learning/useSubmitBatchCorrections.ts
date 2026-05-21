/**
 * Custom hook for submitting batch corrections to the pattern recognition system
 */

import { useMutation } from '@tanstack/react-query';

import { notify } from '@/utils/notify';
import { isObject, isNumber } from '@/utils/type-guards';

import type { ExtractedData } from './types';

interface CorrectionFeedback {
  corrections: Record<string, unknown>;
  userConfidence: number;
  teachingMode: boolean;
  url: string;
  patternsUsed: string[];
  originalConfidence: number;
}

interface BatchCorrectionItem {
  originalData: ExtractedData;
  correctedData: ExtractedData;
  feedback: CorrectionFeedback;
}

interface BatchCorrectionResponse {
  processed: number;
  successRate: number;
}

// Type guard for batch correction response
function isBatchCorrectionResponse(value: unknown): value is BatchCorrectionResponse {
  return isObject(value) &&
    'processed' in value && isNumber(value['processed']) &&
    'successRate' in value && isNumber(value['successRate']);
}

interface UseSubmitBatchCorrectionsReturn {
  submitBatchCorrections: (corrections: BatchCorrectionItem[]) => void;
  isSubmitting: boolean;
}

export const useSubmitBatchCorrections = (): UseSubmitBatchCorrectionsReturn => {
  const mutation = useMutation({
    mutationFn: async (corrections: BatchCorrectionItem[]): Promise<BatchCorrectionResponse> => {
      const response = await fetch('/api/pattern-recognition/feedback/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ corrections })
      });

      if (!response.ok) {
        throw new Error('Failed to submit batch corrections');
      }

      const data: unknown = await response.json();
      if (isBatchCorrectionResponse(data)) {
        return data;
      }
      throw new Error('Invalid response format');
    },
    onSuccess: (data) => {
      notify({ severity: 'SUCCESS', title: 'Batch Learning Complete', message: `Processed ${data.processed} corrections. Success rate: ${(data.successRate * 100).toFixed(1)}%` });
    }
  });

  return {
    submitBatchCorrections: mutation.mutate,
    isSubmitting: mutation.isPending
  };
};