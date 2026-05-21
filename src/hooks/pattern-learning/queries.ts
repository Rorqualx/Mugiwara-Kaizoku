/**
 * Pattern Learning Queries Module
 *
 * Data fetching operations for pattern learning functionality.
 *
 * Extracted from: usePatternLearning.ts (lines 172-300)
 */

import { useQuery } from '@tanstack/react-query';

import { logger } from '@/utils/logger';

import {
  LearningMetrics,
  PatternSuggestion,
  isMetricsResponse,
  handleError
} from './utils';

// ============================================================================
// Query Keys
// ============================================================================

export const patternLearningQueryKeys = {
  all: ['pattern-learning'] as const,
  metrics: () => [...patternLearningQueryKeys.all, 'metrics'] as const,
  suggestions: (url: string) => [...patternLearningQueryKeys.all, 'suggestions', url] as const,
  confidence: (url: string) => [...patternLearningQueryKeys.all, 'confidence', url] as const,
  trainingStatus: () => [...patternLearningQueryKeys.all, 'training-status'] as const,
};

// ============================================================================
// Query Functions
// ============================================================================

/**
 * Fetch learning metrics from the API
 */
async function fetchMetrics(): Promise<LearningMetrics> {
  try {
    const response = await fetch('/api/pattern-recognition/metrics');
    
    if (!response.ok) {
      throw new Error(`Failed to fetch metrics: ${response.statusText}`);
    }
    
    const data: unknown = await response.json();
    
    if (!isMetricsResponse(data)) {
      throw new Error('Invalid metrics response format');
    }
    
    // Safe assignment with explicit type assertion after validation
    const validatedData = data as LearningMetrics;
    
    return {
      totalCorrections: validatedData.totalCorrections,
      improvementRate: validatedData.improvementRate,
      averageConfidence: validatedData.averageConfidence,
      patternsLearned: validatedData.patternsLearned,
      lastTrainingDate: validatedData.lastTrainingDate ? new Date(validatedData.lastTrainingDate) : null
    };
  } catch (error) {
    logger.error('Error fetching pattern learning metrics', error);
    throw handleError(error);
  }
}

/**
 * Fetch pattern suggestions for a specific URL
 */
async function fetchSuggestions(url: string): Promise<PatternSuggestion[]> {
  try {
    const response = await fetch(`/api/pattern-recognition/suggestions?url=${encodeURIComponent(url)}`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch suggestions: ${response.statusText}`);
    }
    
    const data: unknown = await response.json();
    
    if (!Array.isArray(data)) {
      throw new Error('Invalid suggestions response format');
    }
    
    // Validate each suggestion
    return data.map((suggestion: unknown): PatternSuggestion => {
      if (
        typeof suggestion === 'object' &&
        suggestion !== null &&
        'field' in suggestion &&
        'suggestedValue' in suggestion &&
        'confidence' in suggestion &&
        'reason' in suggestion
      ) {
        const suggestionObj = suggestion as Record<string, unknown>;
        return {
          field: String(suggestionObj['field']),
          suggestedValue: suggestionObj['suggestedValue'],
          confidence: Number(suggestionObj['confidence']),
          reason: String(suggestionObj['reason'])
        } as PatternSuggestion;
      }
      throw new Error('Invalid suggestion format');
    });
  } catch (error) {
    logger.error('Error fetching pattern suggestions', error);
    throw handleError(error);
  }
}

/**
 * Fetch confidence score for a specific URL
 */
async function fetchConfidence(url: string): Promise<number> {
  try {
    const response = await fetch(`/api/pattern-recognition/confidence?url=${encodeURIComponent(url)}`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch confidence: ${response.statusText}`);
    }
    
    const data: unknown = await response.json();
    
    if (typeof data !== 'object' || data === null || typeof (data as Record<string, unknown>)['confidence'] !== 'number') {
      throw new Error('Invalid confidence response format');
    }
    
    const confidenceData = data as Record<string, unknown>;
    return Number(confidenceData['confidence']);
  } catch (error) {
    logger.error('Error fetching pattern confidence', error);
    throw handleError(error);
  }
}

// ============================================================================
// React Query Hooks
// ============================================================================

/**
 * Hook to fetch pattern learning metrics
 */
export function usePatternLearningMetrics(): ReturnType<typeof useQuery<LearningMetrics, Error>> {
  return useQuery({
    queryKey: patternLearningQueryKeys.metrics(),
    queryFn: fetchMetrics,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}

/**
 * Hook to fetch pattern suggestions for a URL
 */
export function usePatternSuggestions(url: string): ReturnType<typeof useQuery<PatternSuggestion[], Error>> {
  return useQuery({
    queryKey: patternLearningQueryKeys.suggestions(url),
    queryFn: () => fetchSuggestions(url),
    enabled: !!url,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
    retryDelay: 1000,
  });
}

/**
 * Hook to fetch confidence score for a URL
 */
export function usePatternConfidence(url: string): ReturnType<typeof useQuery<number, Error>> {
  return useQuery({
    queryKey: patternLearningQueryKeys.confidence(url),
    queryFn: () => fetchConfidence(url),
    enabled: !!url,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
    retryDelay: 1000,
  });
}
