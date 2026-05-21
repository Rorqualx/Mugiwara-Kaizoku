import { useEffect, useState, useCallback } from 'react';

import { useRealTime } from '@/providers/RealTimeProvider';
import { trpc } from '@/utils/trpc-client';

/**
 * Return type for useSystemJobStatus hook
 */
export interface UseSystemJobStatusReturn {
  activeJobs: number;
  refetch: () => void;
}

/**
 * Hook to monitor system task status
 *
 * Provides real-time information about active tasks in the system,
 * useful for warning users before restart/shutdown operations.
 *
 * Uses a single optimized query to fetch all in-progress jobs
 * (PENDING, ACTIVE, and RETRYING statuses).
 *
 * @returns {Object} System task information
 * @returns {number} activeJobs - Number of currently running tasks
 * @returns {boolean} isLoading - Whether the status is being fetched
 * @returns {() => void} refetch - Function to manually refetch status
 */
export function useSystemJobStatus(): UseSystemJobStatusReturn {
  const [pollingInterval, setPollingInterval] = useState<number | null>(null);

  // WebSocket connection for real-time updates
  const { isConnected, subscribe } = useRealTime();

  // Get all in-progress tasks (PENDING, ACTIVE, RETRYING) in a single query
  const inProgressQuery = trpc.jobs.getInProgress.useQuery(
    undefined,
    {
      // Only poll when WebSocket disconnected AND there are active tasks
      refetchInterval: isConnected ? false : (pollingInterval ?? false),
      refetchIntervalInBackground: false
    }
  );

  const activeJobs = inProgressQuery.data?.length ?? 0;
  const _isLoading = inProgressQuery.isLoading;

  // Memoized refetch function for stable dependency
  const refetchJobs = useCallback((): void => {
    void inProgressQuery.refetch();
  }, [inProgressQuery]);

  // Subscribe to WebSocket job events for real-time updates
  useEffect(() => {
    if (!isConnected) return;

    const unsubscribe = subscribe('jobs:active', () => {
      refetchJobs();
    });

    return unsubscribe;
  }, [isConnected, subscribe, refetchJobs]);

  useEffect(() => {
    // Enable polling when there are active tasks (fallback when WebSocket disconnected)
    const hasActiveTasks = activeJobs > 0;
    setPollingInterval(hasActiveTasks ? 5000 : null);
  }, [activeJobs]);

  const refetch = (): void => {
    void inProgressQuery.refetch();
  };

  return {
    activeJobs,
    refetch
  };
}