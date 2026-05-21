/**
 * Download Queue Store Module
 * 
 * Manages the state and actions for the download queue system.
 * Handles download items, progress tracking, and queue statistics.
 * 
 * @module store/downloadQueueSlice
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

import { createIdleResult } from '../utils/async-result';
import { JobStatus } from '../utils/job-validation';

import type { AsyncResult} from '../utils/async-result';
import type { StateCreator } from 'zustand';


/**
 * Represents an item in the download queue
 */
export interface DownloadQueueItem {
  /** Unique download ID */
  id: number;
  /** ID of the manga being downloaded */
  mangaId: number;
  /** ID of the chapter being downloaded */
  chapterId: number;
  /** Title of the download item */
  title: string;
  /** Download progress (0-100) */
  progress: number;
  /** Current download status */
  status: JobStatus;
  /** Error message if status is 'error' */
  error?: string;
  /** Created timestamp */
  createdAt: Date;
  /** Started timestamp */
  startedAt?: Date;
  /** Completed timestamp */
  completedAt?: Date;
}

/**
 * Represents download queue statistics
 */
export interface DownloadStats {
  /** Total number of downloads */
  total: number;
  /** Number of completed downloads */
  completed: number;
  /** Number of failed downloads */
  failed: number;
  /** Number of downloads in progress */
  inProgress: number;
  /** Number of pending downloads */
  pending: number;
  /** Number of cancelled downloads */
  cancelled: number;
  /** Number of paused downloads */
  paused: number;
}

/**
 * Download queue state data interface
 */
export interface DownloadQueueStateData {
  /** List of items in the download queue */
  queue: DownloadQueueItem[];
  /** Number of queued downloads */
  queuedDownloads: number;
  /** Download queue statistics */
  downloadStats: DownloadStats;
  /** Async operation result */
  downloadOperationResult: AsyncResult<DownloadQueueItem, Error>;
}

/**
 * Download queue actions interface
 */
export interface DownloadQueueActions {
  /** Add a new item to the download queue */
  addToQueue: (item: Omit<DownloadQueueItem, 'progress' | 'status' | 'createdAt'>) => void;
  /** Remove an item from the queue */
  removeFromQueue: (id: number) => void;
  /** Update download progress for an item */
  updateProgress: (id: number, progress: number) => void;
  /** Set error state for a download */
  setError: (id: number, error: string) => void;
  /** Clear the entire download queue */
  clearQueue: () => void;
  /** Update queue with a transform function */
  updateQueue: (updater: (queue: DownloadQueueItem[]) => DownloadQueueItem[]) => void;
  /** Pause a download */
  pauseDownload: (id: number) => void;
  /** Resume a download */
  resumeDownload: (id: number) => void;
  /** Cancel a download */
  cancelDownload: (id: number) => void;
  /** Set async operation result */
  setDownloadOperationResult: (result: AsyncResult<DownloadQueueItem, Error>) => void;
}

/**
 * Combined download queue state type
 */
export type DownloadQueueState = DownloadQueueStateData & DownloadQueueActions;

type DownloadQueueStateCreator = StateCreator<
  DownloadQueueState,
  [],
  [["zustand/devtools", never]]
>;

/**
 * Initial download queue state
 */
const initialState: DownloadQueueStateData = {
  queue: [],
  queuedDownloads: 0,
  downloadStats: {
    total: 0,
    completed: 0,
    failed: 0,
    inProgress: 0,
    pending: 0,
    cancelled: 0,
    paused: 0
  },
  downloadOperationResult: createIdleResult<DownloadQueueItem, Error>(),
};

/**
 * Download queue store
 * 
 * Creates a store for managing download operations with Zustand
 */
