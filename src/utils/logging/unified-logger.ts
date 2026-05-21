/**
 * Unified Logger Implementation
 *
 * This module provides a unified logger that works consistently across the entire
 * application, supporting all log levels and providing integration with the event system.
 *
 * @module utils/logging/unified-logger
 */
import type { EventType} from '@/server/services/events/eventTypes';
import { EventLevel, EventSource, EventTypeToLevel } from '@/server/services/events/eventTypes';

import { standardLogger } from './standardLogger';

import type { StandardLogger } from './standardLogger';
/**
 * Configuration for the unified logger
 */
export interface UnifiedLoggerConfig {
    minLevel?: EventLevel;
    enableConsole?: boolean;
    enableEvents?: boolean;
    enableNotifications?: boolean;
    source?: EventSource;
    metadata?: Record<string, unknown>;
}
/**
 * Log entry structure
 */
export interface LogEntry {
    level: EventLevel;
    message: string;
    timestamp: Date;
    source?: EventSource;
    metadata?: Record<string, unknown>;
    error?: Error;
    stackTrace?: string;
}
/**
 * Unified logger interface extending StandardLogger
 */
export interface UnifiedLogger extends StandardLogger {
    /**
     * Log with a specific level
     */
    log(level: EventLevel, message: string, error?: unknown): void;
    /**
     * Log a critical error
     */
    critical(message: string, error?: unknown): void;
    /**
     * Set the minimum log level
     */
    setMinLevel(level: EventLevel): void;
    /**
     * Get current configuration
     */
    getConfig(): UnifiedLoggerConfig;
    /**
     * Create a child logger with additional context
     */
    child(context: Record<string, unknown>): UnifiedLogger;
    /**
     * Log and create a system event
     */
    logEvent(type: EventType, message: string, metadata?: Record<string, unknown>): void;
}
/**
 * Map EventLevel to numeric values for comparison
 */
const LOG_LEVEL_VALUES: Record<EventLevel, number> = {
    [EventLevel.DEBUG]: 0,
    [EventLevel.INFO]: 1,
    [EventLevel.WARNING]: 2,
    [EventLevel.ERROR]: 3,
    [EventLevel.CRITICAL]: 4,
};
/**
 * Create a unified logger instance
 */
