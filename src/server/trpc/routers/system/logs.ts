/**
 * System Logs Router
 *
 * Provides log management operations for the application including:
 * - Retrieving logs with filtering and pagination
 * - Listing available log files
 * - Getting log file metadata
 * - Reading log file content
 * - Clearing log files
 *
 * Procedures:
 * - getLogs: Query logs with filtering (public)
 * - getLogFiles: List available log files (public)
 * - getLogFileMetadata: Get file metadata without content (public)
 * - getLogFileContent: Read paginated log content (public)
 * - clearLogFile: Clear a log file (admin)
 *
 * Extracted from: system.ts (lines 382-611)
 *
 * @module system/logs
 */

import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { logService } from '@/server/services/logs/index';
import { adminProcedure } from '@/server/trpc/procedures';
import { router } from '@/server/trpc/trpc';
import {
  isSuccess,
  createSuccessResult,
  createErrorResult,
  createContextualError,
} from '@/utils/async-result';
import type { AsyncResult } from '@/utils/async-result';
import { ValidationError } from '@/utils/errors';
import { logger } from '@/utils/logging';
import { env } from '@/utils/validateEnv';

import { hasMethod } from './utils';

// ============================================================================
// Type Definitions for Log Service Results
// ============================================================================

/**
 * Log entry returned from the log service
 */
interface LogEntry {
  timestamp?: Date;
  level?: string;
  message?: string;
  [key: string]: unknown;
}

/**
 * Result from getLogs operation
 */
interface GetLogsResult {
  logs: LogEntry[];
  total: number;
}

/**
 * Information about a single log file
 */
interface LogFileInfo {
  name: string;
  path: string;
  size: number;
  modifiedAt: Date;
}

/**
 * Metadata about a log file (without content)
 */
interface LogFileMetadata {
  size: number;
  lineCount: number;
  modifiedAt: Date;
}

/**
 * Paginated log file content result
 */
interface LogFileContentResult {
  content: string;
  total: number;
  hasMore: boolean;
  offset: number;
  limit: number;
}

// ============================================================================
// Type-Safe Log Service Method Types
// ============================================================================

/**
 * Options for getLogs method (matches log service signature)
 */
interface GetLogsOptions {
  limit?: number;
  level?: string;
  search?: string;
  offset?: number;
  file?: string;
}

type GetLogsMethod = (
  options?: GetLogsOptions
) => Promise<AsyncResult<GetLogsResult, Error>>;

type GetLogFilesMethod = (
  logsDir?: string
) => Promise<AsyncResult<LogFileInfo[], Error>>;

type GetLogFileMetadataMethod = (
  path: string
) => Promise<AsyncResult<LogFileMetadata, Error>>;

type GetLogFileContentMethod = (
  path: string,
  options?: { offset?: number; limit?: number }
) => Promise<AsyncResult<LogFileContentResult, Error>>;

type ClearLogFileMethod = (
  path: string
) => Promise<AsyncResult<boolean, Error>>;

// ============================================================================
// Router Definition
// ============================================================================

