/**
 * Task Union Types Module
 *
 * Base types, interfaces, and payload definitions for the task system.
 * Provides discriminated unions for type-safe task handling.
 *
 * Extracted from: task-unions.ts (lines 1-350)
 */

import type { AsyncResult } from '@/utils/async-result';

import type { JsonObject } from '../prisma-transaction';
import type { Chapter, JobStatus, JobType, Manga } from '@prisma/client';

// ============================================================================
// Re-export Prisma Enums
// ============================================================================

/**
 * Re-export JobStatus and JobType from Prisma
 */
export { JobStatus, JobType } from '@prisma/client';

// ============================================================================
// Base Interfaces
// ============================================================================

/**
 * Generic Task interface for domain types
 */
export interface Task {
  id: number;
  type: JobType;
  status: JobStatus;
  createdAt: Date;
  updatedAt: Date;
  lastChecked: Date;
  scheduledAt: Date | null;
  interval: string | null;
  priority: number;
  queueId: number | null;
  retryCount: number;
  maxRetries: number;
  mangaId: number | null;
  chapterId: number | null;
  errorMessage: string | null;
}

/**
 * Interface for task results that may be returned from operations
 */
export interface TaskResult<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
}

/**
 * Type for async task operations that return AsyncResult
 */
export type TaskOperation<T = unknown> = () => Promise<AsyncResult<TaskResult<T>>>;

/**
 * Extended Task interface with progress tracking
 */
export interface TaskWithProgress extends Task {
  progress: number;
}

/**
 * Base interface with common properties for all tasks
 */
export interface BaseTask {
  id: number;
  createdAt: Date;
  updatedAt: Date;
  lastChecked: Date;
  scheduledAt: Date | null;
  interval: string | null;
  priority: number;
  queueId: number | null;
  retryCount: number;
  maxRetries: number;
  manga?: Partial<Manga> | null;
  chapter?: Partial<Chapter> | null;
}

/**
 * Task state interface for component state management
 */
export interface JobState {
  tasks: TaskUnion[];
  isLoading: boolean;
  error: Error | null;
  filter: TaskFilter;
}

/**
 * Task filter criteria for querying tasks
 */
export interface TaskFilter {
  status?: JobStatus | JobStatus[];
  type?: JobType | JobType[];
  mangaId?: number;
  page?: number;
  limit?: number;
  sortBy?: 'createdAt' | 'priority' | 'updatedAt';
  sortDirection?: 'asc' | 'desc';
}

// ============================================================================
// Status Base Interfaces
// ============================================================================

/**
 * Common properties for successful task completion
 */
export interface CompletedTaskBase extends BaseTask {
  status: 'completed';
  errorMessage: null;
}

/**
 * Common properties for failed tasks
 */
export interface FailedTaskBase extends BaseTask {
  status: 'failed';
  errorMessage: string;
}

/**
 * Common properties for pending tasks
 */
export interface PendingTaskBase extends BaseTask {
  status: 'pending';
  errorMessage: null;
}

/**
 * Common properties for in-progress tasks
 */
export interface InProgressTaskBase extends BaseTask {
  status: 'active';
  errorMessage: null;
}

// ============================================================================
// Payload Interfaces
// ============================================================================

/**
 * Payload for CHECK_CHAPTERS task
 */
export interface CheckChaptersTaskPayload {
  mangaId: number;
  chapterId?: number;
  options?: JsonObject;
}

/**
 * Payload for UPDATE_METADATA task
 */
export interface UpdateMetadataTaskPayload {
  mangaId: number;
  source?: string;
  forceUpdate?: boolean;
}

/**
 * Payload for FIX_OUT_OF_SYNC task
 */
export interface FixOutOfSyncTaskPayload {
  mangaId: number;
  chapterId: number;
  reason: string;
}

/**
 * Payload for NOTIFY task
 */
export interface NotifyTaskPayload {
  type: string;
  message: string;
  details?: JsonObject;
}

/**
 * Payload for BACKUP task
 */
export interface BackupTaskPayload {
  type: 'MANUAL' | 'SCHEDULED';
  includeMedia?: boolean;
  includeConfig?: boolean;
}

// ============================================================================
// Task Type Definitions
// ============================================================================

/**
 * Type for CHECK_CHAPTERS task
 */
export type CheckChaptersTask =
  | (PendingTaskBase & {
      type: 'CHAPTER_CHECK';
      mangaId: number;
      chapterId: number | null;
      checkChaptersPayload: CheckChaptersTaskPayload;
      updateMetadataPayload: null;
      fixOutOfSyncPayload: null;
      notifyPayload: null;
      backupPayload: null;
    })
  | (InProgressTaskBase & {
      type: 'CHAPTER_CHECK';
      mangaId: number;
      chapterId: number | null;
      checkChaptersPayload: CheckChaptersTaskPayload;
      updateMetadataPayload: null;
      fixOutOfSyncPayload: null;
      notifyPayload: null;
      backupPayload: null;
    })
  | (CompletedTaskBase & {
      type: 'CHAPTER_CHECK';
      mangaId: number;
      chapterId: number | null;
      checkChaptersPayload: CheckChaptersTaskPayload;
      updateMetadataPayload: null;
      fixOutOfSyncPayload: null;
      notifyPayload: null;
      backupPayload: null;
    })
  | (FailedTaskBase & {
      type: 'CHAPTER_CHECK';
      mangaId: number;
      chapterId: number | null;
      checkChaptersPayload: CheckChaptersTaskPayload;
      updateMetadataPayload: null;
      fixOutOfSyncPayload: null;
      notifyPayload: null;
      backupPayload: null;
    });

/**
 * Type for UPDATE_METADATA task
 */
