/**
 * Log Retention Service
 *
 * Manages log file retention by automatically cleaning up old log files.
 * Runs as a scheduled cron job (default: daily at 4 AM).
 *
 * Features:
 * - Configurable retention period via KAIZOKU_LOG_RETENTION_DAYS
 * - Deletes both plain text and gzip-compressed log files
 * - Safe deletion with error handling
 *
 * @module server/services/logging/LogRetentionService
 */

import * as fs from 'fs/promises';
import path from 'path';

import { CronJob } from 'cron';

import type { AsyncResult } from '@/utils/async-result';
import { createSuccessResult, createErrorResult } from '@/utils/async-result';
import { logger } from '@/utils/logger';

/**
 * Log retention configuration
 */
interface LogRetentionConfig {
  /** Log directory path */
  logPath: string;
  /** Number of days to retain logs */
  retentionDays: number;
  /** Cron schedule for retention job (default: 4 AM daily) */
  schedule: string;
}

/**
 * Log file info for retention processing
 */
interface LogFileInfo {
  name: string;
  path: string;
  mtime: Date;
  ageInDays: number;
}

/**
 * Delete a single log file with error handling
 * @returns true if deleted successfully, false otherwise
 */
async function deleteLogFile(logFile: LogFileInfo): Promise<boolean> {
  try {
    await fs.unlink(logFile.path);
    logger.info('[LogRetentionService] Deleted old log file', {
      file: logFile.name,
      ageInDays: Math.round(logFile.ageInDays),
    });
    return true;
  } catch (error: unknown) {
    logger.warn('[LogRetentionService] Failed to delete log file', {
      file: logFile.name,
      error,
    });
    return false;
  }
}

/**
 * Delete old log files that exceed retention period
 */
async function deleteOldLogFiles(
  logFiles: LogFileInfo[],
  cutoffDate: Date
): Promise<number> {
  let deletedCount = 0;

  for (const logFile of logFiles) {
    if (logFile.mtime < cutoffDate) {
      // eslint-disable-next-line no-await-in-loop -- Sequential deletion for logging accuracy
      const deleted = await deleteLogFile(logFile);
      if (deleted) {
        deletedCount++;
      }
    }
  }

  return deletedCount;
}

/**
 * Get file stats with error handling
 */
async function getLogFileInfo(
  logsDir: string,
  file: string,
  now: number
): Promise<LogFileInfo | null> {
  const filePath = path.join(logsDir, file);
  try {
    const stats = await fs.stat(filePath);
    const ageInDays = (now - stats.mtime.getTime()) / (24 * 60 * 60 * 1000);
    return {
      name: file,
      path: filePath,
      mtime: stats.mtime,
      ageInDays,
    };
  } catch (error: unknown) {
    logger.warn('[LogRetentionService] Failed to stat file', { file, error });
    return null;
  }
}

/**
 * Log Retention Service
 *
 * Automatically cleans up old log files based on configured retention period.
 * Follows project conventions for error handling and logging.
 */
export class LogRetentionService {
  private job: CronJob | null = null;
  private config: LogRetentionConfig;
  private isRunning = false;
  private lastRun: Date | null = null;
  private lastError: string | null = null;

  constructor(config?: Partial<LogRetentionConfig>) {
    this.config = {
      logPath: this.getLogPath(),
      retentionDays: this.getRetentionDays(),
      schedule: config?.schedule ?? '0 4 * * *', // 4 AM daily
      ...config,
    };
  }

  /**
   * Get log path from environment with fallback
   */
  private getLogPath(): string {
    try {
      // eslint-disable-next-line no-undef
      const { env } = require('@/utils/validateEnv') as {
        env: { KAIZOKU_LOG_PATH?: string };
      };
      return env.KAIZOKU_LOG_PATH ?? './logs';
    } catch (_error: unknown) {
      return process.env['KAIZOKU_LOG_PATH'] ?? './logs';
    }
  }

  /**
   * Get retention days from environment with fallback
   */
  private getRetentionDays(): number {
    try {
      // eslint-disable-next-line no-undef
      const { env } = require('@/utils/validateEnv') as {
        env: { KAIZOKU_LOG_RETENTION_DAYS?: number };
      };
      return env.KAIZOKU_LOG_RETENTION_DAYS ?? 30;
    } catch (_error: unknown) {
      return parseInt(process.env['KAIZOKU_LOG_RETENTION_DAYS'] ?? '30', 10);
    }
  }

