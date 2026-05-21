# Error Handling Implementation Plan

## Phase 1: Core Infrastructure (Week 1)

### 1.1 Create Base Error System
```typescript
// src/utils/errors/base-error.ts
export interface ErrorContext {
  userId?: string;
  requestId?: string;
  operation?: string;
  metadata?: Record<string, unknown>;
}

export abstract class BaseError extends Error {
  public readonly timestamp: Date;
  public readonly id: string;
  
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500,
    public readonly context?: ErrorContext,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = this.constructor.name;
    this.timestamp = new Date();
    this.id = this.generateErrorId();
    
    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
  
  private generateErrorId(): string {
    return `${this.name}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      timestamp: this.timestamp,
      context: this.context,
      stack: this.stack,
      cause: this.cause
    };
  }
}
```

### 1.2 Domain-Specific Errors
```typescript
// src/utils/errors/domain-errors.ts
import { BaseError } from './base-error';

export class ValidationError extends BaseError {
  constructor(message: string, context?: ErrorContext, cause?: Error) {
    super(message, 'VALIDATION_ERROR', 400, context, cause);
  }
}

export class NotFoundError extends BaseError {
  constructor(resource: string, id: string | number, context?: ErrorContext) {
    super(
      `${resource} with id ${id} not found`,
      'NOT_FOUND',
      404,
      { ...context, resource, resourceId: String(id) }
    );
  }
}

export class AuthenticationError extends BaseError {
  constructor(message: string = 'Authentication required', context?: ErrorContext) {
    super(message, 'AUTHENTICATION_ERROR', 401, context);
  }
}

export class AuthorizationError extends BaseError {
  constructor(message: string = 'Insufficient permissions', context?: ErrorContext) {
    super(message, 'AUTHORIZATION_ERROR', 403, context);
  }
}

export class DatabaseError extends BaseError {
  constructor(message: string, operation: string, context?: ErrorContext, cause?: Error) {
    super(
      message,
      'DATABASE_ERROR',
      500,
      { ...context, operation },
      cause
    );
  }
}

export class ExternalApiError extends BaseError {
  constructor(
    service: string,
    message: string,
    statusCode?: number,
    context?: ErrorContext,
    cause?: Error
  ) {
    super(
      `${service}: ${message}`,
      'EXTERNAL_API_ERROR',
      statusCode || 502,
      { ...context, service },
      cause
    );
  }
}

export class QueueError extends BaseError {
  constructor(
    taskType: string,
    message: string,
    context?: ErrorContext,
    cause?: Error
  ) {
    super(
      message,
      'QUEUE_ERROR',
      500,
      { ...context, taskType },
      cause
    );
  }
}
```

### 1.3 New Logging System
```typescript
// src/utils/logger/logger.ts
import { BaseError } from '../errors/base-error';

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

export abstract class Logger {
  protected context: Record<string, unknown> = {};
  
  constructor(context?: Record<string, unknown>) {
    this.context = context || {};
  }
  
  // Create child logger with additional context
  child(context: Record<string, unknown>): Logger {
    const ChildClass = this.constructor as typeof Logger;
    return new (ChildClass as any)({ ...this.context, ...context });
  }
  
  // Logging methods
  debug(message: string, meta?: Record<string, unknown>): void {
    this.log('debug', message, meta);
  }
  
  info(message: string, meta?: Record<string, unknown>): void {
    this.log('info', message, meta);
  }
  
  warn(message: string, meta?: Record<string, unknown>): void {
    this.log('warn', message, meta);
  }
  
  error(message: string, error?: unknown, meta?: Record<string, unknown>): void {
    const errorData = this.extractErrorData(error);
    this.log('error', message, { ...meta, error: errorData });
  }
  
  fatal(message: string, error?: unknown, meta?: Record<string, unknown>): void {
    const errorData = this.extractErrorData(error);
    this.log('fatal', message, { ...meta, error: errorData });
  }
  
  // Main logging method
  private log(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date(),
      context: { ...this.context, ...meta }
    };
    
    if (meta?.error) {
      entry.error = meta.error as any;
    }
    
