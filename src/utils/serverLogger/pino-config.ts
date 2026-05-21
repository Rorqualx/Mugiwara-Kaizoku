import { logger } from '@/utils/logger';

/**
 * Pino Configuration Utilities
 *
 * Extracted utilities for configuring Pino logger with environment-based settings.
 * Handles path resolution, log file creation, and error formatting.
 */

// Node.js module interfaces for require() calls
interface PathModule {
  join: (...paths: string[]) => string;
  isAbsolute: (path: string) => boolean;
  resolve: (...paths: string[]) => string;
}

interface FsModule {
  existsSync: (path: string) => boolean;
  mkdirSync: (path: string, options?: { recursive?: boolean }) => void;
}

interface EnvModule {
  env?: {
    KAIZOKU_LOG_PATH?: string;
    NODE_ENV?: string;
  };
}

/**
 * Environment configuration for logging
 */
interface EnvironmentConfig {
  KAIZOKU_LOG_PATH: string;
  NODE_ENV: string;
}

/**
 * Log file paths configuration
 */
interface LogFilePaths {
  logFile: string;
  errorLogFile: string;
}

/**
 * Converts error to string message.
 * Handles Error instances and unknown types safely.
 *
 * @param error - Error object or unknown value
 * @returns Formatted error message string
 */
export function formatErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Gets environment configuration for logging.
 * Attempts to load from env module, falls back to process.env.
 *
 * @returns Environment configuration with log path and environment
 */
export function getEnvironmentConfig(): EnvironmentConfig {
  // Get environment variables - NODE_ENV is guaranteed to be defined via TypeScript declarations
  const kaizokuLogPath = process.env["KAIZOKU_LOG_PATH"] ?? 'logs';
  const env: EnvironmentConfig = {
    KAIZOKU_LOG_PATH: kaizokuLogPath,
    NODE_ENV: process.env.NODE_ENV,
  };

  // Try to load from env module if available
  try {
    // eslint-disable-next-line no-undef
    const envModule = require('../../env/server') as EnvModule;
    if (envModule.env && typeof envModule.env === 'object') {
      Object.assign(env, {
        KAIZOKU_LOG_PATH: envModule.env.KAIZOKU_LOG_PATH ?? env.KAIZOKU_LOG_PATH,
        NODE_ENV: envModule.env.NODE_ENV ?? env.NODE_ENV,
      });
    }
  } catch (_envError: unknown) {
    // Silently fall back to process.env values
  }

  return env;
}

/**
 * Resolves log path to absolute directory.
 * Handles relative paths, ./ prefixes, and invalid paths.
 *
 * @param configPath - Configured log path from environment
 * @returns Absolute path to logs directory
 */
export function resolveLogPath(configPath: string): string {
  // eslint-disable-next-line no-undef
  const path = require('path') as PathModule;
  // eslint-disable-next-line no-undef
  const fs = require('fs') as FsModule;

  const cwd = process.cwd();
  let logsDir = configPath;

  // If the path starts with ./, remove it for proper resolution
  if (logsDir.startsWith('./')) {
    logsDir = logsDir.substring(2);
  }

  // If it's not an absolute path, resolve it relative to cwd
  if (!path.isAbsolute(logsDir)) {
    logsDir = path.join(cwd, logsDir);
  }

  // Ensure the path is valid
  if (!logsDir || logsDir === '/logs') {
    // Fallback to a safe location in the project directory
    logsDir = path.join(cwd, 'logs');
  }

  // Create logs directory if it doesn't exist
  if (!fs.existsSync(logsDir)) {
    try {
      fs.mkdirSync(logsDir, { recursive: true });
    } catch (error: unknown) {
      logger.warn(`Failed to create logs directory at ${logsDir}:`, error);
    }
  }

  return logsDir;
}

/**
 * Creates log file paths for main and error logs.
 *
 * @param logsDir - Absolute path to logs directory
 * @param env - Node environment (development/production)
 * @returns Object with logFile and errorLogFile paths
 */
export function createLogFilePaths(logsDir: string, env: string): LogFilePaths {
  // eslint-disable-next-line no-undef
  const path = require('path') as PathModule;

  const logFile = path.join(logsDir, `${env}.log`);
  const errorLogFile = path.join(logsDir, 'error.log');

  return { logFile, errorLogFile };
}
