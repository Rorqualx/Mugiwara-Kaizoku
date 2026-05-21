import { useState, useEffect, useCallback, useRef } from 'react';

import { logger } from '../utils/logger';
export interface BackupProgress {
  stage: 'initializing' | 'database' | 'config' | 'media' | 'compressing' | 'finalizing' | 'completed' | 'failed';
  percentage: number;
  message: string;
  error?: string;
}

/**
 * Raw backup progress data from server (before validation)
 */
interface BackupProgressData {
  type: string;
  stage?: string;
  percentage?: number;
  message?: string;
  error?: string;
}

/**
 * Type guard to validate backup progress data from JSON.parse
 */
function isBackupProgressData(value: unknown): value is BackupProgressData {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const obj = value as {
    type?: unknown;
    stage?: unknown;
    percentage?: unknown;
    message?: unknown;
    error?: unknown;
  };

  return (
    typeof obj.type === 'string' &&
    (obj.stage === undefined || typeof obj.stage === 'string') &&
    (obj.percentage === undefined || typeof obj.percentage === 'number') &&
    (obj.message === undefined || typeof obj.message === 'string') &&
    (obj.error === undefined || typeof obj.error === 'string')
  );
}

/**
 * Validates that a stage string is a valid BackupProgress stage
 */
function isValidStage(stage: string): stage is BackupProgress['stage'] {
  return [
    'initializing',
    'database',
    'config',
    'media',
    'compressing',
    'finalizing',
    'completed',
    'failed'
  ].includes(stage);
}
interface UseBackupProgressOptions {
  onProgress?: (progress: BackupProgress) => void;
  onComplete?: () => void;
  onError?: (error: string) => void;
}

/**
 * Return type for useBackupProgress hook
 */
export interface UseBackupProgressReturn {
  progress: BackupProgress | null;
  isConnected: boolean;
  disconnect: () => void;
}

export function useBackupProgress(backupId: string | null, options: UseBackupProgressOptions = {}): UseBackupProgressReturn {
  const [progress, setProgress] = useState<BackupProgress | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);

  // Store options in a ref to avoid dependency issues
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  // Memoize callbacks to prevent infinite loops
  const handleProgress = useCallback((data: BackupProgress) => {
    setProgress(data);
    optionsRef.current.onProgress?.(data);
  }, []);

  const handleComplete = useCallback(() => {
    optionsRef.current.onComplete?.();
  }, []);

  const handleError = useCallback((error: string) => {
    optionsRef.current.onError?.(error);
  }, []);

  const connect = useCallback(() => {
    if (!backupId || eventSourceRef.current) {
      return;
    }
    try {
      const eventSource = new EventSource(`/api/backup/progress/${backupId}`);
      eventSourceRef.current = eventSource;
      eventSource.onopen = () => {
        setIsConnected(true);
        reconnectAttemptsRef.current = 0;
        logger.info(`Connected to backup progress stream for ${backupId}`);
      };
      eventSource.onmessage = (event: unknown) => {
        const messageEvent = event as MessageEvent;
        try {
          const rawData: unknown = JSON.parse(messageEvent.data as string);

          if (!isBackupProgressData(rawData)) {
            logger.error('Invalid backup progress data received', { data: rawData });
            return;
          }

          if (rawData.type === 'progress') {
            // Validate required fields
            if (!rawData.stage || !isValidStage(rawData.stage)) {
              logger.error('Invalid or missing stage in progress data', { stage: rawData.stage });
              return;
            }

            if (typeof rawData.percentage !== 'number' || rawData.percentage < 0 || rawData.percentage > 100) {
              logger.error('Invalid or missing percentage in progress data', { percentage: rawData.percentage });
              return;
            }

            if (typeof rawData.message !== 'string') {
              logger.error('Invalid or missing message in progress data', { message: rawData.message });
              return;
            }

            const progressData: BackupProgress = {
              stage: rawData.stage,
              percentage: rawData.percentage,
              message: rawData.message,
              ...(rawData.error !== undefined && { error: rawData.error })
            };

            handleProgress(progressData);

            if (progressData.stage === 'completed') {
              handleComplete();
            } else if (progressData.stage === 'failed' && progressData.error) {
              handleError(progressData.error);
            }
          }
        } catch (error: unknown) {
          logger.error('Failed to parse progress data', { error });
        }
      };
      eventSource.onerror = (error: unknown) => {
        logger.error('EventSource error', { error });
        setIsConnected(false);
        eventSource.close();
        eventSourceRef.current = null;

        // Attempt to reconnect with exponential backoff
        if (reconnectAttemptsRef.current < 5 && backupId) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 10000);
          reconnectAttemptsRef.current++;
          logger.info(`Attempting to reconnect in ${delay}ms (attempt ${reconnectAttemptsRef.current})`);
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        } else {
          handleError('Failed to connect to progress stream');
        }
      };
    } catch (error: unknown) {
      logger.error('Failed to create EventSource', { error });
      handleError('Failed to connect to progress stream');
    }
  }, [backupId, handleProgress, handleComplete, handleError]);
  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    setIsConnected(false);
    setProgress(null);
    reconnectAttemptsRef.current = 0;
  }, []);
  useEffect(() => {
    if (backupId) {
      connect();
    }
    return () => {
      disconnect();
    };
  }, [backupId, connect, disconnect]);
  return {
    progress,
    isConnected,
    disconnect
  };
}