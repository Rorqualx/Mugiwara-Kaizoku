/**
 * Pattern Evolution Hook
 *
 * React hook for tracking pattern evolution over time.
 * Uses TanStack Query to automatically fetch evolution data with WebSocket + polling fallback.
 *
 * Extracted from: usePatternLearning.ts (lines 553-565)
 */

import { useEffect } from 'react';

import { useQuery } from '@tanstack/react-query';

import { useRealTime } from '@/providers/RealTimeProvider';

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