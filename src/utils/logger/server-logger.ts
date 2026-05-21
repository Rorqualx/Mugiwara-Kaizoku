/**
 * Server Logger Implementation
 *
 * Server-side logger that writes to console in development
 * and to files in production. Supports structured logging.
 */
import * as fs from 'fs';
import * as path from 'path';

import { Logger } from './base-logger';

import type { LogEntry, LoggerConfig } from './types';
export class ServerLogger extends Logger {
    private logDir: string;
    private useColors: boolean;
    constructor(config?: LoggerConfig) {
        super(config);
        this.logDir = process.env["LOG_DIR"] ?? path.join(process.cwd(), 'logs');
        this.useColors = process.env.NODE_ENV !== 'production' && process.stdout.isTTY;
        this.ensureLogDir();
    }
    protected writeLog(entry: LogEntry): void {
        // Console output in development
        if (process.env.NODE_ENV !== 'production') {
            this.writeToConsole(entry);
        }
        // Always write to file (non-blocking)
        this.writeToFile(entry).catch(err => {
            // Use console.error as fallback
            console.error('Failed to write log to file:', err);
        });
    }
    /**
     * Write log entry to console with formatting
     */
    private writeToConsole(entry: LogEntry): void {
        const color = this.getColorForLevel(entry.level);
        const reset = '\x1b[0m';
        const timestamp = entry.timestamp.toISOString();
        const level = entry.level.toUpperCase().padEnd(5);
        // Format the main message
        const prefix = this.useColors
            ? `${color}[${timestamp}] [${level}]${reset}`
            : `[${timestamp}] [${level}]`;

        // Use appropriate console method based on log level (ESLint allows only warn/error)
        const message = `${prefix} ${entry.message}`;
        if (entry.level === 'warn') {
            console.warn(message);
        } else {
            // Use console.error for error/fatal, and also for debug/info to comply with ESLint
            console.error(message);
        }

        // Log context if present
        if (entry.context && Object.keys(entry.context).length > 0) {
            const contextStr = JSON.stringify(entry.context, null, 2);
            console.error(`  Context: ${contextStr}`);
        }
        // Log error details if present
        if (entry.error) {
            if (this.useColors) {
                console.error('\x1b[31m  Error Details:\x1b[0m');
            }
            else {
                console.error('  Error Details:');
            }
            if (entry.error["id"])
                console.error(`    ID: ${entry.error["id"]}`);
            console.error(`    Name: ${entry.error instanceof Error ? entry.error.name : 'Error'}`);
            console.error(`    Message: ${entry.error instanceof Error ? entry.error.message : String(entry.error)}`);

            // Print error code if it exists
            if (typeof entry.error === 'object' && 'code' in entry.error) {
                console.error(`    Code: ${(entry.error as Record<string, unknown>)['code']}`);
            }

            // Print stack trace if available
            if (entry.error instanceof Error && entry.error.stack) {
                console.error('    Stack:');
                entry.error.stack.split('\n').forEach(line => {
                    console.error(`      ${line}`);
                });
            }
        }
    }
    /**
     * Write log entry to file
     */
    private async writeToFile(entry: LogEntry): Promise<void> {
        const date = new Date().toISOString().split('T')[0];
        const filename = `${entry.level}-${date}.log`;
        const filepath = path.join(this.logDir, filename);
        // Create JSON line for structured logging
        const line = JSON.stringify({
            ...entry,
            timestamp: entry.timestamp.toISOString()
        }) + '\n';
        // Append to file
        await fs.promises.appendFile(filepath, line, 'utf-8');
        // Also write to combined log
        const combinedPath = path.join(this.logDir, `combined-${date}.log`);
        await fs.promises.appendFile(combinedPath, line, 'utf-8');
    }
    /**
     * Get ANSI color code for log level
     */
    private getColorForLevel(level: string): string {
        const colors: Record<string, string> = {
            debug: '\x1b[36m', // Cyan
            info: '\x1b[32m', // Green
            warn: '\x1b[33m', // Yellow
            error: '\x1b[31m', // Red
            fatal: '\x1b[35m' // Magenta
        };
        return colors[level] ?? '\x1b[0m';
    }
    /**
     * Ensure log directory exists
     */
    private ensureLogDir(): void {
        try {
            fs.mkdirSync(this.logDir, { recursive: true });
        }
        catch (error: unknown) {
            console.error('Failed to create log directory:', error);
        }
    }
}
