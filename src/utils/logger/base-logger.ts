/**
 * Base Logger Implementation
 * 
 * Abstract logger class that provides core logging functionality.
 * Specific implementations (server/browser) extend this class.
 */

import { BaseError } from '../errors/base-error';

import type { LogLevel, LogEntry, LoggerConfig } from './types';

export abstract class Logger {
  protected context: Record<string, unknown> = {};
  protected config: LoggerConfig;
  
  constructor(config?: LoggerConfig) {
    this.config = config ?? {};
    this.context = config?.context ?? {};
  }
  
  /**
   * Create child logger with additional context
   */
  child(context: Record<string, unknown>): Logger {
    const ChildClass = this.constructor as new (config?: LoggerConfig) => Logger;
    return new ChildClass({
      ...this.config,
      context: { ...this.context, ...context }
    });
  }
  
  /**
   * Log debug message
   */
  debug(message: string, meta?: unknown): void {
    if (!this.shouldLog('debug')) return;
    const normalizedMeta = this.normalizeMeta(meta);
    this.log('debug', message, normalizedMeta);
  }
  
  /**
   * Log info message
   */
  info(message: string, meta?: unknown): void {
    if (!this.shouldLog('info')) return;
    const normalizedMeta = this.normalizeMeta(meta);
    this.log('info', message, normalizedMeta);
  }
  
  /**
   * Log warning message
   */
  warn(message: string, meta?: unknown): void {
    if (!this.shouldLog('warn')) return;
    const normalizedMeta = this.normalizeMeta(meta);
    this.log('warn', message, normalizedMeta);
  }
  
  /**
   * Log error message
   */
  error(message: string, error?: unknown, meta?: unknown): void {
    if (!this.shouldLog('error')) return;
    const normalizedMeta = this.normalizeMeta(meta);
    const errorData = this.extractErrorData(error);
    this.log('error', message, { ...normalizedMeta, ...errorData });
  }
  
  /**
   * Log fatal error
   */
  fatal(message: string, error?: unknown, meta?: unknown): void {
    if (!this.shouldLog('fatal')) return;
    const normalizedMeta = this.normalizeMeta(meta);
    const errorData = this.extractErrorData(error);
    this.log('fatal', message, { ...normalizedMeta, ...errorData });
  }
  
  /**
   * Main logging method
   */
  private log(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date(),
      context: { ...this.context, ...meta }
    };
    
    // Extract error from meta if present
    if (meta?.["error"]) {
      entry.error = meta["error"] as Error;
      // Remove error from context to avoid duplication
      if (entry.context) {
        delete entry.context["error"];
      }
    }
    
    this.writeLog(entry);
  }
  
  /**
   * Normalize metadata to proper format
   */
  private normalizeMeta(meta: unknown): Record<string, unknown> | undefined {
    if (!meta) return undefined;
    
    // If it's already a plain object, return it
    if (typeof meta === 'object' && !Array.isArray(meta) &&
        Object.getPrototypeOf(meta) === Object.prototype) {
      return meta as Record<string, unknown>;
    }
    
    // Otherwise wrap it in an object
    return { data: meta };
  }
  
  /**
   * Extract error information safely
   */
  private extractErrorData(error: unknown): Record<string, unknown> {
    if (!error) return {};
    
    if (error instanceof BaseError) {
      return {
        error: {
          id: error["id"],
          name: (error instanceof Error ? error["name"] : String(error)),
          message: (error instanceof Error ? error.message : String(error)),
          code: error.code,
          stack: (error instanceof Error ? error.stack : String(error)),
          cause: error.cause,
          context: error.context
        }
      };
    }
    
    if (error instanceof Error) {
      return {
        error: {
          name: (error instanceof Error ? error["name"] : String(error)),
          message: (error instanceof Error ? error.message : String(error)),
          stack: (error instanceof Error ? error.stack : String(error))
        }
      };
    }
    
    return {
      error: {
        name: 'UnknownError',
        message: String(error)
      }
    };
  }
  
  /**
   * Check if should log based on level
   */
  private shouldLog(level: LogLevel): boolean {
    if (this.config.silent) return false;
    
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error', 'fatal'];
    const configLevel = this.config.level || (process.env.NODE_ENV === 'production' ? 'info' : 'debug');
    const configIndex = levels.indexOf(configLevel);
    const levelIndex = levels.indexOf(level);
    
    return levelIndex >= configIndex;
  }
  
  /**
   * Abstract method to be implemented by specific loggers
   */
  protected abstract writeLog(entry: LogEntry): void;
}