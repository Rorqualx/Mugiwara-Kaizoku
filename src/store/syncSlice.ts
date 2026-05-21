/**
 * Sync Store Slice Module
 *
 * This module manages the state for manga synchronization tasks.
 * Out-of-sync chapter tracking has been moved to the Job system.
 *
 * @module syncSlice
 */

import { createIdleResult } from '../utils/async-result';
import { JobStatus } from '../utils/job-validation';

import { createAppSlice } from './createStore';

import type { AsyncResult} from '../utils/async-result';
import type { Chapter } from '@prisma/client';


/**
 * Sync task interface
 *
 * Represents a chapter synchronization task with its status and progress
 */
export interface SyncTask {
  id: number;
  mangaId: number;
  status: string;
  progress: number;
  error?: string;
  startedAt: Date;
  completedAt?: Date;
}

/**
 * Sync state data structure
 *
 * Contains all state related to sync operations:
 * - List of active and completed sync tasks
 * - Async results for sync operations
 *
 * Note: Out-of-sync chapters are now tracked via the Job system
 */
export type SyncStateData = {
  syncTasks: SyncTask[];
  syncOperationResult: AsyncResult<SyncTask, Error>;
  chapterFixResult: AsyncResult<Chapter[], Error>;
} & Record<string, unknown>;

/**
 * Sync store actions interface
 *
 * Defines all available actions for managing synchronization:
 * - Creating and updating sync tasks
 * - Task cleanup operations
 * - Async result setters
 */
export type SyncActions = {
  // Sync task management
  addSyncTask: (mangaId: number) => void;
  updateSyncTask: (taskId: number, updates: Partial<SyncTask>) => void;
  removeSyncTask: (taskId: number) => void;
  clearCompletedTasks: () => void;

  // Async result setters
  setSyncOperationResult: (result: AsyncResult<SyncTask, Error>) => void;
  setChapterFixResult: (result: AsyncResult<Chapter[], Error>) => void;
} & Record<string, unknown>;

/**
 * Combined sync state type
 * Includes both state data and actions
 */
export type SyncState = SyncStateData & SyncActions;

/**
 * Initial sync state
 *
 * Provides default values for sync-related state:
 * - Empty sync tasks list
 * - Idle async results
 */
const initialState: SyncStateData = {
  syncTasks: [],
  syncOperationResult: createIdleResult<SyncTask, Error>(),
  chapterFixResult: createIdleResult<Chapter[], Error>()
};

/**
 * Sync store slice
 *
 * Creates a store slice with state and actions for managing synchronization tasks.
 * Uses immer for immutable state updates.
 *
 * Note: Out-of-sync chapter tracking has been moved to the Job system.
 * Use the Job API to query for FIX_OUT_OF_SYNC job types.
 *
 * @example
 * // Create and update a sync task
 * useSyncStore.getState().addSyncTask(mangaId);
 * useSyncStore.getState().updateSyncTask(taskId, {
 *   status: JobStatus.IN_PROGRESS,
 *   progress: 50
 * });
 */
export const useSyncStore = createAppSlice<SyncStateData, SyncActions>(initialState, 'sync')(set => ({
  ...initialState,

  addSyncTask: (mangaId: number) => set(state => {
    const newTask: SyncTask = {
      id: Date.now(),
      mangaId,
      status: JobStatus.pending,
      progress: 0,
      startedAt: new Date()
    };
    state.syncTasks.push(newTask);
  }),

  updateSyncTask: (taskId: number, updates: Partial<SyncTask>) => set(state => {
    const taskIndex = state.syncTasks.findIndex(task => task["id"] === taskId);
    if (taskIndex === -1) return;
    const currentTask = state.syncTasks[taskIndex];
    if (!currentTask) return;
    state.syncTasks[taskIndex] = {
      ...currentTask,
      ...updates
    };
  }),

  removeSyncTask: (taskId: number) => set(state => {
    state.syncTasks = state.syncTasks.filter(task => task["id"] !== taskId);
  }),

  clearCompletedTasks: () => set(state => {
    state.syncTasks = state.syncTasks.filter(
      task => task["status"] !== JobStatus.completed && task["status"] !== JobStatus.failed
    );
  }),

  setSyncOperationResult: (result: AsyncResult<SyncTask, Error>) => set(state => {
    state.syncOperationResult = result;
  }),

  setChapterFixResult: (result: AsyncResult<Chapter[], Error>) => set(state => {
    state.chapterFixResult = result;
  })
}));
