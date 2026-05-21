/**
 * Volume Split Progress Hook
 *
 * React hook for tracking real-time progress of volume splitting operations.
 * Uses tRPC polling to fetch progress updates at regular intervals.
 *
 * Features:
 * - Real-time progress tracking with automatic polling
 * - Stage-based progress display (extracting, detecting, creating, etc.)
 * - Percentage completion calculation
 * - Error state handling
 * - Automatic polling stop when operation completes
 *
 * @module hooks/useVolumeSplitProgress
 */

import { useEffect, useState } from 'react';

import { useRealTime } from '@/providers/RealTimeProvider';
import { trpc } from '@/utils/trpc-client';

/**
 * Stage of the volume split operation
 */
export type SplitStage =
  | 'initializing'
  | 'extracting_images'
  | 'detecting_chapters'
  | 'calculating_confidence'
  | 'creating_chapters'
  | 'complete'
  | 'error';

/**
 * Progress information for a volume split operation
 */
export interface VolumeSplitProgress {
  /** Unique operation ID */
  operationId: string;

  /** Path to the volume being split */
  volumePath: string;

  /** Current stage of the operation */
  stage: SplitStage;

  /** Overall percentage complete (0-100) */
  percentComplete: number;

  /** Current chapter being processed (if in creating_chapters stage) */
  currentChapter?: number;

  /** Total chapters to create (if known) */
  totalChapters?: number;

  /** Total images extracted (if known) */
  totalImages?: number;

  /** Number of chapters created so far */
  chaptersCreated: number;

  /** Files created during split */
  createdFiles: string[];

  /** Error message if stage is 'error' */
  errorMessage?: string;

  /** Timestamp when operation started */
  startedAt: Date;

  /** Timestamp when operation completed (if complete) */
  completedAt?: Date;
}

/**
 * Hook options
 */
export interface UseVolumeSplitProgressOptions {
  /** Operation ID to track */
  operationId: string | null;

  /** Polling interval in milliseconds (default: 1000ms) */
  pollingInterval?: number;

  /** Whether to enable polling (default: true) */
  enabled?: boolean;

  /** Callback when operation completes */
  onComplete?: (progress: VolumeSplitProgress) => void;

  /** Callback when operation errors */
  onError?: (error: string) => void;
}

/**
 * Hook return value
 */
export interface UseVolumeSplitProgressResult {
  /** Current progress state */
  progress: VolumeSplitProgress | null;

  /** Whether progress data is being fetched */
  isLoading: boolean;

  /** Error fetching progress */
  error: Error | null;

  /** Whether operation is active (not complete/error) */
  isActive: boolean;

  /** Whether operation completed successfully */
  isComplete: boolean;

  /** Whether operation failed */
  isError: boolean;

  /** Refresh progress manually */
  refetch: () => void;
}

/**
 * Get user-friendly stage label
 */
function getStageLabel(stage: SplitStage): string {
  switch (stage) {
    case 'initializing':
      return 'Initializing...';
    case 'extracting_images':
      return 'Extracting Images';
    case 'detecting_chapters':
      return 'Detecting Chapters';
    case 'calculating_confidence':
      return 'Analyzing Confidence';
    case 'creating_chapters':
      return 'Creating Chapter Files';
    case 'complete':
      return 'Complete';
    case 'error':
      return 'Error';
    default:
      return 'Unknown';
  }
}

/**
 * useVolumeSplitProgress Hook
 *
 * Tracks real-time progress of a volume split operation
 *
 * @example
 * ```tsx
 * function ProgressDisplay({ operationId }: { operationId: string }) {
 *   const { progress, isLoading, isComplete, isError } = useVolumeSplitProgress({
 *     operationId,
 *     onComplete: (progress) => {
 *       
 *     },
 *     onError: (error) => {
 *       console.error('Split failed:', error);
 *     }
 *   });
 *
 *   if (isLoading) return <div>Loading...</div>;
 *   if (isError) return <div>Error: {progress?.errorMessage}</div>;
 *   if (!progress) return <div>No operation found</div>;
 *
 *   return (
 *     <div>
 *       <div>Stage: {getStageLabel(progress.stage)}</div>
 *       <ProgressBar value={progress.percentComplete} />
 *       {progress.currentChapter && (
 *         <div>Chapter {progress.currentChapter} / {progress.totalChapters}</div>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 */