    this.writeLog(entry);
  }
  
  // Extract error information safely
  private extractErrorData(error: unknown): LogEntry['error'] | undefined {
    if (!error) return undefined;
    
    if (error instanceof BaseError) {
      return {
        id: error.id,
        name: error.name,
        message: error.message,
        code: error.code,
        stack: error.stack,
        cause: error.cause
      };
    }
    
    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
        stack: error.stack
      };
    }
    
    return {
      name: 'UnknownError',
      message: String(error)
    };
  }
  
  // Abstract method to be implemented by specific loggers
  protected abstract writeLog(entry: LogEntry): void;
}
```

### 1.4 Environment-Specific Implementations
```typescript
// src/utils/logger/server-logger.ts
import { Logger, LogEntry } from './logger';
import fs from 'fs/promises';
import path from 'path';

export class ServerLogger extends Logger {
  private logDir: string;
  
  constructor(context?: Record<string, unknown>) {
    super(context);
    this.logDir = process.env.LOG_DIR || './logs';
    this.ensureLogDir();
  }
  
  protected async writeLog(entry: LogEntry): Promise<void> {
    // Console output in development
    if (process.env.NODE_ENV === 'development') {
      this.writeToConsole(entry);
    }
    
    // Always write to file
    await this.writeToFile(entry);
    
    // Send to monitoring in production
    if (process.env.NODE_ENV === 'production') {
      await this.sendToMonitoring(entry);
    }
  }
  
  private writeToConsole(entry: LogEntry): void {
    const color = this.getColorForLevel(entry.level);
    const prefix = `[${entry.timestamp.toISOString()}] [${entry.level.toUpperCase()}]`;
    
    console.log(color, prefix, entry.message);
    
    if (entry.context && Object.keys(entry.context).length > 0) {
      console.log('Context:', entry.context);
    }
    
    if (entry.error) {
      console.error('Error:', entry.error);
    }
  }
  
  private async writeToFile(entry: LogEntry): Promise<void> {
    const filename = `${entry.level}-${new Date().toISOString().split('T')[0]}.log`;
    const filepath = path.join(this.logDir, filename);
    const line = JSON.stringify(entry) + '\n';
    
    await fs.appendFile(filepath, line).catch(err => {
      console.error('Failed to write log:', err);
    });
  }
  
  private async sendToMonitoring(entry: LogEntry): Promise<void> {
    // Implement integration with monitoring service
    // e.g., Sentry, DataDog, CloudWatch
  }
  
  private getColorForLevel(level: string): string {
    const colors = {
      debug: '\x1b[36m',  // Cyan
      info: '\x1b[32m',   // Green
      warn: '\x1b[33m',   // Yellow
      error: '\x1b[31m',  // Red
      fatal: '\x1b[35m'   // Magenta
    };
    return colors[level] || '\x1b[0m';
  }
  
  private async ensureLogDir(): Promise<void> {
    await fs.mkdir(this.logDir, { recursive: true }).catch(() => {});
  }
}

// src/utils/logger/browser-logger.ts
import { Logger, LogEntry } from './logger';

export class BrowserLogger extends Logger {
  protected writeLog(entry: LogEntry): void {
    // Development: use console
    if (process.env.NODE_ENV === 'development') {
      const method = entry.level === 'error' || entry.level === 'fatal' 
        ? 'error' 
        : entry.level === 'warn' 
        ? 'warn' 
        : 'log';
      
      console[method](`[${entry.level.toUpperCase()}]`, entry.message, entry.context);
      
      if (entry.error) {
        console.error(entry.error);
      }
    }
    
    // Production: send to monitoring endpoint
    if (process.env.NODE_ENV === 'production') {
      this.sendToEndpoint(entry);
    }
  }
  
  private async sendToEndpoint(entry: LogEntry): Promise<void> {
    try {
      await fetch('/api/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry)
      });
    } catch {
      // Silently fail to avoid infinite loop
    }
  }
}
```

### 1.5 Factory and Singleton
```typescript
// src/utils/logger/index.ts
import { Logger } from './logger';
import { ServerLogger } from './server-logger';
import { BrowserLogger } from './browser-logger';

