/**
 * Task Creator Functions Module
 *
 * Factory functions for creating type-safe task instances.
 * Uses options object pattern to comply with ESLint max-params rule.
 *
 * Extracted from: task-unions.ts (lines 514-769)
 */

import { JobStatus } from '@prisma/client';

import type { JsonObject } from '../prisma-transaction';
import type {
  BaseTask,
  CheckChaptersTask,
  UpdateMetadataTask,
  FixOutOfSyncTask,
  NotifyTask,
  BackupTask,
  CheckChaptersTaskPayload,
  UpdateMetadataTaskPayload,
  FixOutOfSyncTaskPayload,
  NotifyTaskPayload,
  BackupTaskPayload
} from './types';


// ============================================================================
// Options Interface
// ============================================================================

/**
 * Options for task creator functions
 *
 * Uses options object pattern to comply with ESLint max-params rule (5 max).
 * All creator functions accept this single options object instead of 6 individual parameters.
 */
export interface TaskCreatorOptions {
  baseTask: BaseTask;
  status: JobStatus;
  mangaId: number | null;
  chapterId: number | null;
  errorMessage: string | null;
  payload: unknown;
}

// ============================================================================
// Task Creator Functions
// ============================================================================

/**
 * Creates a CHECK_CHAPTERS task
 *
 * @param options - Task creation options
 * @returns Type-safe CheckChaptersTask instance
 * @throws Error if mangaId is null
 */
export function createCheckChaptersTask(options: TaskCreatorOptions): CheckChaptersTask {
  const { baseTask, status, mangaId, chapterId, errorMessage, payload } = options;

  if (mangaId === null) {
    throw new Error('CHECK_CHAPTERS task requires mangaId');
  }

  const checkChaptersPayload: CheckChaptersTaskPayload = {
    mangaId
  };

  if (chapterId !== null) {
    checkChaptersPayload.chapterId = chapterId;
  }

  if (payload && typeof payload === 'object') {
    checkChaptersPayload.options = payload as JsonObject;
  }

  const taskBase = {
    ...baseTask,
    type: 'CHAPTER_CHECK' as const,
    mangaId,
    chapterId,
    checkChaptersPayload,
    updateMetadataPayload: null,
    fixOutOfSyncPayload: null,
    notifyPayload: null,
    backupPayload: null
  };

  if (status === JobStatus.failed && errorMessage) {
    return {
      ...taskBase,
      status: JobStatus.failed,
      errorMessage
    };
  } else if (status === JobStatus.completed) {
    return {
      ...taskBase,
      status: JobStatus.completed,
      errorMessage: null
    };
  } else if (status === JobStatus.active) {
    return {
      ...taskBase,
      status: JobStatus.active,
      errorMessage: null
    };
  } else {
    return {
      ...taskBase,
      status: JobStatus.pending,
      errorMessage: null
    };
  }
}

/**
 * Creates an UPDATE_METADATA task
 *
 * @param options - Task creation options
 * @returns Type-safe UpdateMetadataTask instance
 * @throws Error if mangaId is null
 */
export function createUpdateMetadataTask(options: TaskCreatorOptions): UpdateMetadataTask {
  const { baseTask, status, mangaId, errorMessage, payload } = options;

  if (mangaId === null) {
    throw new Error('UPDATE_METADATA task requires mangaId');
  }

  const updateMetadataPayload: UpdateMetadataTaskPayload = {
    mangaId
  };

  if (payload && typeof payload === 'object') {
    const typedPayload = payload as Record<string, unknown>;
    if (typeof typedPayload["source"] === 'string') {
      updateMetadataPayload["source"] = typedPayload["source"];
    }
    if (typeof typedPayload["forceUpdate"] === 'boolean') {
      updateMetadataPayload.forceUpdate = typedPayload["forceUpdate"];
    }
  }

  const taskBase = {
    ...baseTask,
    type: 'METADATA_UPDATE' as const,
    mangaId,
    chapterId: null,
    checkChaptersPayload: null,
    updateMetadataPayload,
    fixOutOfSyncPayload: null,
    notifyPayload: null,
    backupPayload: null
  };

  if (status === JobStatus.failed && errorMessage) {
    return {
      ...taskBase,
      status: JobStatus.failed,
      errorMessage
    };
  } else if (status === JobStatus.completed) {
    return {
      ...taskBase,
      status: JobStatus.completed,
      errorMessage: null
    };
  } else if (status === JobStatus.active) {
    return {
      ...taskBase,
      status: JobStatus.active,
      errorMessage: null
    };
  } else {
    return {
      ...taskBase,
      status: JobStatus.pending,
      errorMessage: null
    };
  }
}

/**
 * Creates a FIX_OUT_OF_SYNC task
 *
 * @param options - Task creation options
 * @returns Type-safe FixOutOfSyncTask instance
 * @throws Error if mangaId is null
 */
