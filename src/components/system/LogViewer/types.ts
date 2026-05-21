/**
 * Type definitions for LogViewer component
 */

import type { LogEntry } from '@/utils/logging/unified-logger';

// Re-export LogEntry for components that need it
export type { LogEntry };

export interface LogFileInfo {
  name: string;
  size: number;
  lastModified: Date;
  path: string;
}

export interface LogFilesResponse {
  logFiles: Array<{
    name: string;
    size: number;
    modifiedAt: string | Date;
    path: string;
  }>;
}

export interface LogsResponse {
  logs: LogEntry[];
  total: number;
}

export interface LogViewerFiltersProps {
  logLevel: string;
  setLogLevel: (level: string) => void;
  selectedLogFile: string | null;
  setSelectedLogFile: (file: string | null) => void;
  limit: number;
  setLimit: (limit: number) => void;
  search: string;
  setSearch: (search: string) => void;
  logFileOptions: Array<{ value: string; label: string }>;
  isLoadingFiles: boolean;
}

export interface LogViewerActionsProps {
  isLoadingFiles: boolean;
  isLoadingLogs: boolean;
  selectedLogFile: string | null;
  showDebugInfo: boolean;
  clearLogPending: boolean;
  onRefresh: () => void;
  onToggleDebug: () => void;
  onDownload: () => void;
  onClear: () => void;
}

export interface LogViewerDebugPanelProps {
  logFiles: Array<{
    name: string;
    size: number;
    modifiedAt: string | Date;
    path: string;
  }>;
  selectedLogFile: string | null;
  logFilesError?: unknown;
  logsError?: unknown;
}

export interface LogViewerAlertsProps {
  hasError: boolean;
  errorMessage: string;
  showDebugInfo: boolean;
  isLoadingFiles: boolean;
  logFilesCount: number;
}

export interface LogViewerLogEntryProps {
  log: LogEntry;
  index: number;
  isExpanded: boolean;
  onToggleExpansion: (index: number) => void;
}

export interface LogViewerLogListProps {
  logs: LogEntry[];
  expandedLogs: Set<number>;
  onToggleExpansion: (index: number) => void;
  totalLogs: number;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}
