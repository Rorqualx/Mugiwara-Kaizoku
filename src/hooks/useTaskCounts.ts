/**
 * Task Counts Hook
 *
 * This hook provides real-time counts of tasks in different states, useful for
 * displaying activity indicators and task status summaries in the UI.
 * Uses AsyncResult pattern for type-safe state handling.
 */

import { useMemo } from 'react';

import {
  createLoadingResult,
  createSuccessResult,
  createErrorResult
} from '../utils/async-result';
import { unwrapOr } from '../utils/async-result';
import { trpc } from '../utils/trpc-client';

import type { AsyncResult } from '../utils/async-result';


/**
 * Task count data returned by the activity query
 */
export interface TaskCounts {
  /** Number of tasks currently in progress */
  active: number;
  /** Number of pending tasks ready to run */
  queued: number;
  /** Number of pending tasks scheduled for future execution */
  scheduled: number;
  /** Number of tasks that encountered errors */
  failed: number;
  /** Number of successfully completed tasks */
  completed: number;
  /** Number of tasks out of sync with external systems */
  outOfSync: number;
}


/**
 * Default empty task counts
 */
const defaultTaskCounts: TaskCounts = {
  active: 0,
  queued: 0,
  scheduled: 0,
  failed: 0,
  completed: 0,
  outOfSync: 0
};



/**
 * Hook for retrieving task activity statistics with AsyncResult pattern
 *
 * @returns {AsyncResult<TaskCounts, Error>} Async result containing task counts
 */
export function useJobCounts(): AsyncResult<TaskCounts, Error> {
  const activityQuery = trpc.activity.query.useQuery(undefined, {
    refetchInterval: 5000
  });

  return useMemo((): AsyncResult<TaskCounts, Error> => {
    if (activityQuery.isPending) {
      return createLoadingResult();
    }

    if (activityQuery.isError) {
      return createErrorResult(
        activityQuery.error instanceof Error
          ? activityQuery.error
          : new Error('Failed to fetch activity counts')
      );
    }

    const data = activityQuery.data as TaskCounts | undefined;
    if (!data) {
      return createSuccessResult(defaultTaskCounts);
    }

    return createSuccessResult({
      active: data.active,
      queued: data.queued,
      scheduled: data.scheduled,
      failed: data.failed,
      completed: data.completed,
      outOfSync: data.outOfSync
    });
  }, [activityQuery.isPending, activityQuery.isError, activityQuery.data, activityQuery.error]);
}

/**
 * Simplified hook for accessing task counts directly with fallback values
 *
 * @returns {TaskCounts} The task counts or default values if loading/error
 */
export function useJobCountsWithDefaults(): TaskCounts {
  const result = useJobCounts();

  return unwrapOr(result, defaultTaskCounts);
}