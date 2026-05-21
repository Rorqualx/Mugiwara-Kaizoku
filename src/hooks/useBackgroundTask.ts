/**
 * useBackgroundTask Hook
 *
 * Main hook for managing background tasks and their states.
 * Provides functionality to track, monitor, and manage background tasks.
 * Tasks are automatically refreshed every 5 seconds.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';

import { useRealTime } from '@/providers/RealTimeProvider';
import { JobStatus } from '@/types/task-unions';
import type { TaskWithProgress } from '@/types/task-unions';
import {
  createIdleResult,
  createLoadingResult,
  createSuccessResult,
  createErrorResult,
  isIdle,
  isLoading,
  isSuccess,
  isError,
  fromPromiseCatch,
} from '@/utils/async-result';
import type { AsyncResult } from '@/utils/async-result';
import { logger } from '@/utils/logger';
import { trpc } from '@/utils/trpc-client';

// Import from extracted modules
import {
  processTaskData,
  getErrorFromQuery,
  createMockTaskQuery,
} from './useBackgroundTask/utils';

import type {
  TaskCounts,
  TaskQueryResult,
  TaskQueryShape,
  TaskOperationResult,
  UseBackgroundTaskResult,
} from './useBackgroundTask/types';

/**
 * Hook for managing background tasks and their states
 *
 * This hook provides functionality to track, monitor, and manage background tasks.
 * It maintains task history, provides progress tracking, and offers utilities for
 * task status management. Tasks are automatically refreshed every 5 seconds.
 *
 * @returns {UseBackgroundTaskResult} Task management functions and state
 *
 * @example
 * ```tsx
 * const {
 *   activeJobs,
 *   getTaskProgress,
 *   isTaskActive,
 *   tasksResult
 * } = useBackgroundJob();
 *
 * // Handle different states using the AsyncResult pattern
 * if (isLoading(tasksResult)) {
 *   return <div>Loading tasks...</div>;
 * }
 *
 * if (isError(tasksResult)) {
 *   return <div>Error: {tasksResult.error instanceof Error ? tasksResult.error.message : String(tasksResult.error)}</div>;
 * }
 *
 * if (isSuccess(tasksResult)) {
 *   return (
 *     <div>
 *       {activeJobs.map(task => (
 *         <div key={task["id"]}>
 *           Task {task["id"]}: {getTaskProgress(task["id"])}%
 *         </div>
 *       ))}
 *     </div>
 *   );
 * }
 *
 * return <div>Tasks not loaded yet</div>;
 * ```
 */
