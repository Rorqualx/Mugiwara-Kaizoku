/**
 * useBackgroundTask Utilities Module
 *
 * Helper functions for task data processing, error extraction,
 * and query object creation.
 *
 * Extracted from: useBackgroundTask.ts (lines 142-224, 234-240, 279-288)
 */

import {
  toTaskUnion,
  JobStatus,
  JobType,
} from '@/types/task-unions';
import type { TaskWithProgress } from '@/types/task-unions';
import { createSuccessResult, createErrorResult } from '@/utils/async-result';
import type { AsyncResult } from '@/utils/async-result';
import { isValidJobStatus } from '@/utils/job-validation';
import { logger } from '@/utils/logger';

import type { TaskQueryResult, TaskQueryShape } from './types';

/**
 * Process task data from the API and convert to proper TaskWithProgress type
 * with comprehensive validation and error handling
 *
 * @param apiTasks The raw task data from the API
 * @param setTasksResult State setter for updating tasks result
 */
export function processTaskData(
  apiTasks: TaskQueryResult,
  setTasksResult: (result: AsyncResult<TaskWithProgress[], Error>) => void
): void {
  try {
    // Validate that apiTasks is an array
    if (!Array.isArray(apiTasks)) {
      throw new Error(`Task data is not an array: ${typeof apiTasks}`);
    }

    // Convert API response tasks to TaskWithProgress type with validation
    const tasksWithProgress: TaskWithProgress[] = apiTasks.map((apiTask, index) => {
      try {
        // Validate the task object
        if (typeof apiTask !== 'object') {
          throw new Error(`Invalid task object at index ${index}: ${typeof apiTask}`);
        }

        // First, try to convert to the type-safe TaskUnion with validation
        const taskUnion = toTaskUnion(apiTask);

        // Validate the converted task has required properties
        if (!taskUnion["id"] || taskUnion["id"] <= 0) {
          throw new Error(`Task at index ${index} has invalid ID: ${taskUnion["id"]}`);
        }

        if (!isValidJobStatus(taskUnion["status"])) {
          throw new Error(`Task at index ${index} has invalid status: ${taskUnion["status"]}`);
        }

        // Then, add progress tracking
        const taskWithProgress: TaskWithProgress = {
          ...taskUnion,
          // Default progress to 0
          progress: 0
        } as unknown as TaskWithProgress;

        return taskWithProgress;
      } catch (error: unknown) {
        // If conversion fails, log the error and create a failsafe TaskWithProgress
        logger.warn('Failed to convert task', error);

        // Create a safe fallback task with required properties and proper typing
        const fallbackTask: TaskWithProgress = {
          id: typeof (apiTask as Record<string, unknown>)["id"] === 'number' ? (apiTask as Record<string, unknown>)["id"] as number : -1,
          status: typeof (apiTask as Record<string, unknown>)["status"] === 'string' &&
          isValidJobStatus(String((apiTask as Record<string, unknown>)["status"])) ?
          String((apiTask as Record<string, unknown>)["status"]) as JobStatus :
          JobStatus.failed,
          createdAt: (apiTask as Record<string, unknown>)["createdAt"] instanceof Date ?
          (apiTask as Record<string, unknown>)["createdAt"] as Date :
          new Date(),
          updatedAt: (apiTask as Record<string, unknown>)["updatedAt"] instanceof Date ?
          (apiTask as Record<string, unknown>)["updatedAt"] as Date :
          new Date(),
          type: typeof (apiTask as Record<string, unknown>)["type"] === 'string' ?
          (apiTask as Record<string, unknown>)["type"] as JobType :
          JobType.chapter_check,
          errorMessage: typeof (apiTask as Record<string, unknown>)["error"] === 'string' ?
          String((apiTask as Record<string, unknown>)["error"]) :
          'Invalid task data',
          progress: 0,
          lastChecked: new Date(),
          scheduledAt: null,
          interval: null,
          priority: 0,
          queueId: null,
          retryCount: 0,
          maxRetries: 3,
          mangaId: null,
          chapterId: null
        };
        return fallbackTask;
      }
    });

    // Update state with success result
    setTasksResult(createSuccessResult(tasksWithProgress));
  } catch (error: unknown) {
    // Handle any errors during processing
    setTasksResult(createErrorResult(error instanceof Error ?
    error :
    new Error(`Failed to process task data: ${String(error)}`)
    ));
  }
}

/**
 * Extract error from query object safely
 *
 * @param taskQuery The query object to extract error from
 * @returns Error object
 */
export function getErrorFromQuery(taskQuery: TaskQueryShape): Error {
  // Check if error property exists and is not undefined
  if ('error' in taskQuery && taskQuery.error !== undefined) {
    return taskQuery.error instanceof Error ?
    taskQuery.error :
    new Error(`Failed to fetch tasks: ${String(taskQuery.error)}`);
  }
  // Default error if property doesn't exist
  return new Error('Failed to fetch tasks: unknown error');
}

/**
 * Create a mock task query object for fallback
 *
 * @returns Mock TaskQueryShape object
 */
export function createMockTaskQuery(): TaskQueryShape {
  return {
    data: [] as unknown[],
    isLoading: false,
    refetch: () => Promise.resolve({ data: [] as unknown[] }),
    error: undefined
  };
}
