/**
 * Pattern Learning Hook
 * 
 * Provides React integration for the Pattern Recognition Engine,
 * enabling user corrections and real-time learning feedback.
 */

import { useState, useCallback, useEffect } from 'react';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useRealTime } from '@/providers/RealTimeProvider';
import { notify } from '@/utils/notify';

import { isObject, isNumber } from '../utils/type-guards';

import {
  getSuggestions as getSuggestionsUtil,
  validateCorrections as validateCorrectionsUtil,
  getCorrectionHistory as getCorrectionHistoryUtil,
  exportCorrections as exportCorrectionsUtil,
  type ExtractedData,
  type PatternSuggestion
} from './pattern-learning-utils';
import { usePatternLearningWebSocket } from './usePatternLearningWebSocket';

export type { ExtractedData };


interface CorrectionFeedback {
  corrections: Record<string, unknown>;
  userConfidence: number;
  teachingMode: boolean;
  url: string;
  patternsUsed: string[];
  originalConfidence: number;
}

interface LearningMetrics {
  totalCorrections: number;
  improvementRate: number;
  averageConfidence: number;
  patternsLearned: number;
  lastTrainingDate: Date | null;
}


// API Response Types
interface MetricsResponse {
  totalCorrections: number;
  improvementRate: number;
  averageConfidence: number;
  patternsLearned: number;
  lastTrainingDate: string | null;
}

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


interface ConfidenceResponse {
  confidence: number;
}

// Type guards
function isMetricsResponse(value: unknown): value is MetricsResponse {
  return isObject(value) &&
    'totalCorrections' in value && isNumber(value['totalCorrections']) &&
    'improvementRate' in value && isNumber(value['improvementRate']) &&
    'averageConfidence' in value && isNumber(value['averageConfidence']) &&
    'patternsLearned' in value && isNumber(value['patternsLearned']);
}

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


function isConfidenceResponse(value: unknown): value is ConfidenceResponse {
  return isObject(value) && 'confidence' in value && isNumber(value['confidence']);
}

interface UsePatternLearningReturn {
  learningMetrics: LearningMetrics | MetricsResponse;
  learningStatus: {
    isLearning: boolean;
    progress: number;
    currentPattern: string | null;
  };
  performanceHistory: unknown;
  submitCorrections: (params: {
    originalData: ExtractedData;
    correctedData: ExtractedData;
    feedback: CorrectionFeedback;
  }) => void;
  submitBatchCorrections: (corrections: Array<{
    originalData: ExtractedData;
    correctedData: ExtractedData;
    feedback: CorrectionFeedback;
  }>) => void;
  getSuggestions: (data: ExtractedData, url: string) => Promise<PatternSuggestion[]>;
  validateCorrections: (original: ExtractedData, corrected: ExtractedData) => {
    isValid: boolean;
    errors: string[];
  };
  trainOnExamples: (examples: Array<{
    html: string;
    url: string;
    expected: ExtractedData;
  }>) => void;
  getCorrectionHistory: (url: string) => Promise<unknown>;
  undoLastCorrection: () => void;
  exportCorrections: () => Promise<void>;
  isSubmitting: boolean;
  isTraining: boolean;
  isUndoing: boolean;
}