export function useBackgroundJob(): UseBackgroundTaskResult {
  // State for tasks with AsyncResult pattern to handle different states
  const [tasksResult, setTasksResult] = useState<AsyncResult<TaskWithProgress[], Error>>(createIdleResult());

  // WebSocket connection for real-time updates
  const { isConnected, subscribe } = useRealTime();

  // Get the jobs endpoint with type checking
  const jobs = trpc.jobs;

  // Create wrapped processTaskData with state setter
  const processTaskDataCallback = useCallback((apiTasks: TaskQueryResult) => {
    processTaskData(apiTasks, setTasksResult);
  }, []);

  // tRPC query with proper typing and fallback
  const taskQuery: TaskQueryShape = (() => {
    try {
      // Try to use the jobs.getByStatus.useQuery with parameters if available
      if (typeof jobs.getByStatus.useQuery === 'function') {
        // First check if it accepts parameters
        try {
          // Use type-safe parameter object
          type QueryFunction = (params: { status: string }, options?: { refetchInterval?: number | false }) => TaskQueryShape;
          return (jobs.getByStatus.useQuery as QueryFunction)({
            status: 'ACTIVE'
          }, {
            refetchInterval: isConnected ? false : 5000 // Only poll when WebSocket disconnected
          });
        } catch (_e: unknown) {
          // If parameter passing fails, try without parameters
          try {
            type SimpleQueryFunction = (params: { status: string }) => TaskQueryShape;
            return (jobs.getByStatus.useQuery as SimpleQueryFunction)({ status: 'ACTIVE' });
          } catch (_e: unknown) {
            // If all attempts fail, return the mock
            logger.warn('Failed to use jobs.getByStatus.useQuery, using mock instead');
            return createMockTaskQuery();
          }
        }
      }
      // Fallback to mock if method doesn't exist
      return createMockTaskQuery();
    } catch (_e: unknown) {
      // Final fallback
      return createMockTaskQuery();
    }
  })();

  // Subscribe to WebSocket job events for real-time updates
  useEffect(() => {
    if (!isConnected) return;

    const unsubscribe = subscribe('jobs:active', () => {
      if (taskQuery.refetch) {
        void taskQuery.refetch();
      }
    });

    return unsubscribe;
  }, [isConnected, subscribe, taskQuery]);

  // Handle error, success, and settled states using useEffect
  useEffect(() => {
    // Handle errors - check if error property exists and has a value
    if ('error' in taskQuery && taskQuery.error !== undefined && taskQuery.error !== null) {
      setTasksResult(createErrorResult(getErrorFromQuery(taskQuery)));
    }

    // Handle successful data
    else if (taskQuery.data) {
      // Ensure data is valid before processing
      if (Array.isArray(taskQuery.data)) {
        // Process tasks when data is received
        processTaskDataCallback(taskQuery.data as TaskQueryResult);
      } else {
        // Handle invalid data format
        setTasksResult(createErrorResult(
          new Error(`Invalid task data format received: ${typeof taskQuery.data}`)
        ));
      }
    }

    // Handle loading state
    else if (taskQuery.isLoading && isIdle(tasksResult)) {
      setTasksResult(createLoadingResult());
    }
    // FIX #3: Add taskQuery to dependency array to fix react-hooks/exhaustive-deps
  }, [taskQuery, taskQuery.data, taskQuery.isLoading, tasksResult, processTaskDataCallback]);

  /**
   * Get the progress percentage for a specific task
   * with proper AsyncResult state handling
   *
   * @param {number} taskId - The ID of the task to check
   * @returns {number} Progress percentage (0-100)
   */
  const getTaskProgress = useCallback((taskId: number): number => {
    if (taskId <= 0) {
      return 0; // Invalid ID
    }

    if (isSuccess(tasksResult)) {
      // Find the task with type safety
      const task = tasksResult.data.find((t) => t["id"] === taskId);
      // Return progress with fallback to 0 if not found
      return typeof task?.progress === 'number' ? task.progress : 0;
    }
    // Return 0 for all other AsyncResult states
    return 0;
  }, [tasksResult]);

  /**
   * Get the error message for a specific task
   * with proper AsyncResult state handling
   *
   * @param {number} taskId - The ID of the task to check
   * @returns {string | undefined} Error message if present
   */
  const getJobError = useCallback((taskId: number): string | undefined => {
    if (taskId <= 0) {
      return 'Invalid task ID'; // Invalid ID
    }

    if (isSuccess(tasksResult)) {
      // Find the task with type safety
      const task = tasksResult.data.find((t) => t["id"] === taskId);
      // Return error message if it's a string, otherwise undefined
      return typeof task?.errorMessage === 'string' ? task.errorMessage : undefined;
    }

    // For other AsyncResult states, provide appropriate messages
    if (isLoading(tasksResult)) {
      return 'Loading task information...';
    }

    if (isError(tasksResult)) {
      return `Cannot retrieve task error: ${tasksResult.error instanceof Error ? tasksResult.error.message : String(tasksResult.error)}`;
    }

    // For idle state
    return 'Task information not yet loaded';
  }, [tasksResult]);

  /**
   * Check if a task is currently active
   * with proper AsyncResult state handling
   *
   * @param {number} taskId - The ID of the task to check
   * @returns {boolean} Whether the task is active
   */
  const isTaskActive = useCallback((taskId: number): boolean => {
    if (taskId <= 0) {
      return false; // Invalid ID
    }

    if (isSuccess(tasksResult)) {
      // Find the task with type safety
      const task = tasksResult.data.find((t) => t["id"] === taskId);

      // Check if the task exists and has a valid status
      if (!task || typeof task["status"] !== 'string') {
        return false;
      }

      // Check if the task is in an active state
      return task["status"] === JobStatus.pending || task["status"] === JobStatus.active;
    }
    // For other AsyncResult states, assume tasks are not active
    return false;
  }, [tasksResult]);

  /**
   * Remove completed and failed tasks from the task list
   * Using AsyncResult pattern with comprehensive state handling
   *
   * @returns Promise resolving to AsyncResult with void or error
   */
  const clearCompletedTasks = useCallback((): Promise<TaskOperationResult> => {
    // FIX #1: Remove 'async' keyword since there's no await
    return fromPromiseCatch(Promise.resolve().then(() => {
      // Handle all AsyncResult states properly
      if (isLoading(tasksResult)) {
        throw new Error('Cannot clear tasks while they are loading');
      }

      if (isIdle(tasksResult)) {
        throw new Error('Cannot clear tasks when task system is idle');
      }

      if (isError(tasksResult)) {
        throw new Error(`Cannot clear tasks due to error: ${tasksResult.error instanceof Error ? tasksResult.error.message : String(tasksResult.error)}`);
      }

      if (!isSuccess(tasksResult)) {
        // This should never happen as we've checked all states, but TypeScript doesn't know that
        throw new Error('Cannot clear tasks: unknown state');
      }

      // Validate that tasks array exists and is an array
      if (!Array.isArray(tasksResult.data)) {
        throw new Error('Tasks data is not in the expected format');
      }

      // Filter tasks with proper type validation
      const filteredTasks = tasksResult.data.filter((task) => {
        // Skip tasks without a valid status
        if (typeof task["status"] !== 'string') {
          return false;
        }

        // Keep only non-completed and non-failed tasks
        return task["status"] !== JobStatus.completed && task["status"] !== JobStatus.failed;
      });

      // Update state with filtered tasks
      setTasksResult(createSuccessResult(filteredTasks));

      // Return void to satisfy Promise<void> requirement
      return undefined;
    }));
  }, [tasksResult]);

  /**
   * Extract active tasks (pending or in progress)
   * with proper type validation and error handling
   */
  const activeJobs = useMemo(() => {
    if (!isSuccess(tasksResult) || !Array.isArray(tasksResult.data)) {
      return [];
    }

    return tasksResult.data.filter((task) =>
      typeof task["status"] === 'string' && (
        task["status"] === JobStatus.pending ||
        task["status"] === JobStatus.active
      )
    );
  }, [tasksResult]);

  /**
   * Extract completed tasks
   * with proper type validation and error handling
   */
  const completedTasks = useMemo(() => {
    if (!isSuccess(tasksResult) || !Array.isArray(tasksResult.data)) {
      return [];
    }

    return tasksResult.data.filter((task) =>
      typeof task["status"] === 'string' && task["status"] === JobStatus.completed
    );
  }, [tasksResult]);

  /**
   * Extract failed tasks
   * with proper type validation and error handling
   */
  const failedTasks = useMemo(() => {
    if (!isSuccess(tasksResult) || !Array.isArray(tasksResult.data)) {
      return [];
    }

    return tasksResult.data.filter((task) =>
      typeof task["status"] === 'string' && task["status"] === JobStatus.failed
    );
  }, [tasksResult]);

  /**
   * Calculate task counts by status
   * with proper type validation and error handling
   */
  const taskCounts: TaskCounts = useMemo(() => {
    // Default counts
    const counts: TaskCounts = {
      active: 0,
      queued: 0,
      scheduled: 0,
      failed: 0
    };

    // Only calculate counts if we have successful data
    if (isSuccess(tasksResult) && Array.isArray(tasksResult.data)) {
      counts.active = tasksResult.data.filter((task) =>
        typeof task["status"] === 'string' && (
          task["status"] === JobStatus.pending ||
          task["status"] === JobStatus.active
        )
      ).length;

      counts.queued = tasksResult.data.filter((task) =>
        typeof task["status"] === 'string' && task["status"] === JobStatus.pending
      ).length;

      // FIX #2: Remove unnecessary optional chains on task.scheduledAt
      // scheduledAt is Date | null, so only check !== null
      counts.scheduled = tasksResult.data.filter((task) =>
        task.scheduledAt !== null
      ).length;

      counts.failed = tasksResult.data.filter((task) =>
        typeof task["status"] === 'string' && task["status"] === JobStatus.failed
      ).length;
    }

    return counts;
  }, [tasksResult]);

  // Export a clean, well-typed API
  return {
    tasksResult,
    taskCounts,
    activeJobs,
    completedTasks,
    failedTasks,
    getTaskProgress,
    getJobError,
    isTaskActive,
    clearCompletedTasks,
    isLoading: isLoading(tasksResult) || taskQuery.isLoading
  };
}
