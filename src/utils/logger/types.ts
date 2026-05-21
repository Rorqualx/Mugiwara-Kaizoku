/**
 * Logger Type Definitions
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: Date;
  context?: Record<string, unknown>;
  error?: {
    id?: string;
    name: string;
    message: string;
    code?: string;
    stack?: string;
    cause?: unknown;
  };
}

export interface LoggerConfig {
  level?: LogLevel;
  context?: Record<string, unknown>;
  silent?: boolean;
}

export interface LogContext {
  [key: string]: unknown;
}