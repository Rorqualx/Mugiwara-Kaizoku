/**
 * System Logs Hook
 *
 * Custom hook for managing system log files and log content.
 * Provides functionality for listing, viewing, downloading, and clearing log files.
 * Follows the AsyncResult pattern for error handling and state management.
 *
 * Features:
 * - List available log files
 * - View log file content
 * - Download log files
 * - Clear log files
 * - Real-time loading states
 * - Comprehensive error handling
 *
 * @module hooks/useSystemLogs
 * @requires React
 * @requires trpc - API client for server communication
 * @requires AsyncResult - Type-safe async operation handling
 */

import { useState, useCallback, useEffect } from 'react';

import type {
  AsyncResult} from '@/utils/async-result';
import {
  createSuccessResult,
  createErrorResult,
  createLoadingResult,
  createIdleResult,
  isError,
  isLoading } from
'@/utils/async-result';
import { trpc } from '@/utils/trpc-client/index';

// File size thresholds for display strategy
const LOG_DISPLAY_THRESHOLDS = {
  FULL_DISPLAY: 500 * 1024,        // 500KB - Full pagination support
  PREVIEW_DISPLAY: 2 * 1024 * 1024, // 2MB - Preview mode with download
  // Above 2MB: Download only
};

// Display mode type
export type LogDisplayMode = 'full' | 'preview' | 'download-only';

// Define LogFileInfo locally since it's not in Prisma
interface LogFileInfo {
  name: string;
  path: string;
  size: number;
  modifiedAt: Date;
}

/**
 * Log rotation configuration from environment
 */
export interface LogConfig {
  maxSize: string;
  maxFiles: number;
  compress: boolean;
  retentionDays: number;
  logPath: string;
}

/**
 * useSystemLogs Hook Return Type
 */
export interface UseSystemLogsResult {
  /** All available log files */
  logFiles: LogFileInfo[];
  /** Whether log files are currently loading */
  isLoadingFiles: boolean;
  /** Error that occurred while loading log files (if any) */
  filesError?: Error;
  /** Function to refresh the list of log files */
  refreshLogFiles: () => Promise<void>;

  /** Log rotation configuration */
  logConfig: LogConfig | null;
  /** Whether log config is loading */
  isLoadingConfig: boolean;

  /** Currently selected log file path */
  selectedLogFile: string | null;
  /** Set the selected log file */
  setSelectedLogFile: (path: string | null) => void;
  /** Function to view a log file's content */
  viewLogFile: (path: string) => void;

  /** Display mode for the selected log file */
  displayMode: LogDisplayMode;
  /** File size of the selected log file (in bytes) */
  selectedFileSize: number;

  /** Content of the currently selected log file */
  logContent: string | null;
  /** Whether log content is currently loading */
  isLoadingContent: boolean;
  /** Error that occurred while loading log content (if any) */
  contentError?: Error;

  /** Function to clear the selected log file */
  clearLogFile: (path: string) => Promise<void>;
  /** Whether a log file is currently being cleared */
  isClearingLogFile: boolean;
  /** Error that occurred while clearing log file (if any) */
  clearError?: Error;

  /** Function to download a log file */
  downloadLogFile: (path: string) => void;

  /** Total number of lines in the log file */
  totalLines: number;
  /** Whether there are more lines to load */
  hasMore: boolean;
  /** Function to load more log content */
  loadMore: () => void;
  /** Whether more content is currently being loaded */
  isLoadingMore: boolean;
}

/**
 * Custom hook for managing system log files
 *
 * @returns {UseSystemLogsResult} Log management functions and state
 */
// ESLint disable: Logging hook inherently complex with file listing, viewing, pagination, and download
 
