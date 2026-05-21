/**
 * Error Handling Context for AddManga Components
 * Provides centralized error handling, validation, and recovery mechanisms
 */
import React, { createContext, useContext, useCallback, useState, useEffect } from 'react';

import { ValidationError as BaseValidationError } from '@/utils/errors';
import { logger } from '@/utils/logger';
import { notify } from '@/utils/notify';

import { logValidationWarning } from '../utils/validation';
// ============================================
// Types
// ============================================
interface ErrorInfo {
    component: string;
    error: Error | string;
    timestamp: Date;
    context?: Record<string, unknown>;
    recovered?: boolean;
}
interface ValidationError {
    field: string;
    message: string;
    value?: unknown;
    suggestion?: string;
}
interface ErrorHandlingContextValue {
    // Error tracking
    errors: ErrorInfo[];
    validationErrors: ValidationError[];
    // Error handling
    handleError: (component: string, error: unknown, context?: Record<string, unknown>) => void;
    handleValidationError: (field: string, message: string, value?: unknown, suggestion?: string) => void;
    clearErrors: () => void;
    clearValidationErrors: () => void;
    // Recovery mechanisms
    retry: <T>(fn: () => Promise<T>, maxAttempts?: number) => Promise<T>;
    withFallback: <T>(fn: () => T, fallback: T) => T;
    // Development helpers
    isDebugMode: boolean;
    toggleDebugMode: () => void;
}
// ============================================
// Context
// ============================================
const ErrorHandlingContext = createContext<ErrorHandlingContextValue | null>(null);
export function useErrorHandling(): ErrorHandlingContextValue {
    const context = useContext(ErrorHandlingContext);
    if (!context) {
        throw new BaseValidationError('useErrorHandling must be used within ErrorHandlingProvider');
    }
    return context;
}
// ============================================
// Provider
// ============================================
interface ErrorHandlingProviderProps {
    children: React.ReactNode;
    maxErrors?: number;
    showNotifications?: boolean;
    debugMode?: boolean;
}
export function ErrorHandlingProvider({ children, maxErrors = 10, showNotifications = true, debugMode = process.env.NODE_ENV === 'development' }: ErrorHandlingProviderProps): React.ReactElement {
    const [errors, setErrors] = useState<ErrorInfo[]>([]);
    const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
    const [isDebugMode, setIsDebugMode] = useState(debugMode);
    // Handle error with context
    const handleError = useCallback((component: string, error: unknown, context?: Record<string, unknown>) => {
        const errorInfo: ErrorInfo = {
            component,
            error: error instanceof Error ? error : new Error(String(error)),
            timestamp: new Date(),
            ...(context !== undefined && { context }),
            recovered: false
        };
        // Add to error list (with max limit)
        setErrors((prev) => {
            const newErrors = [errorInfo, ...prev].slice(0, maxErrors);
            return newErrors;
        });
        // Log in development
        if (isDebugMode) {
            logger.error(`[${component}] Error:`, error, context);
            logValidationWarning(component, String(error), context);
        }
        // Show notification
        if (showNotifications) {
            notify({ severity: 'ERROR', title: `Error in ${component}`, message: error instanceof Error ? (error instanceof Error ? error.message : String(error)) : String(error), toast: { autoClose: 5000 } });
        }
    }, [maxErrors, showNotifications, isDebugMode]);
    // Handle validation error
    const handleValidationError = useCallback((field: string, message: string, value?: unknown, suggestion?: string) => {
        const validationError: ValidationError = {
            field,
            message,
            ...(value !== undefined && { value }),
            ...(suggestion !== undefined && { suggestion })
        };
        // Add to validation errors
        setValidationErrors((prev) => {
            // Remove duplicate field errors
            const filtered = prev.filter((e) => e.field !== field);
            return [validationError, ...filtered];
        });
        // Log in development
        if (isDebugMode) {
            logger.warn(`[Validation] ${field}: ${message}`, { data: value });
            if (suggestion) {
                logger.info(`[Suggestion] ${suggestion}`);
            }
        }
        // Show notification for critical validation errors
        if (showNotifications && field === 'critical') {
            notify({ severity: 'WARNING', title: 'Validation Error', message: `${message}${suggestion ? `. ${suggestion}` : ''}`, toast: { autoClose: 4000 } });
        }
    }, [showNotifications, isDebugMode]);
    // Clear errors
    const clearErrors = useCallback(() => {
        setErrors([]);
    }, []);
    // Clear validation errors
    const clearValidationErrors = useCallback(() => {
        setValidationErrors([]);
    }, []);
    // Retry mechanism with exponential backoff
    const retry = useCallback(async <T,>(fn: () => Promise<T>, maxAttempts: number = 3): Promise<T> => {
        let lastError: unknown;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                // eslint-disable-next-line no-await-in-loop -- Intentional: Sequential retry with exponential backoff
                return await fn();
            }
            catch (error: unknown) {
                lastError = error;
                if (attempt < maxAttempts) {
                    // Exponential backoff
                    const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
                    if (isDebugMode) {
                        logger.info(`[Retry] Attempt ${attempt}/${maxAttempts} failed, retrying in ${delay}ms...`);
                    }
                    // eslint-disable-next-line no-await-in-loop -- Intentional: Sequential delay between retries
                    await new Promise((resolve) => {
                        void setTimeout(resolve, delay);
                    });
                }
            }
        }
        throw lastError;
    }, [isDebugMode]);
    // Fallback mechanism
    const withFallback = useCallback(<T,>(fn: () => T, fallback: T): T => {
        try {
            return fn();
        }
        catch (error: unknown) {
            if (isDebugMode) {
                logger.warn('[Fallback] Using fallback value due to error:', error);
            }
            return fallback;
        }
    }, [isDebugMode]);
    // Toggle debug mode
    const toggleDebugMode = useCallback(() => {
        setIsDebugMode((prev) => !prev);
    }, []);
    // Auto-clear old errors
    useEffect(() => {
        const interval = setInterval(() => {
            const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
            setErrors((prev) => prev.filter((e) => e.timestamp > fiveMinutesAgo));
        }, 60000); // Check every minute
        return () => clearInterval(interval);
    }, []);
    // Log error summary in development
    useEffect(() => {
        if (isDebugMode && errors.length > 0) {
            const errorSummary = errors.map((e) => ({
                component: e.component,
                error: e.error instanceof Error ? e.error.message : String(e.error),
                time: e.timestamp.toLocaleTimeString(),
                recovered: e.recovered
            }));
            logger.debug('[Error Summary]', { errors: errorSummary });
        }
    }, [errors, isDebugMode]);
    const value: ErrorHandlingContextValue = {
        errors,
        validationErrors,
        handleError,
        handleValidationError,
        clearErrors,
        clearValidationErrors,
        retry,
        withFallback,
        isDebugMode,
        toggleDebugMode
    };
    return (<ErrorHandlingContext.Provider value={value}>
      {children}
    </ErrorHandlingContext.Provider>);
}
// ============================================
// Error Boundary Component
// ============================================
interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
}
export class AddMangaErrorBoundary extends React.Component<{
    children: React.ReactNode;
    fallback?: React.ComponentType<{
        error: Error;
    }>;
}, ErrorBoundaryState> {
    constructor(props: { children: React.ReactNode; fallback?: React.ComponentType<{ error: Error; }>; }) {
        super(props);
        this.state = { hasError: false, error: null };
    }
    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { hasError: true, error };
    }
    componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
        logger.error('[AddMangaErrorBoundary] Caught error:', error, errorInfo);
        // Log to external service in production
        if (process.env.NODE_ENV === 'production') {
            // TODO: Send to error tracking service
        }
    }
    render(): React.ReactNode {
        if (this.state.hasError && this.state.error) {
            if (this.props.fallback) {
                const Fallback = this.props.fallback;
                return <Fallback error={this.state.error}/>;
            }
            return (<div style={{ padding: '20px', border: '1px solid red', borderRadius: '8px' }}>
          <h2>Something went wrong</h2>
          <details style={{ whiteSpace: 'pre-wrap' }}>
            {this.state.error.toString()}
          </details>
          <button onClick={() => this.setState({ hasError: false, error: null })}>
            Try again
          </button>
        </div>);
        }
        return this.props.children;
    }
}
// ============================================
// Hooks
// ============================================
export interface UseComponentErrorHandlerReturn {
    handleError: (error: unknown, context?: Record<string, unknown>) => void;
    handleValidation: (field: string, message: string, value?: unknown, suggestion?: string) => void;
    retry: <T>(fn: () => Promise<T>) => Promise<T>;
    withFallback: <T>(fn: () => T, fallback: T) => T;
}

