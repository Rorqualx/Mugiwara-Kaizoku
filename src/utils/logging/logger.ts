/**
 * Production-grade logger configuration using Pino
 *
 * This module sets up a Pino logger instance with both console and file transports.
 * It handles uncaught exceptions and unhandled rejections, logging them before
 * terminating the process. The log level and file destination are environment-aware.
 *
 * Features:
 * - Size-based log rotation via pino-roll
 * - Configurable max file size (default: 10MB)
 * - Configurable max files to keep (default: 7)
 * - Optional gzip compression for old files
 *
 * @module logger
 */
import fs from 'fs';
import path from 'path';

import pino from 'pino';

/**
 * Log rotation configuration interface
 */
interface LogRotationConfig {
  maxSize: string;
  maxFiles: number;
  compress: boolean;
}

// Safely access environment variables with fallbacks
const getLogPath = (): string => {
    try {
        // Try to load validateEnv, but fall back if it fails
        // eslint-disable-next-line no-undef
        const { env } = require('../validateEnv') as { env: { KAIZOKU_LOG_PATH?: string } };
        return env.KAIZOKU_LOG_PATH ?? './logs';
    }
    catch (_error: unknown) {
        // During build time or if env validation fails, use default
        return process.env['KAIZOKU_LOG_PATH'] || './logs';
    }
};

const getNodeEnv = (): string => {
    try {
        // eslint-disable-next-line no-undef
        const { env } = require('../validateEnv') as { env: { NODE_ENV: string } };
        return env.NODE_ENV;
    }
    catch (_error: unknown) {
        // During build time or if env validation fails, use default
        return (process.env.NODE_ENV as string | undefined) || 'development';
    }
};

/**
 * Get log rotation configuration from environment
 */
const getLogRotationConfig = (): LogRotationConfig => {
    try {
        // eslint-disable-next-line no-undef
        const { env } = require('../validateEnv') as {
            env: {
                KAIZOKU_LOG_MAX_SIZE?: string;
                KAIZOKU_LOG_MAX_FILES?: number;
                KAIZOKU_LOG_COMPRESS?: boolean;
            }
        };
        return {
            maxSize: env.KAIZOKU_LOG_MAX_SIZE ?? '10m',
            maxFiles: env.KAIZOKU_LOG_MAX_FILES ?? 7,
            compress: env.KAIZOKU_LOG_COMPRESS ?? true,
        };
    }
    catch (_error: unknown) {
        // During build time or if env validation fails, use defaults
        return {
            maxSize: process.env['KAIZOKU_LOG_MAX_SIZE'] || '10m',
            maxFiles: parseInt(process.env['KAIZOKU_LOG_MAX_FILES'] || '7', 10),
            compress: process.env['KAIZOKU_LOG_COMPRESS'] !== 'false',
        };
    }
};
// Initialize logger with safe fallbacks
let logger: pino.Logger;
try {
    /**
     * Ensure logs directory exists and is accessible
     * Falls back to console-only logging if directory creation fails
     */
    const logsDir = path.resolve(process.cwd(), getLogPath());
    try {
        fs.mkdirSync(logsDir, { recursive: true });
    }
    catch (err: unknown) {
        console.error(`Failed to create logs directory at ${logsDir}:`, err);
    }
    /**
     * Configure logging transports based on environment
     *
     * Sets up two potential transport targets:
     * 1. Console transport (always enabled)
     * 2. File transport with rotation (enabled if logs directory is available)
     *
     * Log rotation features:
     * - Size-based rotation (default: 10MB per file)
     * - Keep configurable number of old files (default: 7)
     * - Optional gzip compression for old files
     *
     * Log levels are environment-aware:
     * - Production: 'info' and above
     * - Development/Test: 'debug' and above
     */
    const rotationConfig = getLogRotationConfig();
    const transport = pino.transport({
        targets: [
            // Console transport for all environments
            {
                target: 'pino/file',
                level: 'info',
                options: { destination: 1 } // stdout
            },
            // File transport with rotation if directory is available
            ...(fs.existsSync(logsDir) ? [{
                    target: 'pino-roll',
                    level: getNodeEnv() === 'production' ? 'info' : 'debug',
                    options: {
                        file: path.join(logsDir, getNodeEnv()),
                        size: rotationConfig.maxSize,
                        frequency: 'daily',
                        limit: { count: rotationConfig.maxFiles },
                        mkdir: true,
                        ...(rotationConfig.compress ? { compress: 'gzip' } : {}),
                    }
                }] : [])
        ]
    }) as pino.DestinationStream;
    /**
     * Create and configure the Pino logger instance
     *
     * @property {string} level - Log level threshold ('info' in production, 'debug' otherwise)
     * @property {Object} formatters - Custom formatters for log entries
     * @property {Function} timestamp - ISO time formatter for consistent timestamps
     */
    logger = pino({
        level: getNodeEnv() === 'production' ? 'info' : 'debug',
        formatters: {
            level(label) {
                return { level: label };
            }
        },
        timestamp: pino.stdTimeFunctions.isoTime,
    }, transport);
}
catch (error: unknown) {
    console.error('Failed to initialize server-side logging, using console fallback:', error);
    logger = pino({
        level: 'info',
        transport: {
            target: 'pino/file',
            options: { destination: 1 } // stdout only
        }
    });
}
/**
 * Handle uncaught exceptions
 *
 * Logs the error with fatal level and terminates the process
 * This is a last resort error handler for unexpected errors
 */
process.on('uncaughtException', (error) => {
    logger.fatal(error, error instanceof Error ? (error instanceof Error ? error.message : String(error)) : String(error), 'Uncaught Exception');
    process.exit(1);
});
/**
 * Handle unhandled promise rejections
 *
 * Logs the rejection details with fatal level and terminates the process
 * This catches any promises that reject without a .catch() handler
 */
process.on('unhandledRejection', (reason, promise) => {
    logger.fatal({
        type: "fatal",
        error: reason instanceof Error ? reason.message : String(reason),
        reason,
        promise
    }, 'Unhandled Rejection');
    process.exit(1);
});
export { logger };
export default logger;
