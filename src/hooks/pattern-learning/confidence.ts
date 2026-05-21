/**
 * Pattern Confidence Hook
 *
 * React hook for real-time pattern confidence tracking.
 * Uses WebSocket for real-time updates with polling fallback.
 *
 * Extracted from: usePatternLearning.ts (lines 526-550)
 */

import { useState, useEffect, useCallback } from 'react';

import { useRealTime } from '@/providers/RealTimeProvider';
import { logger } from '@/utils/logger';

import { isConfidenceResponse } from './types';

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
      logger.error('Error fetching pattern confidence', error);
    }
  }, [patternId]);

  // Initial fetch
  useEffect(() => {
    void fetchConfidence();
  }, [fetchConfidence]);

  // Subscribe to WebSocket pattern learning events for real-time updates
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