/**
 * Hook for component-level error handling
 */
export function useComponentErrorHandler(componentName: string): UseComponentErrorHandlerReturn {
    const { handleError, handleValidationError, retry, withFallback } = useErrorHandling();
    return {
        handleError: (error: unknown, context?: Record<string, unknown>) => handleError(componentName, error, context),
        handleValidation: (field: string, message: string, value?: unknown, suggestion?: string) => handleValidationError(`${componentName}.${field}`, message, value, suggestion),
        retry: <T,>(fn: () => Promise<T>) => retry(fn),
        withFallback: <T,>(fn: () => T, fallback: T) => withFallback(fn, fallback)
    };
}
export interface UseSafeAsyncReturn<T> {
    execute: (fn: () => Promise<T>) => Promise<T>;
    loading: boolean;
    error: Error | null;
    data: T | null;
}

/**
 * Hook for safe async operations
 */
export function useSafeAsync<T>(): UseSafeAsyncReturn<T> {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    const [data, setData] = useState<T | null>(null);
    const execute = useCallback(async (fn: () => Promise<T>) => {
        setIsLoading(true);
        setError(null);
        try {
            const result = await fn();
            setData(result);
            return result;
        }
        catch (err: unknown) {
            const error = err instanceof Error ? err : new Error(String(err));
            setError(error);
            throw error;
        }
        finally {
            setIsLoading(false);
        }
    }, []);
    return { execute, loading: isLoading, error, data };
}
