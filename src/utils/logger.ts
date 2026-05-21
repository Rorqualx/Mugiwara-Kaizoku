// Remove circular import - logger is defined below

/**
 * Logger Utility
 *
 * Simple logger wrapper for consistent logging across the application.
 * Can be extended to integrate with external logging services.
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export interface LogContext {
  [key: string]: unknown;
}
class Logger {
  private context: LogContext = {};
  constructor(private name: string) {}
  private formatMessage(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const replacer = (_key: string, value: unknown): unknown =>
      typeof value === 'bigint' ? value.toString() : value;
    const contextStr = context
      ? ` ${JSON.stringify({ ...this.context, ...context }, replacer)}`
      : '';
    return `[${timestamp}] [${level.toUpperCase()}] [${this["name"]}] ${message}${contextStr}`;
  }
  private log(level: LogLevel, message: string, context?: LogContext): void {
    // Skip debug and info logs in production unless explicitly enabled
    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
      if (level === 'debug' || level === 'info') {
        return;
      }
    }

    // Skip verbose logging unless explicitly enabled via environment variable
    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
      if ((level === 'debug' || level === 'info') && process.env["DEBUG_LOGGING"] !== 'true') {
        // Only log important messages in development by default
        return;
      }
    }

    const formattedMessage = this.formatMessage(level, message, context);
    switch (level) {
      case 'debug': {
        console.debug(formattedMessage); // eslint-disable-line no-console
        break;
      }
      case 'info': {
        console.info(formattedMessage); // eslint-disable-line no-console
        break;
      }
      case 'warn': {
        console.warn(formattedMessage);
        break;
      }
      case 'error': {
        console.error(formattedMessage);
        break;
      }
      default: {
        // Unknown log level — default fallback
        console.log(formattedMessage); // eslint-disable-line no-console
        break;
      }
    }
  }
  private normalizeContext(value?: unknown): LogContext | undefined {
    if (!value) return undefined;
    if (typeof value === 'object' && !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype) {
      return value as LogContext;
    }
    return { data: value };
  }
  debug(message: string, context?: unknown): void {
    this.log('debug', message, this.normalizeContext(context));
  }
  info(message: string, context?: unknown): void {
    this.log('info', message, this.normalizeContext(context));
  }
  warn(message: string, context?: unknown): void {
    this.log('warn', message, this.normalizeContext(context));
  }
  error(message: string, error?: Error | unknown, context?: unknown): void {
    let errorMessage = message;
    let errorContext = this.normalizeContext(context) ?? {};
    if (error instanceof Error) {
      errorMessage = `${message}: ${error.message}`;
      errorContext = {
        ...errorContext,
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack
        }
      };
    } else if (error) {
      errorMessage = `${message}: ${String(error)}`;
      errorContext = {
        ...errorContext,
        error: String(error)
      };
    }
    this.log('error', errorMessage, errorContext);
  }
  setContext(context: LogContext): void {
    this.context = { ...this.context, ...context };
  }
  child(name: string, context?: LogContext): Logger {
    const childLogger = new Logger(`${this["name"]}:${name}`);
    childLogger.setContext({ ...this.context, ...context });
    return childLogger;
  }
}
// Factory function to create logger instances
export function createLogger(name: string, context?: LogContext): Logger {
  const logger = new Logger(name);
  if (context) {
    logger.setContext(context);
  }
  return logger;
}
// Default logger instance
export const logger = createLogger('app');

// Export additional utilities for backward compatibility
export function getLogger(name: string): Logger {
  return createLogger(name);
}

export function createChildLogger(parentName: string, childName: string, context?: LogContext): Logger {
  return createLogger(`${parentName}:${childName}`, context);
}