export function useSystemLogs(): UseSystemLogsResult {
  // State management
  const [selectedLogFile, setSelectedLogFile] = useState<string | null>(null);
  const [logContent, setLogContent] = useState<string | null>(null);
  const [logContentState, setLogContentState] = useState<AsyncResult<string, Error>>(
    createIdleResult<string, Error>()
  );
  const [clearLogState, setClearLogState] = useState<AsyncResult<boolean, Error>>(
    createIdleResult<boolean, Error>()
  );

  // Display mode state
  const [displayMode, setDisplayMode] = useState<LogDisplayMode>('full');
  const [selectedFileSize, setSelectedFileSize] = useState<number>(0);

  // Pagination state
  const [offset, setOffset] = useState(0);
  const [limit, setLimit] = useState(100); // Default for full display mode
  const [totalLines, setTotalLines] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  /**
   * Determine display mode based on file size
   */
  const determineDisplayMode = useCallback((fileSize: number): LogDisplayMode => {
    if (fileSize < LOG_DISPLAY_THRESHOLDS.FULL_DISPLAY) {
      return 'full';
    } else if (fileSize < LOG_DISPLAY_THRESHOLDS.PREVIEW_DISPLAY) {
      return 'preview';
    } else {
      return 'download-only';
    }
  }, []);

  // tRPC queries and mutations
  const logFilesQuery = trpc.system.getLogFiles.useQuery();
  const logConfigQuery = trpc.system.getLogConfig.useQuery();

  const logContentQuery = trpc.system.getLogFileContent.useQuery(
    {
      path: selectedLogFile ?? '',
      offset: offset, // Now reactive - updates when offset changes
      limit: limit    // Now uses state (100)
    },
    {
      enabled: !!selectedLogFile,
      refetchOnWindowFocus: false
    }
  );

  const clearLogFileMutation = trpc.system.clearLogFile.useMutation();

  /**
   * Refresh log files list
   */
  const refreshLogFiles = useCallback(async () => {
    try {
      await logFilesQuery.refetch();
    } catch (_error: unknown) {
      // Error is handled by tRPC query error state
    }
  }, [logFilesQuery]);

  /**
   * View log file content
   *
   * @param path - Log file path to view
   */
  const viewLogFile = useCallback((path: string) => {
    try {
      if (!path) {
        throw new Error('No log file path provided');
      }

      // Get file info from query data (use query data directly to avoid circular dependency)
      const queryData = logFilesQuery.data as Record<string, unknown> | undefined;
      const queryFiles = (queryData?.['logFiles'] ?? []) as Record<string, unknown>[];
      const file = queryFiles.find((f: Record<string, unknown>) => f['path'] === path);

      if (!file) {
        throw new Error('Log file not found in file list');
      }

      // Determine display mode based on file size
      const fileSize = typeof file['size'] === 'number' ? file['size'] : 0;
      const mode = determineDisplayMode(fileSize);
      setDisplayMode(mode);
      setSelectedFileSize(fileSize);

      // Set appropriate limit based on display mode
      if (mode === 'full') {
        setLimit(100); // Full pagination with 100 lines per page
      } else if (mode === 'preview') {
        setLimit(50);  // Preview mode with 50 lines only
      }

      // Reset pagination when viewing a new file
      setOffset(0);
      setLogContent(null);

      // For download-only mode, don't attempt to load content
      if (mode === 'download-only') {
        setLogContentState(createIdleResult());
        setSelectedLogFile(path);
        return;
      }

      // Setting selectedLogFile will trigger the tRPC query to fetch
      // The useEffect below will automatically update the loading/content states
      setSelectedLogFile(path);
    } catch (error: unknown) {
      setLogContent(null);
      setLogContentState(
        createErrorResult(error instanceof Error ? error : new Error(String(error)))
      );
    }
  }, [logFilesQuery.data, determineDisplayMode]);

  /**
   * Load more log content (pagination)
   * Simply increments offset - query auto-refetches and useEffect handles appending
   * Disabled in preview mode (shows fixed 50 lines only)
   */
  const loadMore = useCallback(() => {
    if (!selectedLogFile || !hasMore || logContentQuery.isLoading || displayMode === 'preview') {
      return;
    }
    // Increment offset - this triggers query refetch automatically
    setOffset((prevOffset: number) => prevOffset + limit);
  }, [selectedLogFile, hasMore, logContentQuery.isLoading, limit, displayMode]);

  /**
   * Clear log file content
   * 
   * @param path - Log file path to clear
   */
  const clearLogFile = useCallback(async (path: string) => {
    try {
      if (!path) {
        throw new Error('No log file path provided');
      }

      setClearLogState(createLoadingResult());

      await clearLogFileMutation.mutateAsync({ path });
      setClearLogState(createSuccessResult(true));

      // After clearing, refresh the file list and content
      await refreshLogFiles();

      // If this was the selected file, refresh its content
      if (path === selectedLogFile) {
        await viewLogFile(path);
      }
    } catch (error: unknown) {
      setClearLogState(
        createErrorResult(error instanceof Error ? error : new Error(String(error)))
      );
    }
  }, [clearLogFileMutation, selectedLogFile, refreshLogFiles, viewLogFile]);

  /**
   * Download log file
   * 
   * @param path - Log file path to download
   */
  const downloadLogFile = useCallback((path: string) => {
    if (!path) return;

    // Get filename from path
    const filename = path.split('/').pop() ?? 'log.log';

    // Create download link for current content
    if (logContent && selectedLogFile === path) {
      const blob = new Blob([logContent], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();

      // Clean up
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
    }
  }, [logContent, selectedLogFile]);

  // Transform query data to expected format with type safety
  const queryData = logFilesQuery.data as Record<string, unknown> | undefined;
  const rawLogFiles = (queryData?.['logFiles'] ?? []) as Record<string, unknown>[];
  const logFiles: LogFileInfo[] = rawLogFiles.map((file: Record<string, unknown>) => ({
    name: String(file['name'] ?? ''),
    path: String(file['path'] ?? ''),
    size: typeof file['size'] === 'number' ? file['size'] : 0,
    modifiedAt: typeof file['modifiedAt'] === 'string' ? new Date(file['modifiedAt']) : new Date()
  }));

  // Update log content state when query data changes
  useEffect(() => {
    if (!selectedLogFile) {
      // No file selected, clear content
      setLogContent(null);
      setLogContentState(createIdleResult());
      setTotalLines(0);
      setHasMore(false);
    } else if (logContentQuery.isLoading) {
      // Query is loading
      if (offset === 0) {
        // Initial load - clear content and show loading
        setLogContent(null);
        setLogContentState(createLoadingResult());
      } else {
        // Loading more - keep existing content, set loading flag
        setIsLoadingMore(true);
      }
    } else if (logContentQuery.data) {
      // Query succeeded
      const queryResult = logContentQuery.data as unknown as Record<string, unknown>;
      const newContent = String(queryResult['content'] ?? '');

      if (offset === 0) {
        // Initial load - replace content
        setLogContent(newContent);
      } else {
        // Loading more - append content
        setLogContent((prev: string | null) => (prev ?? '') + '\n' + newContent);
      }

      setLogContentState(createSuccessResult(newContent));
      setTotalLines(typeof queryResult['total'] === 'number' ? queryResult['total'] : 0);
      setHasMore(typeof queryResult['hasMore'] === 'boolean' ? queryResult['hasMore'] : false);
      setIsLoadingMore(false);
    } else if (logContentQuery.error) {
      // Query failed, show error
      const errorMsg = logContentQuery.error instanceof Error
        ? logContentQuery.error.message
        : (String(logContentQuery.error) || 'Failed to load log content');

      // Error is logged by tRPC layer
      setLogContent(null);
      setLogContentState(createErrorResult(new Error(errorMsg)));
      setIsLoadingMore(false);
    }
  }, [logContentQuery.data, logContentQuery.error, logContentQuery.isLoading, selectedLogFile, offset]);

  const filesError = logFilesQuery.error instanceof Error ? logFilesQuery.error : undefined;
  const contentError = isError(logContentState) ? logContentState.error :
    logContentQuery.error instanceof Error ? logContentQuery.error : undefined;
  const clearError = isError(clearLogState) ? clearLogState.error :
    clearLogFileMutation.error instanceof Error ? clearLogFileMutation.error : undefined;

  // Transform log config data
  const logConfig: LogConfig | null = logConfigQuery.data ?? null;

  return {
    // Log files listing
    logFiles,
    isLoadingFiles: logFilesQuery.isLoading,
    ...(filesError !== undefined ? { filesError } : {}),
    refreshLogFiles,

    // Log rotation config
    logConfig,
    isLoadingConfig: logConfigQuery.isLoading,

    // Selected log file
    selectedLogFile,
    setSelectedLogFile,
    viewLogFile,

    // Display mode
    displayMode,
    selectedFileSize,

    // Log content
    logContent,
    isLoadingContent: isLoading(logContentState) || logContentQuery.isLoading,
    ...(contentError !== undefined ? { contentError } : {}),

    // Clear log file
    clearLogFile,
    isClearingLogFile: isLoading(clearLogState) || clearLogFileMutation.isPending,
    ...(clearError !== undefined ? { clearError } : {}),

    // Download log file
    downloadLogFile,

    // Pagination
    totalLines,
    hasMore,
    loadMore,
    isLoadingMore
  };
}