export type UpdateMetadataTask =
  | (PendingTaskBase & {
      type: 'METADATA_UPDATE';
      mangaId: number;
      chapterId: null;
      checkChaptersPayload: null;
      updateMetadataPayload: UpdateMetadataTaskPayload;
      fixOutOfSyncPayload: null;
      notifyPayload: null;
      backupPayload: null;
    })
  | (InProgressTaskBase & {
      type: 'METADATA_UPDATE';
      mangaId: number;
      chapterId: null;
      checkChaptersPayload: null;
      updateMetadataPayload: UpdateMetadataTaskPayload;
      fixOutOfSyncPayload: null;
      notifyPayload: null;
      backupPayload: null;
    })
  | (CompletedTaskBase & {
      type: 'METADATA_UPDATE';
      mangaId: number;
      chapterId: null;
      checkChaptersPayload: null;
      updateMetadataPayload: UpdateMetadataTaskPayload;
      fixOutOfSyncPayload: null;
      notifyPayload: null;
      backupPayload: null;
    })
  | (FailedTaskBase & {
      type: 'METADATA_UPDATE';
      mangaId: number;
      chapterId: null;
      checkChaptersPayload: null;
      updateMetadataPayload: UpdateMetadataTaskPayload;
      fixOutOfSyncPayload: null;
      notifyPayload: null;
      backupPayload: null;
    });

/**
 * Type for FIX_OUT_OF_SYNC task
 */
export type FixOutOfSyncTask =
  | (PendingTaskBase & {
      type: 'CHAPTER_SYNC';
      mangaId: number;
      chapterId: number;
      checkChaptersPayload: null;
      updateMetadataPayload: null;
      fixOutOfSyncPayload: FixOutOfSyncTaskPayload;
      notifyPayload: null;
      backupPayload: null;
    })
  | (InProgressTaskBase & {
      type: 'CHAPTER_SYNC';
      mangaId: number;
      chapterId: number;
      checkChaptersPayload: null;
      updateMetadataPayload: null;
      fixOutOfSyncPayload: FixOutOfSyncTaskPayload;
      notifyPayload: null;
      backupPayload: null;
    })
  | (CompletedTaskBase & {
      type: 'CHAPTER_SYNC';
      mangaId: number;
      chapterId: number;
      checkChaptersPayload: null;
      updateMetadataPayload: null;
      fixOutOfSyncPayload: FixOutOfSyncTaskPayload;
      notifyPayload: null;
      backupPayload: null;
    })
  | (FailedTaskBase & {
      type: 'CHAPTER_SYNC';
      mangaId: number;
      chapterId: number;
      checkChaptersPayload: null;
      updateMetadataPayload: null;
      fixOutOfSyncPayload: FixOutOfSyncTaskPayload;
      notifyPayload: null;
      backupPayload: null;
    });

/**
 * Type for NOTIFY task
 */
export type NotifyTask =
  | (PendingTaskBase & {
      type: 'NOTIFICATION_SEND';
      mangaId: null;
      chapterId: null;
      checkChaptersPayload: null;
      updateMetadataPayload: null;
      fixOutOfSyncPayload: null;
      notifyPayload: NotifyTaskPayload;
      backupPayload: null;
    })
  | (InProgressTaskBase & {
      type: 'NOTIFICATION_SEND';
      mangaId: null;
      chapterId: null;
      checkChaptersPayload: null;
      updateMetadataPayload: null;
      fixOutOfSyncPayload: null;
      notifyPayload: NotifyTaskPayload;
      backupPayload: null;
    })
  | (CompletedTaskBase & {
      type: 'NOTIFICATION_SEND';
      mangaId: null;
      chapterId: null;
      checkChaptersPayload: null;
      updateMetadataPayload: null;
      fixOutOfSyncPayload: null;
      notifyPayload: NotifyTaskPayload;
      backupPayload: null;
    })
  | (FailedTaskBase & {
      type: 'NOTIFICATION_SEND';
      mangaId: null;
      chapterId: null;
      checkChaptersPayload: null;
      updateMetadataPayload: null;
      fixOutOfSyncPayload: null;
      notifyPayload: NotifyTaskPayload;
      backupPayload: null;
    });

/**
 * Type for BACKUP task
 */
export type BackupTask =
  | (PendingTaskBase & {
      type: 'BACKUP_CREATE';
      mangaId: null;
      chapterId: null;
      checkChaptersPayload: null;
      updateMetadataPayload: null;
      fixOutOfSyncPayload: null;
      notifyPayload: null;
      backupPayload: BackupTaskPayload;
    })
  | (InProgressTaskBase & {
      type: 'BACKUP_CREATE';
      mangaId: null;
      chapterId: null;
      checkChaptersPayload: null;
      updateMetadataPayload: null;
      fixOutOfSyncPayload: null;
      notifyPayload: null;
      backupPayload: BackupTaskPayload;
    })
  | (CompletedTaskBase & {
      type: 'BACKUP_CREATE';
      mangaId: null;
      chapterId: null;
      checkChaptersPayload: null;
      updateMetadataPayload: null;
      fixOutOfSyncPayload: null;
      notifyPayload: null;
      backupPayload: BackupTaskPayload;
    })
  | (FailedTaskBase & {
      type: 'BACKUP_CREATE';
      mangaId: null;
      chapterId: null;
      checkChaptersPayload: null;
      updateMetadataPayload: null;
      fixOutOfSyncPayload: null;
      notifyPayload: null;
      backupPayload: BackupTaskPayload;
    });

// ============================================================================
// Discriminated Union
// ============================================================================

/**
 * Discriminated union of all task types
 */
export type TaskUnion =
  | CheckChaptersTask
  | UpdateMetadataTask
  | FixOutOfSyncTask
  | NotifyTask
  | BackupTask;