export function createUnifiedLogger(config: UnifiedLoggerConfig = {}, baseLogger: StandardLogger = standardLogger): UnifiedLogger {
    const { minLevel = EventLevel.INFO, enableConsole = true, enableEvents = true, enableNotifications = true, source = EventSource.SYSTEM, metadata = {}, } = config;
    let currentMinLevel = minLevel;
    /**
     * Check if a log level should be logged based on minimum level
     */
    function shouldLog(level: EventLevel): boolean {
        return LOG_LEVEL_VALUES[level] >= LOG_LEVEL_VALUES[currentMinLevel];
    }
    /**
     * Format error for logging
     */
    function formatError(error: unknown): {
        message: string;
        stack?: string;
    } {
        if (error instanceof Error) {
            return {
                message: error.message,
                ...(error.stack && { stack: error.stack }),
            };
        }
        if (typeof error === 'string') {
            return { message: error };
        }
        return {
            message: String(error),
        };
    }
    /**
     * Internal log method
     */
    function internalLog(level: EventLevel, message: string, error?: unknown): void {
        if (!shouldLog(level)) {
            return;
        }
        const entry: LogEntry = {
            level,
            message,
            timestamp: new Date(),
            source,
            metadata,
        };
        if (error) {
            const errorInfo = formatError(error);
            entry.error = error instanceof Error ? error : new Error(errorInfo.message);
            if (errorInfo.stack !== undefined) {
                entry.stackTrace = errorInfo.stack;
            }
        }
        // Log to console if enabled
        if (enableConsole) {
            const logMethod = getConsoleMethod(level);
            const logMessage = formatLogMessage(entry);
            if (entry.error) {
                logMethod(logMessage, entry.error);
            }
            else {
                logMethod(logMessage);
            }
        }
        // Send to event system if enabled
        if (enableEvents) {
            void sendToEventSystem(entry);
        }
        // Send to notification system if enabled and critical
        if (enableNotifications && level === EventLevel.CRITICAL) {
            void sendToNotificationSystem(entry);
        }
    }
    /**
     * Get appropriate console method for log level
     */
    function getConsoleMethod(level: EventLevel): (message: string, ...args: unknown[]) => void {
        switch (level) {
            case EventLevel.DEBUG:
                return baseLogger.debug.bind(baseLogger);
            case EventLevel.INFO:
                return baseLogger.info.bind(baseLogger);
            case EventLevel.WARNING:
                return baseLogger.warn.bind(baseLogger);
            case EventLevel.ERROR:
            case EventLevel.CRITICAL:
                return baseLogger.error.bind(baseLogger);
            default:
                return baseLogger.info.bind(baseLogger);
        }
    }
    /**
     * Format log message with metadata
     */
    function formatLogMessage(entry: LogEntry): string {
        const parts = [
            `[${entry.timestamp.toISOString()}]`,
            `[${entry.level.toUpperCase()}]`,
            entry["source"] ? `[${entry["source"]}]` : '',
            entry.message,
        ].filter(Boolean);
        if (Object.keys(entry["metadata"] ?? {}).length > 0) {
            parts.push(`| ${JSON.stringify(entry["metadata"])}`);
        }
        return parts.join(' ');
    }
    /**
     * Send log entry to event system
     */
    function sendToEventSystem(entry: LogEntry): Promise<void> {
        try {
            // This would integrate with the actual event system
            // For now, we'll use the base logger to indicate this would happen
            if (entry.level === EventLevel.ERROR || entry.level === EventLevel.CRITICAL) {
                baseLogger.debug('Would send to event system:', entry);
            }
            return Promise.resolve();
        }
        catch (error: unknown) {const errorMessage = error instanceof Error ? error.message : String(error);
// Don't fail if event system is unavailable
            baseLogger.error('Failed to send to event system:', errorMessage);
            return Promise.resolve();
        }
    }
    /**
     * Send critical logs to notification system
     */
    function sendToNotificationSystem(entry: LogEntry): Promise<void> {
        try {
            // This would integrate with the actual notification system
            // For now, we'll use the base logger to indicate this would happen
            baseLogger.debug('Would send critical notification:', entry);
            return Promise.resolve();
        }
        catch (error: unknown) {const errorMessage = error instanceof Error ? error.message : String(error);
// Don't fail if notification system is unavailable
            baseLogger.error('Failed to send notification:', errorMessage);
            return Promise.resolve();
        }
    }
    // Create the unified logger instance
    const logger = ((message: string, error?: unknown) => {
        internalLog(EventLevel.INFO, message, error);
    }) as UnifiedLogger;
    // Implement all StandardLogger methods
    logger.debug = (message: string, error?: unknown) => {
        internalLog(EventLevel.DEBUG, message, error);
    };
    logger.info = (message: string, error?: unknown) => {
        internalLog(EventLevel.INFO, message, error);
    };
    logger.warn = (message: string, error?: unknown) => {
        internalLog(EventLevel.WARNING, message, error);
    };
    logger.error = (message: string, error?: unknown) => {
        internalLog(EventLevel.ERROR, message, error);
    };
    // Add UnifiedLogger specific methods
    logger.log = (level: EventLevel, message: string, error?: unknown) => {
        internalLog(level, message, error);
    };
    logger.critical = (message: string, error?: unknown) => {
        internalLog(EventLevel.CRITICAL, message, error);
    };
    logger.setMinLevel = (level: EventLevel) => {
        currentMinLevel = level;
    };
    logger.getConfig = () => ({
        minLevel: currentMinLevel,
        enableConsole,
        enableEvents,
        enableNotifications,
        source,
        metadata,
    });
    logger.child = (context: Record<string, unknown>) => {
        return createUnifiedLogger({
            ...config,
            metadata: { ...metadata, ...context },
        }, baseLogger);
    };
    logger.logEvent = (type: EventType, message: string, eventMetadata?: Record<string, unknown>) => {
        // Determine the appropriate log level based on event type
        const level = getEventLevel(type);
        // Log with combined metadata
        const combinedMetadata = {
            ...metadata,
            ...eventMetadata,
            eventType: type,
        };
        internalLog(level, message, undefined);
        // Send directly to event system
        if (enableEvents) {
            void sendToEventSystem({
                level,
                message,
                timestamp: new Date(),
                source,
                metadata: combinedMetadata,
            });
        }
    };
    return logger;
}
/**
 * Get appropriate log level for an event type
 */
function getEventLevel(type: EventType): EventLevel {
    return EventTypeToLevel[type];
}
/**
 * Default unified logger instance
 */
export const unifiedLogger = createUnifiedLogger();
/**
 * Create specialized loggers for different sources
 */
export const systemLogger = createUnifiedLogger({ source: EventSource.SYSTEM });
export const authLogger = createUnifiedLogger({ source: EventSource.USER });
export const databaseLogger = createUnifiedLogger({ source: EventSource.DATABASE });
export const metadataLogger = createUnifiedLogger({ source: EventSource.METADATA });
export const integrationLogger = createUnifiedLogger({ source: EventSource.ANILIST }); // Generic integration logger
export const taskLogger = createUnifiedLogger({ source: EventSource.TASK });
export const downloadLogger = createUnifiedLogger({ source: EventSource.DOWNLOAD });
/**
 * Logger factory for creating source-specific loggers
 */
export function createSourceLogger(source: EventSource, config?: Partial<UnifiedLoggerConfig>): UnifiedLogger {
    return createUnifiedLogger({
        ...config,
        source,
    });
}
/**
 * Global logger configuration
 */
export class LoggerConfiguration {
    private static instance: LoggerConfiguration | undefined;
    private globalConfig: UnifiedLoggerConfig = {
        minLevel: EventLevel.INFO,
        enableConsole: true,
        enableEvents: true,
        enableNotifications: true,
    };
    private constructor() { }
    static getInstance(): LoggerConfiguration {
        LoggerConfiguration.instance ??= new LoggerConfiguration();
        return LoggerConfiguration.instance;
    }
    setGlobalConfig(config: Partial<UnifiedLoggerConfig>): void {
        this.globalConfig = { ...this.globalConfig, ...config };
    }
    getGlobalConfig(): UnifiedLoggerConfig {
        return { ...this.globalConfig };
    }
    setGlobalMinLevel(level: EventLevel): void {
        this.globalConfig.minLevel = level;
    }
}
export default unifiedLogger;
