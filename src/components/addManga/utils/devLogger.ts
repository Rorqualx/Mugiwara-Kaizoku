/**
 * Development Logging Utilities for AddManga Components
 * Provides enhanced logging and debugging capabilities in development mode
 */
// ============================================
// Configuration
// ============================================
interface LoggerConfig {
    enabled: boolean;
    logLevel: 'debug' | 'info' | 'warn' | 'error';
    showTimestamp: boolean;
    showComponent: boolean;
    groupRelatedLogs: boolean;
    persistLogs: boolean;
}
const defaultConfig: LoggerConfig = {
    enabled: process.env.NODE_ENV === 'development',
    logLevel: 'debug',
    showTimestamp: true,
    showComponent: true,
    groupRelatedLogs: true,
    persistLogs: false,
};
// Global config that can be modified at runtime
let globalConfig = { ...defaultConfig };
// ============================================
// Logger Class
// ============================================
class DevLogger {
    private component: string;
    private config: LoggerConfig;
    private logHistory: unknown[] = [];
    private groupStack: string[] = [];
    constructor(component: string, config?: Partial<LoggerConfig>) {
        this.component = component;
        this.config = { ...globalConfig, ...config };
    }
    // Logging methods
    debug(...args: unknown[]): void {
        this.log('debug', args);
    }
    info(...args: unknown[]): void {
        this.log('info', args);
    }
    warn(...args: unknown[]): void {
        this.log('warn', args);
    }
    error(...args: unknown[]): void {
        this.log('error', args);
    }
    // Core logging
    private log(level: keyof typeof console, args: unknown[]): void {
        if (!this.config.enabled)
            return;
        const levels = ['debug', 'info', 'warn', 'error'];
        const currentLevelIndex = levels.indexOf(this.config.logLevel);
        const messageLevelIndex = typeof level === 'string' ? levels.indexOf(level) : -1;
        if (messageLevelIndex < currentLevelIndex)
            return;
        const prefix = typeof level === 'string' ? this.buildPrefix(level) : '';
        const message = [...(prefix ? [prefix] : []), ...args];
        // Store in history if persistence is enabled
        if (this.config.persistLogs) {
            this.logHistory.push({
                timestamp: new Date(),
                level,
                component: this.component,
                message: args,
            });
        }
        // Output to console
        // eslint-disable-next-line no-console -- Development logger needs console access
        const consoleMethod = console[level as keyof Console] as (...args: unknown[]) => void;
        if (typeof consoleMethod === 'function') {
            consoleMethod(...message);
        }
    }
    private buildPrefix(level: string): string {
        const parts: string[] = [];
        if (this.config.showTimestamp) {
            parts.push(`[${new Date().toLocaleTimeString()}]`);
        }
        if (this.config.showComponent) {
            parts.push(`[${this.component}]`);
        }
        // Add color coding for levels
        const levelColors: Record<string, string> = {
            debug: '🔍',
            info: 'ℹ️',
            warn: '⚠️',
            error: '❌',
        };
        parts.push(levelColors[level] ?? '');
        return parts.join(' ');
    }
    // Group logging
    group(label: string): void {
        if (!this.config.enabled || !this.config.groupRelatedLogs)
            return;
        // console.group is allowed for development logging
        // eslint-disable-next-line no-console -- Development logger needs console access
        console.group(`${this.buildPrefix('info')} ${label}`);
        this.groupStack.push(label);
    }
    groupEnd(): void {
        if (!this.config.enabled || !this.config.groupRelatedLogs)
            return;
        // console.groupEnd is allowed for development logging
        // eslint-disable-next-line no-console -- Development logger needs console access
        console.groupEnd();
        this.groupStack.pop();
    }
    // Table logging
    table(data: unknown, columns?: string[]): void {
        if (!this.config.enabled)
            return;
        // console.table is allowed for development logging
        // eslint-disable-next-line no-console -- Development logger needs console access
        console.table(data, columns);
    }
    // Performance timing
    time(label: string): void {
        if (!this.config.enabled)
            return;
        // console.time is allowed for development logging
        // eslint-disable-next-line no-console -- Development logger needs console access
        console.time(`${this.component}:${label}`);
    }
    timeEnd(label: string): void {
        if (!this.config.enabled)
            return;
        // console.timeEnd is allowed for development logging
        // eslint-disable-next-line no-console -- Development logger needs console access
        console.timeEnd(`${this.component}:${label}`);
    }
    // Type checking logs
    logType(variable: unknown, name: string): void {
        if (!this.config.enabled)
            return;
        const type = typeof variable;
        const isArray = Array.isArray(variable);
        const isNull = variable === null;
        const isUndefined = variable === undefined;
        this.debug(`Type of ${name}:`, {
            type,
            isArray,
            isNull,
            isUndefined,
            constructor: variable?.constructor?.name,
            value: variable,
        });
    }
    // Property access logging
    logPropertyAccess(obj: unknown, property: string, found: boolean): void {
        if (!this.config.enabled)
            return;
        const value = (obj as Record<string, unknown>)[property];
        const availableProps = obj ? Object.keys(obj) : [];
        if (!found) {
            this.warn(`Property '${property}' not found`, {
                availableProperties: availableProps,
                attemptedAccess: property,
                objectType: typeof obj,
            });
        }
        else {
            this.debug(`Property '${property}' accessed`, {
                value,
                type: typeof value,
            });
        }
    }
    // API call logging
    logApiCall(method: string, endpoint: string, params?: unknown): void {
        if (!this.config.enabled)
            return;
        this.group(`API Call: ${method} ${endpoint}`);
        this.info('Parameters:', params);
        this.groupEnd();
    }
    logApiResponse(endpoint: string, response: unknown, duration?: number): void {
        if (!this.config.enabled)
            return;
        this.group(`API Response: ${endpoint}`);
        this.info('Response:', response);
        if (duration) {
            this.info(`Duration: ${duration}ms`);
        }
        this.groupEnd();
    }
    // State change logging
    logStateChange(stateName: string, prevValue: unknown, nextValue: unknown): void {
        if (!this.config.enabled)
            return;
        this.group(`State Change: ${stateName}`);
        this.info('Previous:', prevValue);
        this.info('Next:', nextValue);
        this.info('Changed:', this.getDiff(prevValue, nextValue));
        this.groupEnd();
    }
    private getDiff(prev: unknown, next: unknown): Record<string, unknown> | string {
        if (typeof prev !== 'object' || typeof next !== 'object') {
            return prev !== next ? { from: prev, to: next } : 'No change';
        }
        const diff: Record<string, unknown> = {};
        const prevObj = prev as Record<string, unknown> | null;
        const nextObj = next as Record<string, unknown> | null;
        const allKeys = new Set([...Object.keys(prevObj ?? {}), ...Object.keys(nextObj ?? {})]);
        for (const key of allKeys) {
            if (prevObj?.[key] !== nextObj?.[key]) {
                diff[key] = { from: prevObj?.[key], to: nextObj?.[key] };
            }
        }
        return Object.keys(diff).length > 0 ? diff : 'No change';
    }
    // Get log history
    getHistory(): unknown[] {
        return this.logHistory;
    }
    clearHistory(): void {
        this.logHistory = [];
    }
    // Export logs
    exportLogs(): string {
        return JSON.stringify(this.logHistory, null, 2);
    }
}
// ============================================
// Factory Functions
// ============================================
/**
 * Creates a logger for a specific component
 */