export const usePatternLearning = (): UsePatternLearningReturn => {
  const queryClient = useQueryClient();

  // WebSocket connection for real-time updates
  const { isConnected, subscribe } = useRealTime();

  const [learningMetrics, setLearningMetrics] = useState<LearningMetrics>({
    totalCorrections: 0,
    improvementRate: 0,
    averageConfidence: 0,
    patternsLearned: 0,
    lastTrainingDate: null
  });

  // Fetch learning metrics with WebSocket + polling fallback
  const { data: metrics, refetch: refetchMetrics } = useQuery({
    queryKey: ['pattern-learning-metrics'],
    queryFn: async (): Promise<MetricsResponse | null> => {
      const response = await fetch('/api/pattern-recognition/metrics');
      const data: unknown = await response.json();
      if (isMetricsResponse(data)) {
        return data;
      }
      return null;
    },
    refetchInterval: isConnected ? false : 60000 // Only poll when WebSocket disconnected
  });

  // Subscribe to WebSocket pattern learning events for real-time updates
  useEffect(() => {
    if (!isConnected) return;

    const unsubscribe = subscribe('pattern:learning', () => {
      void refetchMetrics();
      void queryClient.invalidateQueries({ queryKey: ['pattern-performance'] });
    });

    return unsubscribe;
  }, [isConnected, subscribe, refetchMetrics, queryClient]);

  // Submit corrections mutation
  const submitCorrections = useMutation({
    mutationFn: async ({
      originalData,
      correctedData,
      feedback

    }: {originalData: ExtractedData;correctedData: ExtractedData;feedback: CorrectionFeedback;}): Promise<SubmitCorrectionResponse> => {
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
      // Update local metrics
      setLearningMetrics((prev) => ({
        ...prev,
        totalCorrections: prev.totalCorrections + 1,
        lastTrainingDate: new Date()
      }));

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

  // Get AI suggestions for corrections
  const getSuggestions = useCallback(
    async (data: ExtractedData, url: string): Promise<PatternSuggestion[]> => {
      return getSuggestionsUtil(data, url);
    },
    []
  );

  // Validate corrections before submission
  const validateCorrections = useCallback(
    (original: ExtractedData, corrected: ExtractedData): { isValid: boolean; errors: string[] } => {
      return validateCorrectionsUtil(original, corrected);
    },
    []
  );

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

  // Get pattern performance history
  const { data: performanceHistory } = useQuery({
    queryKey: ['pattern-performance'],
    queryFn: async (): Promise<unknown> => {
      const response = await fetch('/api/pattern-recognition/performance');
      const data: unknown = await response.json();
      return data;
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

  // Real-time learning status
  const [learningStatus, setLearningStatus] = useState<{
    isLearning: boolean;
    progress: number;
    currentPattern: string | null;
  }>({
    isLearning: false,
    progress: 0,
    currentPattern: null
  });

  // WebSocket for real-time learning updates
  usePatternLearningWebSocket({
    setLearningStatus
  });

  // Get correction history for a URL
  const getCorrectionHistory = useCallback(
    async (url: string): Promise<unknown> => {
      return getCorrectionHistoryUtil(url);
    },
    []
  );

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

  // Export corrections for review
  const exportCorrections = useCallback(async (): Promise<void> => {
    return exportCorrectionsUtil();
  }, []);

  return {
    // State
    learningMetrics: metrics ?? learningMetrics,
    learningStatus,
    performanceHistory,

    // Actions
    submitCorrections: submitCorrections.mutate,
    submitBatchCorrections: submitBatchCorrections.mutate,
    getSuggestions,
    validateCorrections,
    trainOnExamples: trainOnExamples.mutate,
    getCorrectionHistory,
    undoLastCorrection: undoLastCorrection.mutate,
    exportCorrections,

    // Loading states
    isSubmitting: submitCorrections.isPending,
    isTraining: trainOnExamples.isPending,
    isUndoing: undoLastCorrection.isPending
  };
};

// Helper hook for real-time pattern confidence with WebSocket + polling fallback
export const usePatternConfidence = (patternId: string): number => {
  const [confidence, setConfidence] = useState<number>(0);

  // WebSocket connection for real-time updates
  const { isConnected, subscribe } = useRealTime();

  // Fetch confidence function
  const fetchConfidence = useCallback(async (): Promise<void> => {
    try {
      const response = await fetch(
        `/api/pattern-recognition/patterns/${patternId}/confidence`
      );
      const data: unknown = await response.json();
      if (isConfidenceResponse(data)) {
        setConfidence(data.confidence);
      }
    } catch (error: unknown) {
      console.error('Error fetching pattern confidence:', error);
    }
  }, [patternId]);

  // Initial fetch
  useEffect(() => {
    void fetchConfidence();
  }, [fetchConfidence]);

  // WebSocket subscription for real-time updates
  useEffect(() => {
    if (!isConnected) return;

    const unsubscribe = subscribe('pattern:learning', () => {
      void fetchConfidence();
    });

    return unsubscribe;
  }, [isConnected, subscribe, fetchConfidence]);

  // Fallback polling only when WebSocket disconnected
  useEffect(() => {
    if (isConnected) return; // Skip polling when WebSocket is connected

    const interval = setInterval(() => {
      void fetchConfidence();
    }, 30000); // Update every 30 seconds

    return () => clearInterval(interval);
  }, [isConnected, fetchConfidence]);

  return confidence;
};

// Hook for pattern evolution tracking with WebSocket + polling fallback
export const usePatternEvolution = (patternId: string): ReturnType<typeof useQuery<unknown>> => {
  // WebSocket connection for real-time updates
  const { isConnected, subscribe } = useRealTime();

  const query = useQuery({
    queryKey: ['pattern-evolution', patternId],
    queryFn: async (): Promise<unknown> => {
      const response = await fetch(
        `/api/pattern-recognition/patterns/${patternId}/evolution`
      );
      const data: unknown = await response.json();
      return data;
    },
    refetchInterval: isConnected ? false : 60000 // Only poll when WebSocket disconnected
  });

  // Subscribe to WebSocket pattern learning events for real-time updates
  useEffect(() => {
    if (!isConnected) return;

    const unsubscribe = subscribe('pattern:learning', () => {
      void query.refetch();
    });

    return unsubscribe;
  }, [isConnected, subscribe, query]);

  return query;
};
