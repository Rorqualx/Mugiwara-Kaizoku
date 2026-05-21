/**
 * Task & Queue Event Logging Functions
 *
 * Logging functions for background task operations and queue
 * management events.
 *
 * Extracted from: systemEvents.ts
 */

import { emitEvent } from '../eventEmitter';

/**
 * Logs a task start event
 * Emits an info event when a background task begins execution
 *
 * @param {string} name - Name of the task
 * @param {number} taskId - ID of the task
 * @param {string} _jobType - Type of job (unused but kept for API compatibility)
 *
 * @example
 * ```ts
 * logTaskStarted("Library Scan", 1, "scan");
 * ```
 */
export function logTaskStarted(name: string, taskId: number, _jobType: string): void {
  emitEvent('info', `Task started: ${name}`, 'Tasks', {
    details: { message: `The task "${name}" has started.` },
    entityId: taskId,
    entityType: 'task',
    entityName: name,
    actions: [
      { label: 'View Tasks', action: 'navigate', url: '/tasks' }
    ]
  });
}

/**
 * Logs a task completion event
 * Emits a success event when a background task completes successfully
 *
 * @param {string} name - Name of the task
 * @param {number} taskId - ID of the task
 * @param {string} _jobType - Type of job (unused but kept for API compatibility)
 *
 * @example
 * ```ts
 * logTaskCompleted("Library Scan", 1, "scan");
 * ```
 */
export function logTaskCompleted(name: string, taskId: number, _jobType: string): void {
  emitEvent('success', `Task completed: ${name}`, 'Tasks', {
    details: { message: `The task "${name}" has completed successfully.` },
    entityId: taskId,
    entityType: 'task',
    entityName: name,
    actions: [
      { label: 'View Tasks', action: 'navigate', url: '/tasks' }
    ]
  });
}

/**
 * Logs a task failure event
 * Emits an error event when a background task fails
 *
 * @param {string} name - Name of the task
 * @param {number} taskId - ID of the task
 * @param {string} _jobType - Type of job (unused but kept for API compatibility)
 * @param {string} error - Brief error message
 * @param {string} [errorDetails] - Detailed error information
 *
 * @example
 * ```ts
 * logTaskFailed("Library Scan", 1, "scan", "Access denied", "Permission error reading directory");
 * ```
 */
export function logTaskFailed(name: string, taskId: number, _jobType: string, error: string, errorDetails?: string): void {
  emitEvent('error', `Task failed: ${name}: ${error}`, 'Tasks', {
    details: { message: `The task "${name}" has failed.` },
    entityId: taskId,
    entityType: 'task',
    entityName: name,
    errorDetails: errorDetails ?? error,
    actions: [
      { label: 'View Tasks', action: 'navigate', url: '/tasks' },
      { label: 'Retry Task', action: 'retryTask', entityId: taskId }
    ]
  });
}

/**
 * Logs a task scheduling event
 * Emits an info event when a task is scheduled for future execution
 *
 * @param {string} name - Name of the task
 * @param {number} taskId - ID of the task
 * @param {string} _jobType - Type of job (unused but kept for API compatibility)
 * @param {string} time - Scheduled execution time
 *
 * @example
 * ```ts
 * logTaskScheduled("Daily Backup", 1, "backup", "2025-03-12 00:00:00");
 * ```
 */
export function logTaskScheduled(name: string, taskId: number, _jobType: string, time: string): void {
  emitEvent('info', `Task scheduled: ${name} at ${time}`, 'Tasks', {
    details: { message: `The task "${name}" has been scheduled to run at ${time}.` },
    entityId: taskId,
    entityType: 'task',
    entityName: name,
    actions: [
      { label: 'View Tasks', action: 'navigate', url: '/tasks' }
    ]
  });
}

/**
 * Logs queue processing start
 *
 * @param {string} queueName - Name of the queue
 * @param {number} itemCount - Number of items in queue
 *
 * @example
 * ```ts
 * logQueueStarted("download-queue", 10);
 * ```
 */
export function logQueueStarted(queueName: string, itemCount: number): void {
  emitEvent(
    'info',
    `Queue started: ${queueName} with ${itemCount} items`,
    'Tasks',
    {
      details: {
        type: 'queue_started',
        queueName,
        itemCount
      }
    }
  );
}

/**
 * Logs queue processing stop
 *
 * @param {string} queueName - Name of the queue
 * @param {string} reason - Reason for stopping
 *
 * @example
 * ```ts
 * logQueueStopped("download-queue", "User requested");
 * ```
 */
export function logQueueStopped(queueName: string, reason: string): void {
  emitEvent(
    'info',
    `Queue stopped: ${queueName} - ${reason}`,
    'Tasks',
    {
      details: {
        type: 'queue_stopped',
        queueName,
        reason
      }
    }
  );
}

/**
 * Logs queue cleanup completion
 *
 * @param {string} queueName - Name of the queue
 * @param {number} cleanedCount - Number of items cleaned
 *
 * @example
 * ```ts
 * logQueueCleanup("download-queue", 5);
 * ```
 */
export function logQueueCleanup(queueName: string, cleanedCount: number): void {
  emitEvent(
    'info',
    `Queue cleanup: ${queueName} - ${cleanedCount} items removed`,
    'Tasks',
    {
      details: {
        type: 'queue_cleanup',
        queueName,
        cleanedCount
      }
    }
  );
}

/**
 * Logs queue error
 *
 * @param {string} queueName - Name of the queue
 * @param {string} error - Error message
 *
 * @example
 * ```ts
 * logQueueError("download-queue", "Connection timeout");
 * ```
 */
export function logQueueError(queueName: string, error: string): void {
  emitEvent(
    'error',
    `Queue error: ${queueName} - ${error}`,
    'Tasks',
    {
      details: {
        type: 'queue_error',
        queueName,
        error
      }
    }
  );
}