export function createFixOutOfSyncTask(options: TaskCreatorOptions): FixOutOfSyncTask {
  const { baseTask, status, mangaId, chapterId, errorMessage, payload } = options;

  if (mangaId === null) {
    throw new Error('FIX_OUT_OF_SYNC task requires mangaId');
  }

  // chapterId is required but type allows null from options
  // Need to handle this case
  if (chapterId === null) {
    throw new Error('FIX_OUT_OF_SYNC task requires chapterId');
  }

  const fixOutOfSyncPayload: FixOutOfSyncTaskPayload = {
    mangaId,
    chapterId,
    reason: payload && typeof payload === 'object' && typeof (payload as Record<string, unknown>)["reason"] === 'string'
      ? (payload as Record<string, unknown>)["reason"] as string
      : 'Unknown reason'
  };

  const taskBase = {
    ...baseTask,
    type: 'CHAPTER_SYNC' as const,
    mangaId,
    chapterId,
    checkChaptersPayload: null,
    updateMetadataPayload: null,
    fixOutOfSyncPayload,
    notifyPayload: null,
    backupPayload: null
  };

  if (status === JobStatus.failed && errorMessage) {
    return {
      ...taskBase,
      status: JobStatus.failed,
      errorMessage
    };
  } else if (status === JobStatus.completed) {
    return {
      ...taskBase,
      status: JobStatus.completed,
      errorMessage: null
    };
  } else if (status === JobStatus.active) {
    return {
      ...taskBase,
      status: JobStatus.active,
      errorMessage: null
    };
  } else {
    return {
      ...taskBase,
      status: JobStatus.pending,
      errorMessage: null
    };
  }
}

/**
 * Creates a NOTIFY task
 *
 * @param options - Task creation options
 * @returns Type-safe NotifyTask instance
 */
export function createNotifyTask(options: TaskCreatorOptions): NotifyTask {
  const { baseTask, status, errorMessage, payload } = options;

  const notifyPayload: NotifyTaskPayload = {
    type: 'system',
    message: 'Notification'
  };

  if (payload && typeof payload === 'object') {
    const typedPayload = payload as Record<string, unknown>;
    if (typeof typedPayload["type"] === 'string') {
      notifyPayload.type = typedPayload["type"];
    }
    if (typeof typedPayload["message"] === 'string') {
      notifyPayload.message = typedPayload["message"];
    }
    if (typedPayload["details"] && typeof typedPayload["details"] === 'object') {
      notifyPayload.details = typedPayload["details"] as JsonObject;
    }
  }

  const taskBase = {
    ...baseTask,
    type: 'NOTIFICATION_SEND' as const,
    mangaId: null,
    chapterId: null,
    checkChaptersPayload: null,
    updateMetadataPayload: null,
    fixOutOfSyncPayload: null,
    notifyPayload,
    backupPayload: null
  };

  if (status === JobStatus.failed && errorMessage) {
    return {
      ...taskBase,
      status: JobStatus.failed,
      errorMessage
    };
  } else if (status === JobStatus.completed) {
    return {
      ...taskBase,
      status: JobStatus.completed,
      errorMessage: null
    };
  } else if (status === JobStatus.active) {
    return {
      ...taskBase,
      status: JobStatus.active,
      errorMessage: null
    };
  } else {
    return {
      ...taskBase,
      status: JobStatus.pending,
      errorMessage: null
    };
  }
}

/**
 * Creates a BACKUP task
 *
 * @param options - Task creation options
 * @returns Type-safe BackupTask instance
 */
export function createBackupTask(options: TaskCreatorOptions): BackupTask {
  const { baseTask, status, errorMessage, payload } = options;

  const backupPayload: BackupTaskPayload = {
    type: 'MANUAL'
  };

  if (payload && typeof payload === 'object') {
    const typedPayload = payload as Record<string, unknown>;
    if (typedPayload["type"] === 'MANUAL' || typedPayload["type"] === 'SCHEDULED') {
      backupPayload.type = typedPayload["type"] as 'MANUAL' | 'SCHEDULED';
    }
    if (typedPayload["includeMedia"] !== undefined) {
      backupPayload.includeMedia = Boolean(typedPayload["includeMedia"]);
    }
    if (typedPayload["includeConfig"] !== undefined) {
      backupPayload.includeConfig = Boolean(typedPayload["includeConfig"]);
    }
  }

  const taskBase = {
    ...baseTask,
    type: 'BACKUP_CREATE' as const,
    mangaId: null,
    chapterId: null,
    checkChaptersPayload: null,
    updateMetadataPayload: null,
    fixOutOfSyncPayload: null,
    notifyPayload: null,
    backupPayload
  };

  if (status === JobStatus.failed && errorMessage) {
    return {
      ...taskBase,
      status: JobStatus.failed,
      errorMessage
    };
  } else if (status === JobStatus.completed) {
    return {
      ...taskBase,
      status: JobStatus.completed,
      errorMessage: null
    };
  } else if (status === JobStatus.active) {
    return {
      ...taskBase,
      status: JobStatus.active,
      errorMessage: null
    };
  } else {
    return {
      ...taskBase,
      status: JobStatus.pending,
      errorMessage: null
    };
  }
}