let loggerInstance: Logger;

export function createLogger(context?: Record<string, unknown>): Logger {
  if (typeof window === 'undefined') {
    return new ServerLogger(context);
  } else {
    return new BrowserLogger(context);
  }
}

export function getLogger(): Logger {
  if (!loggerInstance) {
    loggerInstance = createLogger();
  }
  return loggerInstance;
}

// Default export for easy import
export const logger = getLogger();
```

## Phase 2: Error Handling Utilities (Week 2)

### 2.1 Error Handler for AsyncResult
```typescript
// src/utils/errors/error-handler.ts
import { AsyncResult, createSuccessResult, createErrorResult } from '../async-result';
import { BaseError } from './base-error';
import { logger } from '../logger';

export class ErrorHandler {
  private logger: Logger;
  
  constructor(logger?: Logger) {
    this.logger = logger || getLogger();
  }
  
  // Wrap any error into BaseError
  wrap(error: unknown, code?: string): BaseError {
    if (error instanceof BaseError) {
      return error;
    }
    
    if (error instanceof Error) {
      return new BaseError(
        error.message,
        code || 'UNKNOWN_ERROR',
        500,
        undefined,
        error
      );
    }
    
    return new BaseError(
      String(error),
      code || 'UNKNOWN_ERROR',
      500
    );
  }
  
  // Handle async operations with error logging
  async handle<T>(
    operation: () => Promise<T>,
    context: string
  ): Promise<AsyncResult<T, BaseError>> {
    try {
      const result = await operation();
      return createSuccessResult(result);
    } catch (error) {
      const wrappedError = this.wrap(error);
      this.logger.error(`Operation failed: ${context}`, wrappedError);
      return createErrorResult(wrappedError);
    }
  }
  
  // Handle sync operations
  handleSync<T>(
    operation: () => T,
    context: string
  ): AsyncResult<T, BaseError> {
    try {
      const result = operation();
      return createSuccessResult(result);
    } catch (error) {
      const wrappedError = this.wrap(error);
      this.logger.error(`Operation failed: ${context}`, wrappedError);
      return createErrorResult(wrappedError);
    }
  }
}

export const errorHandler = new ErrorHandler();
```

### 2.2 Express Error Middleware
```typescript
// src/server/middleware/error-middleware.ts
import { Request, Response, NextFunction } from 'express';
import { BaseError } from '../../utils/errors/base-error';
import { logger } from '../../utils/logger';

export function errorMiddleware(
  error: unknown,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const log = logger.child({
    requestId: req.id,
    method: req.method,
    url: req.url,
    ip: req.ip
  });
  
  if (error instanceof BaseError) {
    log.error('Request failed', error);
    
    res.status(error.statusCode).json({
      error: {
        id: error.id,
        code: error.code,
        message: error.message,
        timestamp: error.timestamp
      }
    });
  } else if (error instanceof Error) {
    log.error('Unhandled error', error);
    
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: process.env.NODE_ENV === 'production' 
          ? 'An internal error occurred' 
          : error.message
      }
    });
  } else {
    log.error('Unknown error', error);
    
    res.status(500).json({
      error: {
        code: 'UNKNOWN_ERROR',
        message: 'An unknown error occurred'
      }
    });
  }
}
```

### 2.3 React Error Boundary
```typescript
// src/components/ErrorBoundary.tsx
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { BaseError } from '../utils/errors/base-error';
import { logger } from '../utils/logger';

interface Props {
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }
  
  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }
  
  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const log = logger.child({
      component: errorInfo.componentStack
    });
    
    if (error instanceof BaseError) {
      log.error('Component error', error);
    } else {
      log.error('Unexpected component error', error);
    }
  }
  
  reset = () => {
    this.setState({ hasError: false, error: undefined });
  };
  
  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.reset);
      }
      
      return (
        <div className="error-boundary">
          <h2>Something went wrong</h2>
          <details style={{ whiteSpace: 'pre-wrap' }}>
            {this.state.error.toString()}
          </details>
          <button onClick={this.reset}>Try again</button>
        </div>
      );
    }
    
    return this.props.children;
  }
}
```

## Phase 3: Migration Scripts (Week 3)

### 3.1 Console to Logger Migration
```typescript
// scripts/migrate-console-to-logger.ts
import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';