export function createLogger(component: string, config?: Partial<LoggerConfig>): DevLogger {
    return new DevLogger(component, config);
}
/**
 * Creates a conditional logger that only logs when a condition is met
 */
export function createConditionalLogger(component: string, condition: () => boolean): DevLogger {
    return new DevLogger(component, {
        enabled: globalConfig.enabled && condition(),
    });
}
// ============================================
// Global Logger Management
// ============================================
/**
 * Updates global logger configuration
 */
export function configureLogger(config: Partial<LoggerConfig>): void {
    globalConfig = { ...globalConfig, ...config };
}
/**
 * Enables/disables all loggers
 */
export function setLoggingEnabled(enabled: boolean): void {
    globalConfig.enabled = enabled;
}
/**
 * Sets global log level
 */
export function setLogLevel(level: LoggerConfig['logLevel']): void {
    globalConfig.logLevel = level;
}
// ============================================
// Specialized Loggers
// ============================================
/**
 * Logger for validation operations
 */
class ValidationLogger extends DevLogger {
    constructor(component: string) {
        super(`Validation:${component}`);
    }
    logValidation(field: string, value: unknown, isValid: boolean, errors?: string[]): void {
        this.group(`Validating ${field}`);
        this.info('Value:', value);
        this.info('Valid:', isValid);
        if (errors && errors.length > 0) {
            this.warn('Errors:', errors);
        }
        this.groupEnd();
    }
    logTransformation(field: string, input: unknown, output: unknown): void {
        this.group(`Transforming ${field}`);
        this.info('Input:', input);
        this.info('Output:', output);
        this.info('Type change:', `${typeof input} → ${typeof output}`);
        this.groupEnd();
    }
}
/**
 * Logger for performance monitoring
 */
