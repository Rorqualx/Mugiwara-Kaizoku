/**
 * Utility functions for LogViewer component
 */

import { logger } from '@/utils/logger';

import type { LogFileInfo } from './types';

/**
 * Type guard to check if a value is a Record
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Log file option for select dropdown
 */
export interface LogFileOption {
  value: string;
  label: string;
}

/**
 * Format log files data into select options
 *
 * @param logFiles - Array of log file info from API
 * @returns Formatted options for select dropdown
 */
export function formatLogFileOptions(
  logFiles: Array<{ name: string; path: string; size: number; modifiedAt: string | Date }> | undefined
): LogFileOption[] {
  const baseOption: LogFileOption = { value: '', label: 'Current Log' };

  if (!logFiles) {
    return [baseOption];
  }

  const fileOptions = logFiles.map((file) => {
    const logFile: LogFileInfo = {
      name: file.name,
      path: file.path,
      size: file.size,
      lastModified: typeof file.modifiedAt === 'string' ? new Date(file.modifiedAt) : file.modifiedAt
    };
    return {
      value: logFile.path,
      label: `${logFile.name} (${(logFile.size / 1024).toFixed(1)} KB)`
    };
  });

  return [baseOption, ...fileOptions];
}

/**
 * Get color for log level badge
 */
export function getLogColor(level: string): string {
  switch (level.toLowerCase()) {
    case 'error':
      return 'red';
    case 'warn':
    case 'warning':
      return 'yellow';
    case 'info':
      return 'blue';
    case 'debug':
      return 'gray';
    case 'trace':
      return 'violet';
    default:
      return 'dimmed';
  }
}

/**
 * Format log details for display
 */
export function formatDetails(details: unknown): string {
  // Handle null or undefined
  if (details === null) {
    return 'No details available';
  }

  // Ensure details is an object
  if (typeof details !== 'object') {
    return String(details);
  }

  // Safe stringify with error handling
  try {
    return JSON.stringify(details, null, 2);
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error('Error formatting log details:', errorMessage);
    return 'Error formatting details: Invalid data structure';
  }
}