function migrateFile(filePath: string): void {
  const source = fs.readFileSync(filePath, 'utf-8');
  const sourceFile = ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    true
  );
  
  const transformer = (context: ts.TransformationContext) => {
    return (rootNode: ts.SourceFile): ts.SourceFile => {
      function visit(node: ts.Node): ts.Node {
        // Replace console.log with logger.info
        if (
          ts.isCallExpression(node) &&
          ts.isPropertyAccessExpression(node.expression) &&
          ts.isIdentifier(node.expression.expression) &&
          node.expression.expression.text === 'console'
        ) {
          const method = node.expression.name.text;
          const loggerMethod = 
            method === 'error' ? 'error' :
            method === 'warn' ? 'warn' :
            method === 'debug' ? 'debug' :
            'info';
          
          // Create logger.method call
          return ts.factory.createCallExpression(
            ts.factory.createPropertyAccessExpression(
              ts.factory.createIdentifier('logger'),
              loggerMethod
            ),
            undefined,
            node.arguments
          );
        }
        
        return ts.visitEachChild(node, visit, context);
      }
      
      return ts.visitNode(rootNode, visit) as ts.SourceFile;
    };
  };
  
  const result = ts.transform(sourceFile, [transformer]);
  const printer = ts.createPrinter();
  const transformed = printer.printFile(result.transformed[0] as ts.SourceFile);
  
  // Add logger import if not present
  if (!source.includes("import { logger }")) {
    const importStatement = "import { logger } from '../utils/logger';\n";
    fs.writeFileSync(filePath, importStatement + transformed);
  } else {
    fs.writeFileSync(filePath, transformed);
  }
}

// Run migration
const srcDir = path.join(__dirname, '../src');
const files = glob.sync('**/*.{ts,tsx}', { cwd: srcDir });

files.forEach(file => {
  const filePath = path.join(srcDir, file);
  if (fs.readFileSync(filePath, 'utf-8').includes('console.')) {
    console.log(`Migrating: ${file}`);
    migrateFile(filePath);
  }
});
```

## Phase 4: Testing Strategy

### 4.1 Error Handling Tests
```typescript
// src/utils/errors/__tests__/base-error.test.ts
import { BaseError, ValidationError } from '../index';

describe('BaseError', () => {
  it('should maintain stack trace', () => {
    const error = new ValidationError('Invalid input');
    expect(error.stack).toContain('ValidationError');
    expect(error.stack).toContain('base-error.test.ts');
  });
  
  it('should preserve cause', () => {
    const cause = new Error('Original error');
    const error = new ValidationError('Wrapped error', undefined, cause);
    expect(error.cause).toBe(cause);
  });
  
  it('should generate unique error IDs', () => {
    const error1 = new ValidationError('Error 1');
    const error2 = new ValidationError('Error 2');
    expect(error1.id).not.toBe(error2.id);
  });
});
```

## Phase 5: Monitoring Setup

### 5.1 Error Dashboard
- Set up Grafana/Kibana dashboard for error trends
- Create alerts for critical error thresholds
- Implement error rate monitoring
- Track error resolution times

### 5.2 Performance Metrics
- Monitor logger performance impact
- Track error handling overhead
- Measure time to error resolution

## Migration Checklist

- [ ] Create error hierarchy
- [ ] Implement new logger
- [ ] Add error handler utilities
- [ ] Set up error middleware
- [ ] Create React error boundary
- [ ] Write migration scripts
- [ ] Run migrations on codebase
- [ ] Add ESLint rules
- [ ] Update documentation
- [ ] Train team on new patterns
- [ ] Set up monitoring
- [ ] Deploy to staging
- [ ] Monitor for issues
- [ ] Deploy to production
- [ ] Remove old error handling code

## Success Criteria
1. Zero console.* in production
2. All errors have proper types
3. Stack traces preserved
4. Error context included
5. Monitoring alerts working
6. 50% faster error diagnosis