class PerformanceLogger extends DevLogger {
    private marks: Map<string, number> = new Map();
    constructor(component: string) {
        super(`Performance:${component}`);
    }
    mark(label: string): void {
        const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
        this.marks.set(label, now);
        this.debug(`Mark: ${label}`);
    }
    measure(label: string, startMark: string, endMark?: string): void {
        const start = this.marks.get(startMark);
        const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
        const end = endMark ? this.marks.get(endMark) : now;
        if (start && end) {
            const duration = end - start;
            this.info(`${label}: ${duration.toFixed(2)}ms`);
            // Warn if operation is slow
            if (duration > 1000) {
                this.warn(`Slow operation detected: ${label} took ${duration.toFixed(2)}ms`);
            }
        }
    }
    profile<T>(label: string, fn: () => T): T {
        const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
        const start = now;
        try {
            const result = fn();
            const now2 = typeof performance !== 'undefined' ? performance.now() : Date.now();
            const duration = now2 - start;
            this.info(`${label}: ${duration.toFixed(2)}ms`);
            return result;
        }
        catch (error: unknown) {
            const now3 = typeof performance !== 'undefined' ? performance.now() : Date.now();
            const duration = now3 - start;
            this.error(`${label} failed after ${duration.toFixed(2)}ms:`, error);
            throw error;
        }
    }
}
// ============================================
// React DevTools Integration
// ============================================
/**
 * Hook for component logging
 */
export function useDevLogger(component: string): DevLogger {
    return React.useMemo(() => createLogger(component), [component]);
}
/**
 * Hook for validation logging
 */
export function useValidationLogger(component: string): ValidationLogger {
    return React.useMemo(() => new ValidationLogger(component), [component]);
}
/**
 * Hook for performance logging
 */
export function usePerformanceLogger(component: string): PerformanceLogger {
    return React.useMemo(() => new PerformanceLogger(component), [component]);
}
// ============================================
// Browser Console Enhancements
// ============================================
// Add global debug utilities in development
 
if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
    const win = window as unknown as Record<string, unknown>;
    win['__MANGA_DEBUG__'] = {
        enableLogging: () => setLoggingEnabled(true),
        disableLogging: () => setLoggingEnabled(false),
        setLogLevel,
        configureLogger,
        exportLogs: () => {
            const logs = (typeof win['__MANGA_LOGS__'] !== 'undefined' ? win['__MANGA_LOGS__'] : []) as unknown[];
            return JSON.stringify(logs, null, 2);
        },
    };
    logger.info('%c🔧 AddManga Debug Tools Available', 'color: #4CAF50; font-weight: bold; font-size: 14px;');
    logger.info('Use window.__MANGA_DEBUG__ to access debug utilities');
}
// ============================================
// Exports
// ============================================
export { DevLogger, ValidationLogger, PerformanceLogger };
// Re-export React for the hooks
import React from 'react';

import { logger } from '@/utils/logger';
