/**
 * LogViewer component for displaying and managing system logs
 *
 * This component provides a comprehensive interface for viewing, filtering, and managing system logs.
 * It supports features like:
 * - Log level filtering (error, warn, info, debug, trace)
 * - Full-text search across logs
 * - Pagination with configurable items per page
 * - Log file selection and management
 * - Real-time log updates (30-second refresh interval)
 * - Expandable log details with JSON formatting
 * - Log file download and clearing capabilities
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';

import { Paper, Title, Group } from '@mantine/core';
import { } from '@tabler/icons-react';

import { useRealTime } from '@/providers/RealTimeProvider';
import { logger } from '@/utils/logger';
import { notify } from '@/utils/notify';
import { trpc } from '@/utils/trpc-client/index';

import { LogViewerActions } from './LogViewerActions';
import { LogViewerAlerts } from './LogViewerAlerts';
import { LogViewerContent } from './LogViewerContent';
import { LogViewerDebugPanel } from './LogViewerDebugPanel';
import { LogViewerFilters } from './LogViewerFilters';
import { formatLogFileOptions, isRecord } from './utils';

import type { LogFilesResponse, LogsResponse } from './types';

export default function LogViewer(): JSX.Element {
  const [logLevel, setLogLevel] = useState<string>('all');
  const [limit, setLimit] = useState<number>(100);
  const [search, setSearch] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [selectedLogFile, setSelectedLogFile] = useState<string | null>(null);
  const [expandedLogs, setExpandedLogs] = useState<Set<number>>(new Set());
  const [showDebugInfo, setShowDebugInfo] = useState<boolean>(false);
  const [logFileToDownload, setLogFileToDownload] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);

  // WebSocket connection for real-time updates
  const { isConnected, subscribe } = useRealTime();

  // Calculate offset from page and limit
  const offset = (page - 1) * limit;

  // Get log files
  const {
    data: logFilesData,
    isLoading: isLoadingFiles,
    error: logFilesError,
    refetch: refetchFiles
  } = trpc.system.getLogFiles.useQuery();

  // Get logs with filtering and pagination
  const {
    data: logsData,
    isLoading: isLoadingLogs,
    error: logsError,
    refetch: refetchLogs
  } = trpc.system.getLogs.useQuery({
    limit,
    level: logLevel === 'all' ? undefined : logLevel,
    search,
    offset,
    ...(selectedLogFile !== null ? { file: selectedLogFile } : {})
  });

  // Get log file content for download
  const { refetch: refetchLogContent } = trpc.system.getLogFileContent.useQuery(
    { path: logFileToDownload ?? '' },
    { enabled: !!logFileToDownload }
  );

  // Clear log file mutation
  const clearLogFileMutation = trpc.system.clearLogFile.useMutation({
    onSuccess: () => {
      void refetchLogs();
      void refetchFiles();
      notify({ severity: 'SUCCESS', title: 'Success', message: 'Log file has been cleared' });
    },
    onError: (error) => {
      logger.error('Failed to clear log file:', error);
      notify({ severity: 'ERROR', title: 'Error', message: `Failed to clear log file: ${error instanceof Error ? error.message : String(error)}` });
    }
  });

  // Memoized refetch function for stable dependency
  const memoizedRefetch = useCallback((): void => {
    void refetchLogs();
  }, [refetchLogs]);

  // Subscribe to WebSocket system log events for real-time updates
  useEffect(() => {
    if (!isConnected) return;

    const unsubscribe = subscribe('system:logs', () => {
      memoizedRefetch();
    });

    return unsubscribe;
  }, [isConnected, subscribe, memoizedRefetch]);

  // Auto-refresh logs every 30 seconds (only when WebSocket disconnected)
  useEffect(() => {
    if (isConnected) return; // Skip polling when WebSocket is connected

    const interval = setInterval(() => {
      void refetchLogs();
    }, 30000);
    return (): void => clearInterval(interval);
  }, [refetchLogs, isConnected]);

  // Reset pagination when filters change
  useEffect(() => {
    setPage(1);
  }, [logLevel, search, limit, selectedLogFile]);

  // Scroll to top when page changes
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: 0 });
    }
  }, [page]);

  // Type-safe data access
  const typedLogFilesData = logFilesData as LogFilesResponse | undefined;
  const typedLogsData = logsData as LogsResponse | undefined;

  // Calculate total pages
  const totalPages = typedLogsData?.total ? Math.ceil(typedLogsData.total / limit) : 1;

  // Format log file options using helper
  const logFileOptions = formatLogFileOptions(typedLogFilesData?.logFiles);

  // Toggle log expansion
  const toggleLogExpansion = (logId: number): void => {
    const newExpanded = new Set(expandedLogs);
    if (newExpanded.has(logId)) {
      newExpanded.delete(logId);
    } else {
      newExpanded.add(logId);
    }
    setExpandedLogs(newExpanded);
  };

  // Handle force refresh
  const handleForceRefresh = (): void => {
    void refetchLogs();
    void refetchFiles();
    notify({ severity: 'INFO', title: 'Refreshing', message: 'Refreshing log data...' });
  };

  // Toggle debug info
  const toggleDebugInfo = (): void => {
    setShowDebugInfo(!showDebugInfo);
  };

  // Handle log file download
  const handleDownloadLog = async (): Promise<void> => {
    if (!selectedLogFile) return;

    try {
      setLogFileToDownload(selectedLogFile);
      const result = await refetchLogContent();

      if (result.data && isRecord(result.data) && typeof result.data.content === 'string') {
        const blob = new Blob([result.data.content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = selectedLogFile.split('/').pop() ?? 'log.txt';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        notify({ severity: 'SUCCESS', title: 'Success', message: 'Log file downloaded successfully' });
      }
    } catch (error: unknown) {
      logger.error('Failed to download log file:', error);
      notify({ severity: 'ERROR', title: 'Error', message: `Failed to download log file: ${error instanceof Error ? error.message : 'Unknown error'}` });
    } finally {
      setLogFileToDownload(null);
    }
  };

  // Handle log file clear
  const handleClearLog = (): void => {
    if (!selectedLogFile || !window.confirm('Are you sure you want to clear this log file? This action cannot be undone.')) {
      return;
    }
    clearLogFileMutation.mutateAsync({ path: selectedLogFile }).catch(() => {});
  };

  // Check for errors
  const hasError = !!(logFilesError ?? logsError);
  const errorMessage = logFilesError?.message ?? logsError?.message ?? 'Unknown error';

  return (
    <Paper p="md" withBorder>
      <Group justify="space-between" mb="md">
        <Title order={3}>System Logs</Title>

        <LogViewerActions
          isLoadingFiles={isLoadingFiles}
          isLoadingLogs={isLoadingLogs}
          selectedLogFile={selectedLogFile}
          showDebugInfo={showDebugInfo}
          clearLogPending={clearLogFileMutation.isPending}
          onRefresh={handleForceRefresh}
          onToggleDebug={toggleDebugInfo}
          onDownload={(): void => {
            void handleDownloadLog();
          }}
          onClear={handleClearLog}
        />
      </Group>

      {showDebugInfo && (
        <LogViewerDebugPanel
          logFiles={typedLogFilesData?.logFiles ?? []}
          selectedLogFile={selectedLogFile}
          logFilesError={logFilesError}
          logsError={logsError}
        />
      )}

      <LogViewerAlerts
        hasError={hasError}
        errorMessage={errorMessage}
        showDebugInfo={showDebugInfo}
        isLoadingFiles={isLoadingFiles}
        logFilesCount={typedLogFilesData?.logFiles.length ?? 0}
      />

      <LogViewerFilters
        logLevel={logLevel}
        setLogLevel={setLogLevel}
        selectedLogFile={selectedLogFile}
        setSelectedLogFile={setSelectedLogFile}
        limit={limit}
        setLimit={setLimit}
        search={search}
        setSearch={setSearch}
        logFileOptions={logFileOptions}
        isLoadingFiles={isLoadingFiles}
      />

      <LogViewerContent
        isLoading={isLoadingLogs}
        error={logsError}
        logs={typedLogsData?.logs}
        total={typedLogsData?.total ?? 0}
        expandedLogs={expandedLogs}
        onToggleExpansion={toggleLogExpansion}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
      />
    </Paper>
  );
}
