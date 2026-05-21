/**
 * Task Conversion Utilities Module
 *
 * Functions for converting between task representations.
 * Complexity optimized to meet ESLint standards (<20).
 *
 * Extracted from: task-unions.ts (lines 434-504)
 */


import { JobStatus, JobType } from '@prisma/client';

import type { AsyncResult } from '@/utils/async-result';
import { toNumberId } from '@/utils/id-converters';
import { logger } from '@/utils/logger';


import {
  createCheckChaptersTask,
  createUpdateMetadataTask,
  createFixOutOfSyncTask,
  createNotifyTask,
  createBackupTask
} from './creators';

import type { BaseTask, TaskUnion, TaskResult } from './types';
import type { Manga, Chapter } from '@prisma/client';

// ============================================================================
// Private Helper Functions
// ============================================================================

/**
 * Validate task object structure
 * @private
 */
function validateTaskObject(task: unknown): Record<string, unknown> {
  if (!task || typeof task !== 'object') {
    throw new Error('Invalid task data');
  }
  const taskObj = task as Record<string, unknown>;
  if (!('type' in taskObj) || !('status' in taskObj)) {
    throw new Error('Invalid task: missing type or status');
  }
  return taskObj;
}

/**
 * Build base task from raw data
 * @private
 */
function buildBaseTask(taskObj: Record<string, unknown>): BaseTask {
  return {
    id: toNumberId(taskObj["id"] ?? 0),
    createdAt: taskObj["createdAt"] instanceof Date ? taskObj["createdAt"] : new Date(),
    updatedAt: taskObj["updatedAt"] instanceof Date ? taskObj["updatedAt"] : new Date(),
    lastChecked: taskObj["lastChecked"] instanceof Date ? taskObj["lastChecked"] : new Date(),
    scheduledAt: taskObj["scheduledAt"] instanceof Date ? taskObj["scheduledAt"] : null,
    interval: typeof taskObj["interval"] === 'string' ? taskObj["interval"] : null,
    priority: Number(taskObj["priority"] ?? 0),
    queueId: typeof taskObj["queueId"] === 'number' ? taskObj["queueId"] : null,
    retryCount: Number(taskObj["retryCount"] ?? 0),
    maxRetries: Number(taskObj["maxRetries"] || 3),
    manga: taskObj["manga"] && typeof taskObj["manga"] === 'object' && Object.keys(taskObj["manga"] as Record<string, unknown>).length > 0 ? taskObj["manga"] as Partial<Manga> : null,
    chapter: taskObj["chapter"] && typeof taskObj["chapter"] === 'object' && Object.keys(taskObj["chapter"] as Record<string, unknown>).length > 0 ? taskObj["chapter"] as Partial<Chapter> : null
  };
}

/**
 * Extract common task parameters from raw task object
 * @private
 */
function extractTaskParams(taskObj: Record<string, unknown>): {
  type: JobType;
  status: JobStatus;
  mangaId: number | null;
  chapterId: number | null;
  errorMessage: string | null;
} {
  return {
    type: String(taskObj["type"]) as JobType,
    status: String(taskObj["status"]) as JobStatus,
    mangaId: typeof taskObj["mangaId"] === 'number' ? taskObj["mangaId"] : null,
    chapterId: typeof taskObj["chapterId"] === 'number' ? taskObj["chapterId"] : null,
    errorMessage: taskObj["errorMessage"] ? String(taskObj["errorMessage"]) : null
  };
}

// ============================================================================
// Public Conversion Functions
// ============================================================================

/**
 * Convert a Task object to the type-safe TaskUnion
 *
 * Complexity reduced from 31 to <15 by extracting:
 * - validateTaskObject() - Validation logic
 * - buildBaseTask() - BaseTask construction
 * - extractTaskParams() - Parameter extraction
 */
export function toTaskUnion(task: unknown): TaskUnion {
  const taskObj = validateTaskObject(task);
  const baseTask = buildBaseTask(taskObj);
  const { type, status, mangaId, chapterId, errorMessage } = extractTaskParams(taskObj);

  switch (type) {
    case JobType.chapter_check:
      return createCheckChaptersTask({
        baseTask,
        status,
        mangaId,
        chapterId,
        errorMessage,
        payload: taskObj["checkChaptersPayload"]
      });
    case JobType.metadata_update:
      return createUpdateMetadataTask({
        baseTask,
        status,
        mangaId,
        chapterId: null,
        errorMessage,
        payload: taskObj["updateMetadataPayload"]
      });
    case JobType.chapter_sync:
      if (chapterId === null) {
        throw new Error('FIX_OUT_OF_SYNC task requires chapterId');
      }
      return createFixOutOfSyncTask({
        baseTask,
        status,
        mangaId,
        chapterId,
        errorMessage,
        payload: taskObj["fixOutOfSyncPayload"]
      });
    case JobType.notification_send:
      return createNotifyTask({
        baseTask,
        status,
        mangaId: null,
        chapterId: null,
        errorMessage,
        payload: taskObj["notifyPayload"]
      });
    case JobType.backup_create:
      return createBackupTask({
        baseTask,
        status,
        mangaId: null,
        chapterId: null,
        errorMessage,
        payload: taskObj["backupPayload"]
      });
    default:
      logger.warn(`Unknown task type: ${type}, defaulting to CHECK_CHAPTERS`);
      return createCheckChaptersTask({
        baseTask,
        status,
        mangaId: mangaId ?? 0,
        chapterId,
        errorMessage,
        payload: {}
      });
  }
}

/**
 * Converts a TaskResult to an AsyncResult
 */
export function taskResultToAsyncResult<T>(result: TaskResult<T>): AsyncResult<T, Error> {
  if (result.success && result.data !== undefined) {
    return {
      status: 'success',
      data: result.data
    };
  } else {
    return {
      status: 'error',
      error: new Error(result.message || 'Task operation failed')
    };
  }
}