export function useVolumeSplitProgress(
  options: UseVolumeSplitProgressOptions
): UseVolumeSplitProgressResult {
  const {
    operationId,
    pollingInterval = 1000,
    enabled = true,
    onComplete,
    onError
  } = options;

  const [lastCompleteId, setLastCompleteId] = useState<string | null>(null);

  // WebSocket connection for real-time updates
  const { isConnected, subscribe } = useRealTime();

  // Determine if we should poll (enabled, has operationId, and not already completed)
  const shouldPoll = enabled && operationId !== null && operationId !== lastCompleteId;

  // Query progress with automatic refetching (only when WebSocket disconnected)
  const { data: progress, isLoading, error, refetch } = trpc.volumeSplit.getProgress.useQuery(
    { operationId: operationId ?? '' },
    {
      enabled: shouldPoll,
      refetchInterval: isConnected ? false : pollingInterval, // Only poll when WebSocket disconnected
      refetchIntervalInBackground: false,
      refetchOnWindowFocus: false,
      refetchOnMount: true,
      retry: (failureCount, error) => {
        // Stop retrying if operation not found (404)
        if (error.data?.code === 'NOT_FOUND') {
          return false;
        }
        // Retry up to 3 times for other errors
        return failureCount < 3;
      }
    }
  );

  // Subscribe to WebSocket volume split events for real-time updates
  useEffect(() => {
    if (!isConnected || !shouldPoll) return;

    const unsubscribe = subscribe('volume-split:progress', () => {
      void refetch();
    });

    return unsubscribe;
  }, [isConnected, subscribe, shouldPoll, refetch]);

  // Derived states
  const isActive = progress ? progress.stage !== 'complete' && progress.stage !== 'error' : false;
  const isComplete = progress?.stage === 'complete';
  const isErrorState = progress?.stage === 'error';

  // Handle completion callback
  useEffect(() => {
    if (progress && isComplete && onComplete && operationId && operationId !== lastCompleteId) {
      setLastCompleteId(operationId);
      onComplete(progress);
    }
  }, [progress, isComplete, onComplete, operationId, lastCompleteId]);

  // Handle error callback
  useEffect(() => {
    if (progress && isErrorState && onError && progress.errorMessage) {
      onError(progress.errorMessage);
    }
  }, [progress, isErrorState, onError]);

  return {
    progress: progress ?? null,
    isLoading,
    error: error ? new Error(error.message) : null,
    isActive,
    isComplete,
    isError: isErrorState,
    refetch: () => { void refetch(); }
  };
}

/**
 * useActiveOperations Hook
 *
 * Tracks all active volume split operations
 *
 * @example
 * ```tsx
 * function ActiveOperationsList() {
 *   const { operations, isLoading } = useActiveOperations();
 *
 *   if (isLoading) return <div>Loading...</div>;
 *
 *   return (
 *     <div>
 *       <h3>Active Operations ({operations.length})</h3>
 *       {operations.map(op => (
 *         <div key={op.operationId}>
 *           {op.volumePath} - {op.percentComplete}%
 *         </div>
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */
export interface UseActiveOperationsReturn {
  operations: VolumeSplitProgress[];
  count: number;
  isLoading: boolean;
  error: unknown;
  refetch: () => void;
}

export function useActiveOperations(pollingInterval = 2000): UseActiveOperationsReturn {
  // WebSocket connection for real-time updates
  const { isConnected, subscribe } = useRealTime();

  const { data, isLoading, error, refetch } = trpc.volumeSplit.getActiveOperations.useQuery(
    undefined,
    {
      refetchInterval: isConnected ? false : pollingInterval, // Only poll when WebSocket disconnected
      refetchIntervalInBackground: false,
      refetchOnWindowFocus: true,
      refetchOnMount: true
    }
  );

  // Subscribe to WebSocket volume split events for real-time updates
  useEffect(() => {
    if (!isConnected) return;

    const unsubscribe = subscribe('volume-split:progress', () => {
      void refetch();
    });

    return unsubscribe;
  }, [isConnected, subscribe, refetch]);

  return {
    operations: data?.operations ?? [],
    count: data?.count ?? 0,
    isLoading,
    error,
    refetch: () => { void refetch(); }
  };
}

/**
 * Export utility function for stage labels
 */
export { getStageLabel };
