/**
 * Log Service
 *
 * Provides log file management operations for the application.
 * Reads and manages Pino log files from the configured logs directory.
 *
 * @module server/services/logs
 */

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

import {
  createSuccessResult,
  createErrorResult,
  createContextualError,
} from '@/utils/async-result';
import type { AsyncResult } from '@/utils/async-result';
import { logger } from '@/utils/logging';

// ============================================================================
// Type Definitions
// ============================================================================

interface LogEntry {
  timestamp?: Date | undefined;
  level?: string | undefined;
  message?: string | undefined;
  [key: string]: unknown;
}

interface GetLogsResult {
  logs: LogEntry[];
  total: number;
}

interface GetLogsOptions {
  limit?: number;
  level?: string;
  search?: string;
  offset?: number;
  file?: string;
}

interface LogFileInfo {
  name: string;
  path: string;
  size: number;
  modifiedAt: Date;
}

interface LogFileMetadata {
  size: number;
  lineCount: number;
  modifiedAt: Date;
}

interface LogFileContentResult {
  content: string;
  total: number;
  hasMore: boolean;
  offset: number;
  limit: number;
}

// ============================================================================
// Path Safety
// ============================================================================

// Permits Pino's rotated/compressed naming: `app.log`, `app.log.1`, `app.log.1.gz`.
const LOG_FILENAME_PATTERN = /^[\w.-]+\.log(\.\d+)?(\.gz)?$/;

function getLogsDirectory(): string {
  const configuredPath = process.env['KAIZOKU_LOG_PATH'] ?? 'logs';
  if (path.isAbsolute(configuredPath)) {
    return path.resolve(configuredPath);
  }
  return path.resolve(process.cwd(), configuredPath);
}

/**
 * Validate a caller-supplied log path and return its canonical absolute form.
 * Throws if the input escapes the logs directory or names a non-log file.
 */
function resolveSafeLogPath(userInput: string): string {
  if (typeof userInput !== 'string' || userInput.length === 0 || userInput.includes('\0')) {
    throw new Error('Invalid log path');
  }

  const logsDir = getLogsDirectory();
  // path.resolve returns absolute inputs unchanged and joins relative inputs onto logsDir.
  const resolved = path.resolve(logsDir, userInput);
  const logsDirWithSep = logsDir.endsWith(path.sep) ? logsDir : logsDir + path.sep;

  if (!resolved.startsWith(logsDirWithSep) && resolved !== logsDir) {
    throw new Error(`Log path '${userInput}' is outside the logs directory`);
  }

  const rel = path.relative(logsDir, resolved);
  if (rel.length === 0 || rel.includes(path.sep)) {
    throw new Error(`Log path '${userInput}' must be a single filename inside the logs directory`);
  }

  if (!LOG_FILENAME_PATTERN.test(rel)) {
    throw new Error(`Log filename '${rel}' is not a valid log file name`);
  }

  return resolved;
}

// ============================================================================
// Helper Functions
// ============================================================================

function parseLogLine(line: string): LogEntry | null {
  const trimmed = line.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    const timestamp = parsed['time'] ? new Date(parsed['time'] as number) : undefined;
    const level = parsed['level'] as string | undefined;
    const message = (parsed['msg'] ?? parsed['message']) as string | undefined;
    return { timestamp, level, message, ...parsed };
  } catch {
    return { message: trimmed };
  }
}

function matchesLevel(log: LogEntry, targetLevel: string): boolean {
  return log.level?.toLowerCase() === targetLevel.toLowerCase();
}

function matchesSearch(log: LogEntry, searchTerm: string): boolean {
  const term = searchTerm.toLowerCase();
  const messageMatch = log.message?.toLowerCase().includes(term) ?? false;
  const jsonMatch = JSON.stringify(log).toLowerCase().includes(term);
  return messageMatch || jsonMatch;
}

function matchesFilters(log: LogEntry, options: GetLogsOptions): boolean {
  if (options.level && !matchesLevel(log, options.level)) {
    return false;
  }
  if (options.search && !matchesSearch(log, options.search)) {
    return false;
  }
  return true;
}

function resolveLogFilePath(logsDir: string, options: GetLogsOptions): string {
  if (options.file) {
    return resolveSafeLogPath(options.file);
  }
  const env = process.env.NODE_ENV;
  return path.join(logsDir, `${env}.log`);
}

async function readLogFileInfo(directory: string, fileName: string): Promise<LogFileInfo | null> {
  if (!LOG_FILENAME_PATTERN.test(fileName)) {
    return null;
  }

  const filePath = path.join(directory, fileName);
  const stats = await fs.promises.stat(filePath);

  if (!stats.isFile()) {
    return null;
  }

  return {
    name: fileName,
    path: filePath,
    size: stats.size,
    modifiedAt: stats.mtime,
  };
}

function createLogError(message: string, code: string, error?: unknown): AsyncResult<never, Error> {
  const errorMessage = error instanceof Error ? error.message : message;
  return createErrorResult(createContextualError(errorMessage, code));
}

/**
 * Stream a file line-by-line, invoking the handler for each line.
 * Bounded memory: only one line is held at a time on the streaming side.
 */
