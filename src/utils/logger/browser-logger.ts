/**
 * Browser Logger Implementation
 *
 * Browser-side logger that uses console in development
 * and sends logs to server endpoint in production.
 */
import { getErrorMessage } from '@/utils/errors/helpers';

import { Logger } from './base-logger';

import type { LogEntry, LoggerConfig } from './types';
export class BrowserLogger extends Logger {
    private buffer: LogEntry[] = [];
    private flushTimer: NodeJS.Timeout | null = null;
    constructor(config?: LoggerConfig) {
        super(config);
        // Set up periodic flush in production
        if (process.env.NODE_ENV === 'production') {
            this.startPeriodicFlush();
        }
    }
    protected writeLog(entry: LogEntry): void {
        // Always use console in development
        if (process.env.NODE_ENV !== 'production') {
            this.writeToConsole(entry);
            return;
        }
        // In production, buffer logs and send to server
        this.buffer.push(entry);
        // Flush immediately for errors and fatal
        if (entry.level === 'error' || entry.level === 'fatal') {
            void this.flush();
        }
        else if (this.buffer.length >= 10) {
            // Flush when buffer is full
            void this.flush();
        }
    }
    /**
     * Write log entry to browser console
     */
    private writeToConsole(entry: LogEntry): void {
        const timestamp = entry.timestamp.toTimeString().split(' ')[0];
        const prefix = `[${timestamp}] [${entry.level.toUpperCase()}]`;
        const message = `%c${prefix}%c ${entry.message}`;
        const style1 = this.getLevelStyle(entry.level);
        const style2 = 'color: inherit';

        // Log main message with appropriate console method
        if (entry.level === 'error' || entry.level === 'fatal') {
            console.error(message, style1, style2);
        } else {
            console.warn(message, style1, style2);
        }

        // Log context if present
        if (entry.context && Object.keys(entry.context).length > 0) {
            console.warn('Context:', entry.context);
        }
        // Log error if present
        if (entry.error) {
            console.error('Error Details:', entry.error);
        }
    }
    /**
     * Get CSS style for log level
     */
    private getLevelStyle(level: string): string {
        const styles: Record<string, string> = {
            debug: 'color: #6B7280; font-weight: normal',
            info: 'color: #10B981; font-weight: normal',
            warn: 'color: #F59E0B; font-weight: bold',
            error: 'color: #EF4444; font-weight: bold',
            fatal: 'color: #8B5CF6; font-weight: bold; text-decoration: underline'
        };
        return styles[level] || 'color: inherit';
    }
    /**
     * Send buffered logs to server
     */
    private async flush(): Promise<void> {
        if (this.buffer.length === 0)
            return;
        const logs = [...this.buffer];
        this.buffer = [];
        try {
            await fetch('/api/logs', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    logs: logs.map(entry => ({
                        ...entry,
                        timestamp: entry.timestamp.toISOString()
                    }))
                })
            });
        }
        catch (error: unknown) {
            const errorMessage = getErrorMessage(error);
            console.error('Failed to send logs to server:', errorMessage);
            // Re-add logs to buffer for retry
            this.buffer.unshift(...logs);
        }
    }
    /**
     * Start periodic flush timer
     */
    private startPeriodicFlush(): void {
        // Flush every 30 seconds
        this.flushTimer = setInterval(() => {
            void this.flush();
        }, 30000);
        // Flush on page unload
        if (typeof window !== 'undefined') {
            window.addEventListener('beforeunload', () => {
                void this.flush();
            });
        }
    }
    /**
     * Clean up resources
     */
    dispose(): void {
        if (this.flushTimer) {
            clearInterval(this.flushTimer);
            this.flushTimer = null;
        }
        void this.flush();
    }
}
