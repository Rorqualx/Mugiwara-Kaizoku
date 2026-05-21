/**
 * Error handling utilities for download clients
 */
import type { AsyncResult} from '@/utils/async-result';
import { createErrorResult, createSuccessResult } from '@/utils/async-result';
/**
 * Error class for download operations
 */
export class DownloadError extends Error {
    constructor(message: string, public code?: string, public statusCode?: number, public context?: Record<string, unknown>) {
        super(message);
        this["name"] = 'DownloadError';
    }
}
/**
 * Enhanced error handling wrapper
 */
export async function withEnhancedErrorHandling<T>(operation: () => Promise<T>, context: string): Promise<AsyncResult<T, Error>> {
    try {
        const result = await operation();
        return createSuccessResult(result);
    }
    catch (error: unknown) {
        const downloadError = error instanceof Error
            ? new DownloadError(`${context}: ${(error instanceof Error ? error.message : String(error))}`, undefined, undefined, { originalError: error })
            : new DownloadError(`${context}: Unknown error`, undefined, undefined, { error });
        return createErrorResult(downloadError);
    }
}
/**
 * Creates a contextual error creator function
 */
export function createContextualErrorCreator(context: string): (message: string, code?: string, statusCode?: number) => DownloadError {
    return (message: string, code?: string, statusCode?: number) => {
        return new DownloadError(`[${context}] ${message}`, code, statusCode);
    };
}
/**
 * Type guard for error objects
 */
export function isDownloadError(error: unknown): error is DownloadError {
    return error instanceof DownloadError;
}
/**
 * Extract error message from various error formats
 */
export function extractErrorMessage(error: unknown): string {
    if (error instanceof Error) {
        return (error instanceof Error ? error.message : String(error));
    }
    if (typeof error === 'string') {
        return error;
    }
    if (error && typeof error === 'object') {
        const obj = error as Record<string, unknown>;
        if (typeof obj["message"] === 'string')
            return obj["message"];
        if (typeof obj["error"] === 'string')
            return obj["error"];
    }
    return 'Unknown error';
}
