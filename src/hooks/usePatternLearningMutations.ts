/**
 * Pattern Learning Mutations Hook
 * 
 * Handles all API mutations for pattern learning operations.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { notify } from '@/utils/notify';
import { isObject, isNumber } from '@/utils/type-guards';

export interface ExtractedData {
  title?: string;
  description?: string;
  author?: string[];
  chapters?: number;
  volumes?: number;
  status?: string;
  [key: string]: unknown;
}

interface CorrectionFeedback {
  corrections: Record<string, unknown>;
  userConfidence: number;
  teachingMode: boolean;
  url: string;
  patternsUsed: string[];
  originalConfidence: number;
}

// API Response Types
interface SubmitCorrectionResponse {
  improvement: number;
}

interface BatchCorrectionResponse {
  processed: number;
  successRate: number;
}

interface TrainingResponse {
  patternsLearned: number;
}

// Type guards
function isSubmitCorrectionResponse(value: unknown): value is SubmitCorrectionResponse {
  return isObject(value) && 'improvement' in value && isNumber(value['improvement']);
}

function isBatchCorrectionResponse(value: unknown): value is BatchCorrectionResponse {
  return isObject(value) &&
    'processed' in value && isNumber(value['processed']) &&
    'successRate' in value && isNumber(value['successRate']);
}

function isTrainingResponse(value: unknown): value is TrainingResponse {
  return isObject(value) && 'patternsLearned' in value && isNumber(value['patternsLearned']);
}

interface UsePatternLearningMutationsReturn {
  submitCorrections: ReturnType<typeof useMutation<SubmitCorrectionResponse, Error, {
    originalData: ExtractedData;
    correctedData: ExtractedData;
    feedback: CorrectionFeedback;
  }>>;
  submitBatchCorrections: ReturnType<typeof useMutation<BatchCorrectionResponse, Error, Array<{
    originalData: ExtractedData;
    correctedData: ExtractedData;
    feedback: CorrectionFeedback;
  }>>>;
  trainOnExamples: ReturnType<typeof useMutation<TrainingResponse, Error, Array<{
    html: string;
    url: string;
    expected: ExtractedData;
  }>>>;
  undoLastCorrection: ReturnType<typeof useMutation<unknown, Error, void>>;
}

export const usePatternLearningMutations = (): UsePatternLearningMutationsReturn => {
  const queryClient = useQueryClient();

  // Submit corrections mutation
  const submitCorrections = useMutation({
    mutationFn: async ({
      originalData,
      correctedData,
      feedback
    }: {
      originalData: ExtractedData;
      correctedData: ExtractedData;
      feedback: CorrectionFeedback;
    }): Promise<SubmitCorrectionResponse> => {
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

  // Batch correction for multiple items
  const submitBatchCorrections = useMutation({
    mutationFn: async (corrections: Array<{
      originalData: ExtractedData;
      correctedData: ExtractedData;
      feedback: CorrectionFeedback;
    }>): Promise<BatchCorrectionResponse> => {
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

  // Train on specific examples
  const trainOnExamples = useMutation({
    mutationFn: async (examples: Array<{
      html: string;
      url: string;
      expected: ExtractedData;
    }>): Promise<TrainingResponse> => {
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

  // Undo last correction
  const undoLastCorrection = useMutation({
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
    submitCorrections,
    submitBatchCorrections,
    trainOnExamples,
    undoLastCorrection
  };
};