export const systemLogsRouter = router({
  /**
   * Retrieves application logs with filtering options
   *
   * This endpoint queries the log service to retrieve application logs,
   * with support for pagination, filtering by log level, and text search.
   *
   * @param {Object} input - Log retrieval parameters
   * @param {number} [input.limit=100] - Maximum number of log entries to return (1-1000)
   * @param {string} [input.level] - Filter logs by level (e.g., 'error', 'info')
   * @param {string} [input.search] - Text to search for in log messages
   * @param {number} [input.offset=0] - Number of log entries to skip for pagination
   * @param {string} [input.file] - Specific log file to query
   * @returns {Promise<Object>} Log entries and total count
   */
  getLogs: adminProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(1000).default(100),
        level: z.string().optional(),
        search: z.string().optional(),
        offset: z.number().min(0).default(0),
        file: z.string().optional(),
      })
    )
    .query(async ({ input }): Promise<GetLogsResult> => {
      try {
        const logParams: GetLogsOptions = {
          limit: input.limit,
          offset: input.offset,
        };
        if (input.level !== undefined) logParams.level = input.level;
        if (input.search !== undefined) logParams.search = input.search;
        if (input.file !== undefined) logParams.file = input.file;

        if (!hasMethod(logService, 'getLogs')) {
          throw new ValidationError('Log service not available');
        }

        // Type-safe method extraction
        const getLogsMethod = logService['getLogs'] as GetLogsMethod;
        const result = await getLogsMethod(logParams);

        if (isSuccess(result)) {
          return result.data;
        }
        throw new ValidationError('Failed to get logs');
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        logger.error('Failed to get logs', errorMessage);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get logs',
        });
      }
    }),

  /**
   * Retrieves a list of available log files
   *
   * This endpoint returns information about all log files in the system,
   * including their paths, sizes, and modification dates.
   *
   * @returns {Promise<Object>} List of available log files
   */
  getLogFiles: adminProcedure.query(
    async (): Promise<{ logFiles: LogFileInfo[] }> => {
      try {
        if (!hasMethod(logService, 'getLogFiles')) {
          throw new ValidationError('Log service not available');
        }

        // Type-safe method extraction
        const getLogFilesMethod = logService['getLogFiles'] as GetLogFilesMethod;
        const result = await getLogFilesMethod();

        if (isSuccess(result)) {
          return { logFiles: result.data };
        }
        throw new ValidationError('Failed to get log files');
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        logger.error('Failed to get log files', errorMessage);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get log files',
        });
      }
    }
  ),

  /**
   * Retrieves metadata about a log file without loading content
   *
   * This endpoint returns file information (size, line count, modified date)
   * without actually loading the log content. This is much faster and used
   * to determine the appropriate display strategy for different file sizes.
   *
   * @param {Object} input - Query parameters
   * @param {string} input.path - Path to the log file
   * @returns {Promise<Object>} File metadata (size, lineCount, modifiedAt)
   */
  getLogFileMetadata: adminProcedure
    .input(
      z.object({
        path: z.string(),
      })
    )
    .query(async ({ input }): Promise<LogFileMetadata> => {
      try {
        if (!hasMethod(logService, 'getLogFileMetadata')) {
          throw new ValidationError('Log service not available');
        }

        // Type-safe method extraction
        const getLogFileMetadataMethod = logService[
          'getLogFileMetadata'
        ] as GetLogFileMetadataMethod;
        const result = await getLogFileMetadataMethod(input.path);

        if (isSuccess(result)) {
          return result.data;
        }
        throw new ValidationError('Failed to get log file metadata');
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        logger.error('Failed to get log file metadata', errorMessage);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get log file metadata',
        });
      }
    }),

  /**
   * Retrieves the content of a specific log file with pagination support
   *
   * This endpoint returns paginated text content of a log file
   * identified by its path. Supports offset and limit to handle large files.
   *
   * @param {Object} input - Query parameters
   * @param {string} input.path - Path to the log file
   * @param {number} [input.offset=0] - Number of lines to skip
   * @param {number} [input.limit=100] - Maximum number of lines to return
   * @returns {Promise<Object>} Paginated log content with metadata
   */
  getLogFileContent: adminProcedure
    .input(
      z.object({
        path: z.string(),
        offset: z.number().min(0).default(0),
        limit: z.number().min(1).max(5000).default(100),
      })
    )
    .query(async ({ input }): Promise<LogFileContentResult> => {
      try {
        if (!hasMethod(logService, 'getLogFileContent')) {
          throw new ValidationError('Log service not available');
        }

        // Type-safe method extraction
        const getLogFileContentMethod = logService[
          'getLogFileContent'
        ] as GetLogFileContentMethod;
        const result = await getLogFileContentMethod(input.path, {
          offset: input.offset,
          limit: input.limit,
        });

        if (isSuccess(result)) {
          return result.data;
        }
        throw new ValidationError('Failed to get log file content');
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        logger.error('Failed to get log file content', errorMessage);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get log file content',
        });
      }
    }),

  /**
   * Clears the content of a specific log file
   *
   * This endpoint truncates a log file identified by its path,
   * removing all existing log entries while keeping the file itself.
   *
   * @param {Object} input - Mutation parameters
   * @param {string} input.path - Path to the log file to clear
   * @returns {Promise<Object>} Success status
   */
  clearLogFile: adminProcedure
    .input(
      z.object({
        path: z.string(),
      })
    )
    .mutation(async ({ input }): Promise<AsyncResult<boolean, Error>> => {
      try {
        if (!hasMethod(logService, 'clearLogFile')) {
          return createErrorResult(
            createContextualError(
              'Log service not available',
              'LOG_SERVICE_UNAVAILABLE'
            )
          );
        }

        // Type-safe method extraction
        const clearLogFileMethod = logService[
          'clearLogFile'
        ] as ClearLogFileMethod;
        const result = await clearLogFileMethod(input.path);

        if (isSuccess(result)) {
          return createSuccessResult(!!result.data);
        }
        return createErrorResult(
          createContextualError('Failed to clear log file', 'LOG_CLEAR_FAILED')
        );
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        logger.error('Failed to clear log file', errorMessage);
        return createErrorResult(
          createContextualError(errorMessage, 'INTERNAL_SERVER_ERROR')
        );
      }
    }),

  /**
   * Retrieves log rotation configuration settings
   *
   * This endpoint returns the current log rotation configuration
   * including max size, max files, compression, and retention days.
   *
   * @returns {Promise<Object>} Log rotation configuration
   */
  getLogConfig: adminProcedure.query((): {
    maxSize: string;
    maxFiles: number;
    compress: boolean;
    retentionDays: number;
    logPath: string;
  } => {
    return {
      maxSize: env.KAIZOKU_LOG_MAX_SIZE,
      maxFiles: env.KAIZOKU_LOG_MAX_FILES,
      compress: env.KAIZOKU_LOG_COMPRESS,
      retentionDays: env.KAIZOKU_LOG_RETENTION_DAYS,
      logPath: env.KAIZOKU_LOG_PATH,
    };
  }),
});
