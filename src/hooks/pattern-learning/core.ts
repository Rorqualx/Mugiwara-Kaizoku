/**
 * Pattern Learning Core Hook
 *
 * Main React hook for pattern learning functionality including:
 * - User correction submission
 * - Real-time learning metrics
 * - Batch correction processing
 * - Training on examples
 * - WebSocket integration for real-time updates
 *
 * Extracted from: usePatternLearning.ts (lines 151-523)
 * Refactored to use extracted modules for ESLint compliance
 */

import { useState, useEffect } from 'react';

import { useQuery, useQueryClient } from '@tanstack/react-query';

import { useRealTime } from '@/providers/RealTimeProvider';

// Import from foundation types
import {
  useSubmitCorrections,
  useSubmitBatchCorrections,
  useTrainOnExamples,
  useUndoLastCorrection
} from './mutations';
import { isMetricsResponse } from './types';
import {
  getSuggestions,
  validateCorrections,
  getCorrectionHistory,
  exportCorrections
} from './utilities';
import { usePatternTrainingProgress } from './websocket';

import type {
  ExtractedData,
  CorrectionFeedback,
  LearningMetrics,
  PatternSuggestion,
  MetricsResponse
} from './types';

// Import from extracted modules

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

  const [learningMetrics] = useState<LearningMetrics>({
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

  // Use extracted mutations
  const submitCorrections = useSubmitCorrections();
  const submitBatchCorrections = useSubmitBatchCorrections();
  const trainOnExamples = useTrainOnExamples();
  const undoLastCorrection = useUndoLastCorrection();

  // Get pattern performance history
  const { data: performanceHistory } = useQuery({
    queryKey: ['pattern-performance'],
    queryFn: async (): Promise<unknown> => {
      const response = await fetch('/api/pattern-recognition/performance');
      const data: unknown = await response.json();
      return data;
    }
  });

  // Use WebSocket hook for real-time updates
  const { progress, currentPattern, status } = usePatternTrainingProgress();


  return {
    // State
    learningMetrics: metrics ?? learningMetrics,
    learningStatus: {
      isLearning: status === 'training',
      progress,
      currentPattern
    },
    performanceHistory,

    // Actions
    submitCorrections: submitCorrections.submitCorrections,
    submitBatchCorrections: submitBatchCorrections.submitBatchCorrections,
    getSuggestions,
    validateCorrections,
    trainOnExamples: trainOnExamples.trainOnExamples,
    getCorrectionHistory,
    undoLastCorrection: undoLastCorrection.undoLastCorrection,
    exportCorrections,

    // Loading states
    isSubmitting: submitCorrections.isSubmitting,
    isTraining: trainOnExamples.isTraining,
    isUndoing: undoLastCorrection.isUndoing
  };
};