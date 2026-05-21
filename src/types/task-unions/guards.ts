/**
 * Task Type Guards Module
 *
 * Type guard functions for discriminating task types and statuses.
 * Provides runtime type checking for TaskUnion variants.
 *
 * Extracted from: task-unions.ts (lines 352-432)
 */

import { JobStatus } from '@prisma/client';

import type {
  TaskUnion,
  CheckChaptersTask,
  UpdateMetadataTask,
  FixOutOfSyncTask,
  NotifyTask,
  BackupTask,
} from './types';


// ============================================================================
// Task Type Guards
// ============================================================================

/**
 * Type guard to check if a task is a CHECK_CHAPTERS task
 */
export function isCheckChaptersTask(task: TaskUnion): task is CheckChaptersTask {
  return task.type === 'CHAPTER_CHECK';
}

/**
 * Type guard to check if a task is an UPDATE_METADATA task
 */
export function isUpdateMetadataTask(task: TaskUnion): task is UpdateMetadataTask {
  return task.type === 'METADATA_UPDATE';
}

/**
 * Type guard to check if a task is a FIX_OUT_OF_SYNC task
 */
export function isFixOutOfSyncTask(task: TaskUnion): task is FixOutOfSyncTask {
  return task.type === 'CHAPTER_SYNC';
}

/**
 * Type guard to check if a task is a NOTIFY task
 */
export function isNotifyTask(task: TaskUnion): task is NotifyTask {
  return task.type === 'NOTIFICATION_SEND';
}

/**
 * Type guard to check if a task is a BACKUP task
 */
export function isBackupTask(task: TaskUnion): task is BackupTask {
  return task.type === 'BACKUP_CREATE';
}

// ============================================================================
// Task Status Guards
// ============================================================================

/**
 * Type guard to check if a task is in PENDING status
 */
export function isPendingTask<T extends TaskUnion>(task: T): task is T & {
  status: 'pending';
} {
  return task["status"] === 'pending';
}

/**
 * Type guard to check if a task is in IN_PROGRESS status
 */
export function isInProgressTask<T extends TaskUnion>(task: T): task is T & {
  status: 'active';
} {
  return task["status"] === 'active';
}

/**
 * Type guard to check if a task is in COMPLETED status
 */
export function isCompletedTask<T extends TaskUnion>(task: T): task is T & {
  status: 'completed';
} {
  return task["status"] === 'completed';
}

/**
 * Type guard to check if a task is in FAILED status
 */
export function isFailedTask<T extends TaskUnion>(task: T): task is T & {
  status: 'failed';
  errorMessage: string;
} {
  return task["status"] === 'failed';
}

/**
 * Type guard to check if a task is cancelled
 */
export function isCancelledTask<T extends TaskUnion>(task: T): task is T & {
  status: 'CANCELLED';
} {
  // Compare strings for compatibility
  return task["status"].toString() === JobStatus.cancelled.toString();
}