  /**
   * Start the log retention service
   */
  start(): AsyncResult<void, Error> {
    try {
      if (this.job) {
        logger.warn('[LogRetentionService] Already started');
        return createSuccessResult(undefined);
      }

      logger.info('[LogRetentionService] Starting log retention service', {
        logPath: this.config.logPath,
        retentionDays: this.config.retentionDays,
        schedule: this.config.schedule,
      });

      this.job = new CronJob(
        this.config.schedule,
        () => {
          void this.runRetention();
        },
        null,
        true, // Start immediately
        'UTC'
      );

      logger.info('[LogRetentionService] Log retention service started', {
        nextRun: this.job.nextDate().toISO(),
      });

      return createSuccessResult(undefined);
    } catch (error: unknown) {
      logger.error('[LogRetentionService] Failed to start', { error });
      return createErrorResult(
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Stop the log retention service
   */
  stop(): void {
    if (this.job) {
      void this.job.stop();
      this.job = null;
      logger.info('[LogRetentionService] Log retention service stopped');
    }
  }

  /**
   * Run log retention cleanup
   */
  async runRetention(): Promise<AsyncResult<number, Error>> {
    if (this.isRunning) {
      logger.warn('[LogRetentionService] Retention already running, skipping');
      return createSuccessResult(0);
    }

    this.isRunning = true;
    this.lastRun = new Date();
    this.lastError = null;

    logger.info('[LogRetentionService] Starting log retention cleanup', {
      logPath: this.config.logPath,
      retentionDays: this.config.retentionDays,
    });

    try {
      const result = await this.performRetentionCleanup();
      return result;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.lastError = errorMessage;
      logger.error('[LogRetentionService] Log retention cleanup failed', {
        error: errorMessage,
      });
      return createErrorResult(
        error instanceof Error ? error : new Error(errorMessage)
      );
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Perform the actual retention cleanup
   */
  private async performRetentionCleanup(): Promise<AsyncResult<number, Error>> {
    const logsDir = path.resolve(process.cwd(), this.config.logPath);

    // Check if logs directory exists
    const dirExists = await this.checkLogsDirectory(logsDir);
    if (!dirExists) {
      return createSuccessResult(0);
    }

    // Get all files and filter log files
    const files = await fs.readdir(logsDir);
    const now = Date.now();
    const retentionMs = this.config.retentionDays * 24 * 60 * 60 * 1000;
    const cutoffDate = new Date(now - retentionMs);

    // Collect log file info
    const logFiles = await this.collectLogFileInfo(logsDir, files, now);

    // Delete old files
    const deletedCount = await deleteOldLogFiles(logFiles, cutoffDate);

    logger.info('[LogRetentionService] Log retention cleanup completed', {
      totalFiles: logFiles.length,
      deletedFiles: deletedCount,
      retentionDays: this.config.retentionDays,
    });

    return createSuccessResult(deletedCount);
  }

  /**
   * Check if logs directory exists
   */
  private async checkLogsDirectory(logsDir: string): Promise<boolean> {
    try {
      await fs.access(logsDir);
      return true;
    } catch (_error: unknown) {
      logger.info('[LogRetentionService] Logs directory does not exist, nothing to clean');
      return false;
    }
  }

  /**
   * Collect information about log files
   */
  private async collectLogFileInfo(
    logsDir: string,
    files: string[],
    now: number
  ): Promise<LogFileInfo[]> {
    const logFiles: LogFileInfo[] = [];

    for (const file of files) {
      if (!this.isLogFile(file)) {
        continue;
      }

      // eslint-disable-next-line no-await-in-loop -- Sequential processing for logging accuracy
      const fileInfo = await getLogFileInfo(logsDir, file, now);
      if (fileInfo) {
        logFiles.push(fileInfo);
      }
    }

    return logFiles;
  }

  /**
   * Check if a file is a log file
   */
  private isLogFile(filename: string): boolean {
    // Match patterns:
    // - *.log
    // - *.log.gz
    // - *.log.1, *.log.2, etc. (rotated files)
    // - development.*, production.*, test.* (pino-roll files)
    const logPatterns = [
      /\.log$/,
      /\.log\.gz$/,
      /\.log\.\d+$/,
      /\.log\.\d+\.gz$/,
      /^(development|production|test)\.\d+$/,
      /^(development|production|test)\.\d+\.gz$/,
    ];

    return logPatterns.some((pattern) => pattern.test(filename));
  }

  /**
   * Get service status
   */
  getStatus(): {
    isRunning: boolean;
    lastRun: Date | null;
    lastError: string | null;
    nextRun: Date | null;
    config: LogRetentionConfig;
  } {
    return {
      isRunning: this.isRunning,
      lastRun: this.lastRun,
      lastError: this.lastError,
      nextRun: this.job ? this.job.nextDate().toJSDate() : null,
      config: { ...this.config },
    };
  }

  /**
   * Manually trigger retention cleanup
   */
  async triggerRetention(): Promise<AsyncResult<number, Error>> {
    logger.info('[LogRetentionService] Manually triggering log retention');
    return this.runRetention();
  }
}

/**
 * Singleton instance of LogRetentionService
 */
export const logRetentionService = new LogRetentionService();
