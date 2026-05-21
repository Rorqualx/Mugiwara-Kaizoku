/**
 * useBackgroundTask Types Module
 *
 * Type definitions and interfaces for background task management hook.
 * Provides type-safe contracts for task state, queries, and operations.
 *
 * Extracted from: useBackgroundTask.ts (lines 33-85, 227-232)
 */

import type { TaskWithProgress } from '@/types/task-unions';
import type { AsyncResult } from '@/utils/async-result';
import type { RouterOutputs } from '@/utils/trpc-client/types';

/**
 * Counts of tasks grouped by status
 */
export interface TaskCounts {
  /** Number of active tasks */
  active: number;
  /** Number of queued tasks */
  queued: number;
  /** Number of scheduled tasks */
  scheduled: number;
  /** Number of failed tasks */
  failed: number;
}

/**
 * Type for the task query result to ensure proper typing
 */
export type TaskQueryResult = RouterOutputs['jobs']['getByStatus'];

/**
 * Loading state type with key/value typing
 */
export type LoadingState = {
  [key: string]: boolean;
};

/**
 * Task operation result type for better typing
 */
export type TaskOperationResult = AsyncResult<void, Error>;

/**
 * Type for the query result
 */
export type TaskQueryShape = {
  data: unknown[] | undefined;
  isLoading: boolean;
  refetch?: () => Promise<{ data: unknown[] }>;
  error?: Error | null | undefined;
};

/**
 * Return type for the useBackgroundJob hook with AsyncResult pattern
 */
export interface UseBackgroundTaskResult {
  /** All tasks including history (AsyncResult) */
  tasksResult: AsyncResult<TaskWithProgress[], Error>;
  /** Counts of tasks by status */
  taskCounts: TaskCounts;
  /** Currently running tasks */
  activeJobs: TaskWithProgress[];
  /** Successfully completed tasks */
  completedTasks: TaskWithProgress[];
  /** Failed tasks */
  failedTasks: TaskWithProgress[];
  /** Get progress for a specific task */
  getTaskProgress: (taskId: number) => number;
  /** Get error message for a specific task */
  getJobError: (taskId: number) => string | undefined;
  /** Check if a task is currently active */
  isTaskActive: (taskId: number) => boolean;
  /** Remove completed tasks from history */
  clearCompletedTasks: () => Promise<TaskOperationResult>;
  /** Whether task data is being loaded */
  isLoading: boolean;
}