export const useDownloadQueueStore = create<DownloadQueueState>()(
  devtools(
    ((set) => ({
      ...initialState,
      addToQueue: (item) =>
        set((state) => ({
          queue: [...state.queue, { 
            ...item, 
            progress: 0, 
            status: JobStatus.pending,
            createdAt: new Date()
          }],
          queuedDownloads: state.queuedDownloads + 1,
          downloadStats: {
            ...state.downloadStats,
            total: state.downloadStats.total + 1,
            pending: state.downloadStats.pending + 1
          }
        })),
      removeFromQueue: (id) =>
        set((state) => {
          const item = state.queue.find(i => i["id"] === id);
          if (!item) return state;

          const itemRecord = item as DownloadQueueItem & { isPaused?: boolean };
          const isPaused = item["status"] === JobStatus.pending && itemRecord.isPaused;

          return {
            queue: state.queue.filter((item) => item["id"] !== id),
            queuedDownloads: state.queuedDownloads - 1,
            downloadStats: {
              ...state.downloadStats,
              // Decrement the appropriate counter based on item status
              completed: item["status"] === JobStatus.completed
                ? Math.max(0, state.downloadStats.completed - 1)
                : state.downloadStats.completed,
              failed: item["status"] === JobStatus.failed
                ? Math.max(0, state.downloadStats.failed - 1)
                : state.downloadStats.failed,
              inProgress: item["status"] === JobStatus.active
                ? Math.max(0, state.downloadStats.inProgress - 1)
                : state.downloadStats.inProgress,
              pending: item["status"] === JobStatus.pending
                ? Math.max(0, state.downloadStats.pending - 1)
                : state.downloadStats.pending,
              cancelled: item["status"] === JobStatus.cancelled
                ? Math.max(0, state.downloadStats.cancelled - 1)
                : state.downloadStats.cancelled,
              paused: isPaused
                ? Math.max(0, state.downloadStats.paused - 1)
                : state.downloadStats.paused,
            }
          };
        }),
      updateProgress: (id, progress) =>
        set((state) => {
          const item = state.queue.find(i => i["id"] === id);
          const wasInProgress = item?.status === JobStatus.active;
          const willComplete = progress === 100;
          const now = new Date();

          return {
            queue: state.queue.map((item) => {
              if (item["id"] === id) {
                const startedAt = item.startedAt ?? (item["status"] !== JobStatus.active ? now : undefined);
                const completedAt = progress === 100 ? now : undefined;
                return {
                  ...item,
                  progress,
                  status: progress === 100 ? JobStatus.completed : JobStatus.active,
                  ...(startedAt !== undefined ? { startedAt } : {}),
                  ...(completedAt !== undefined ? { completedAt } : {})
                };
              }
              return item;
            }),
            downloadStats: {
              ...state.downloadStats,
              completed: willComplete ? state.downloadStats.completed + 1 : state.downloadStats.completed,
              inProgress: willComplete ? Math.max(0, state.downloadStats.inProgress - 1) : 
                         !wasInProgress ? state.downloadStats.inProgress + 1 :
                         state.downloadStats.inProgress,
              pending: !wasInProgress && item?.status === JobStatus.pending 
                ? Math.max(0, state.downloadStats.pending - 1) 
                : state.downloadStats.pending
            }
          };
        }),
      setError: (id, error) =>
        set((state) => {
          const item = state.queue.find(i => i["id"] === id);
          const wasInProgress = item?.status === JobStatus.active;
          const wasPending = item?.status === JobStatus.pending;
          
          return {
            queue: state.queue.map((item) =>
              item["id"] === id
                ? { 
                    ...item, 
                    status: JobStatus.failed, 
                    error,
                    completedAt: new Date() 
                  }
                : item
            ),
            downloadStats: {
              ...state.downloadStats,
              failed: state.downloadStats.failed + 1,
              inProgress: wasInProgress ? Math.max(0, state.downloadStats.inProgress - 1) : state.downloadStats.inProgress,
              pending: wasPending ? Math.max(0, state.downloadStats.pending - 1) : state.downloadStats.pending
            }
          };
        }),
      pauseDownload: (id) =>
        set((state) => {
          const item = state.queue.find(i => i["id"] === id);
          const wasInProgress = item?.status === JobStatus.active;
          const wasPending = item?.status === JobStatus.pending;
          
          return {
            queue: state.queue.map((item) =>
              item["id"] === id
                ? { ...item, status: JobStatus.pending, isPaused: true }
                : item
            ),
            downloadStats: {
              ...state.downloadStats,
              paused: state.downloadStats.paused + 1,
              inProgress: wasInProgress ? Math.max(0, state.downloadStats.inProgress - 1) : state.downloadStats.inProgress,
              pending: wasPending ? Math.max(0, state.downloadStats.pending - 1) : state.downloadStats.pending
            }
          };
        }),
      resumeDownload: (id) =>
        set((state) => {
          const item = state.queue.find(i => i["id"] === id);
          const itemRecord = item as DownloadQueueItem & { isPaused?: boolean } | undefined;
          const wasPaused = item?.status === JobStatus.pending && itemRecord?.isPaused;

          return {
            queue: state.queue.map((item) =>
              item["id"] === id
                ? {
                    ...item,
                    status: item.progress > 0 ? JobStatus.active : JobStatus.pending
                  }
                : item
            ),
            downloadStats: {
              ...state.downloadStats,
              paused: wasPaused ? Math.max(0, state.downloadStats.paused - 1) : state.downloadStats.paused,
              inProgress: (wasPaused && item.progress && item.progress > 0)
                ? state.downloadStats.inProgress + 1
                : state.downloadStats.inProgress,
              pending: (wasPaused && (!item.progress || item.progress === 0))
                ? state.downloadStats.pending + 1
                : state.downloadStats.pending
            }
          };
        }),
      cancelDownload: (id) =>
        set((state) => {
          const item = state.queue.find(i => i["id"] === id);
          const itemRecord = item as DownloadQueueItem & { isPaused?: boolean } | undefined;
          const wasInProgress = item?.status === JobStatus.active;
          const wasPending = item?.status === JobStatus.pending;
          const wasPaused = item?.status === JobStatus.pending && itemRecord?.isPaused;

          return {
            queue: state.queue.map((item) =>
              item["id"] === id
                ? {
                    ...item,
                    status: JobStatus.cancelled,
                    completedAt: new Date()
                  }
                : item
            ),
            downloadStats: {
              ...state.downloadStats,
              cancelled: state.downloadStats.cancelled + 1,
              inProgress: wasInProgress ? Math.max(0, state.downloadStats.inProgress - 1) : state.downloadStats.inProgress,
              pending: wasPending ? Math.max(0, state.downloadStats.pending - 1) : state.downloadStats.pending,
              paused: wasPaused ? Math.max(0, state.downloadStats.paused - 1) : state.downloadStats.paused
            }
          };
        }),
      clearQueue: () => set(initialState),
      updateQueue: (updater) => set((state) => ({ queue: updater(state.queue) })),
      setDownloadOperationResult: (result) =>
        set((_state) => ({
          downloadOperationResult: result
        })),
    })) as DownloadQueueStateCreator
  )
);