async function streamLines(
  filePath: string,
  handler: (line: string, index: number) => void
): Promise<void> {
  const stream = fs.createReadStream(filePath, { encoding: 'utf-8' });
  try {
    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
    let i = 0;
    for await (const line of rl) {
      handler(line, i);
      i++;
    }
  } finally {
    stream.destroy();
  }
}

// ============================================================================
// Log Service Implementation
// ============================================================================

async function getLogs(options: GetLogsOptions = {}): Promise<AsyncResult<GetLogsResult, Error>> {
  try {
    const logsDir = getLogsDirectory();
    const limit = options.limit ?? 100;
    const offset = options.offset ?? 0;
    const logFile = resolveLogFilePath(logsDir, options);

    if (!fs.existsSync(logFile)) {
      return createSuccessResult({ logs: [], total: 0 });
    }

    // Bounded memory: keep at most `offset + limit` matching entries (the most recent ones).
    // We only need the newest `offset + limit` to satisfy any pagination request, since the
    // result is reversed (newest-first) and then sliced from index `offset`.
    const windowSize = offset + limit;
    const window: LogEntry[] = [];
    let total = 0;

    await streamLines(logFile, (line) => {
      const parsed = parseLogLine(line);
      if (!parsed || !matchesFilters(parsed, options)) {
        return;
      }
      total++;
      window.push(parsed);
      if (window.length > windowSize) {
        window.shift();
      }
    });

    const paginatedLogs = window.reverse().slice(offset, offset + limit);
    return createSuccessResult({ logs: paginatedLogs, total });
  } catch (error) {
    logger.error('Failed to get logs', error);
    return createLogError('Failed to get logs', 'LOG_READ_ERROR', error);
  }
}

async function getLogFiles(logsDir?: string): Promise<AsyncResult<LogFileInfo[], Error>> {
  try {
    const directory = logsDir ?? getLogsDirectory();

    if (!fs.existsSync(directory)) {
      return createSuccessResult([]);
    }

    const files = await fs.promises.readdir(directory);
    const logFilePromises = files.map((file) => readLogFileInfo(directory, file));
    const results = await Promise.all(logFilePromises);
    const logFiles = results.filter((info): info is LogFileInfo => info !== null);

    logFiles.sort((a, b) => b.modifiedAt.getTime() - a.modifiedAt.getTime());

    return createSuccessResult(logFiles);
  } catch (error) {
    logger.error('Failed to get log files', error);
    return createLogError('Failed to get log files', 'LOG_FILES_ERROR', error);
  }
}

async function getLogFileMetadata(filePath: string): Promise<AsyncResult<LogFileMetadata, Error>> {
  try {
    const safePath = resolveSafeLogPath(filePath);

    if (!fs.existsSync(safePath)) {
      return createLogError('Log file not found', 'LOG_FILE_NOT_FOUND');
    }

    const stats = await fs.promises.stat(safePath);

    let lineCount = 0;
    await streamLines(safePath, (line) => {
      if (line.length > 0) {
        lineCount++;
      }
    });

    return createSuccessResult({
      size: stats.size,
      lineCount,
      modifiedAt: stats.mtime,
    });
  } catch (error) {
    logger.error('Failed to get log file metadata', error);
    return createLogError('Failed to get log file metadata', 'LOG_METADATA_ERROR', error);
  }
}

async function getLogFileContent(
  filePath: string,
  options: { offset?: number; limit?: number } = {}
): Promise<AsyncResult<LogFileContentResult, Error>> {
  try {
    const safePath = resolveSafeLogPath(filePath);
    const offset = options.offset ?? 0;
    const limit = options.limit ?? 100;

    if (!fs.existsSync(safePath)) {
      return createLogError('Log file not found', 'LOG_FILE_NOT_FOUND');
    }

    const selected: string[] = [];
    let total = 0;
    let totalLinesSeen = 0;

    await streamLines(safePath, (line, index) => {
      totalLinesSeen = index + 1;
      if (line.length > 0) {
        total++;
      }
      if (index >= offset && index < offset + limit) {
        selected.push(line);
      }
    });

    return createSuccessResult({
      content: selected.join('\n'),
      total,
      hasMore: offset + limit < totalLinesSeen,
      offset,
      limit,
    });
  } catch (error) {
    logger.error('Failed to get log file content', error);
    return createLogError('Failed to get log file content', 'LOG_CONTENT_ERROR', error);
  }
}

async function clearLogFile(filePath: string): Promise<AsyncResult<boolean, Error>> {
  try {
    const safePath = resolveSafeLogPath(filePath);

    if (!fs.existsSync(safePath)) {
      return createLogError('Log file not found', 'LOG_FILE_NOT_FOUND');
    }

    await fs.promises.writeFile(safePath, '');
    logger.info('Log file cleared', { path: safePath });

    return createSuccessResult(true);
  } catch (error) {
    logger.error('Failed to clear log file', error);
    return createLogError('Failed to clear log file', 'LOG_CLEAR_ERROR', error);
  }
}

export const logService = {
  getLogs,
  getLogFiles,
  getLogFileMetadata,
  getLogFileContent,
  clearLogFile,
};

export default logService;
