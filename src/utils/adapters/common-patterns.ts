/**
 * Common Adapter Patterns
 *
 * This module provides reusable utilities and patterns for integration adapters.
 * These utilities help maintain consistency across adapter implementations and
 * reduce code duplication.
 */
import { MangaPublicationStatus } from '@prisma/client';

import { getErrorMessage } from '@/utils/errors/helpers';



import { createSuccessResult, createErrorResult } from '../async-result';
import { mapToMangaStatus } from '../status-mapper';
import { validateConfig } from '../validation/validators/config';

import type { AsyncResult} from '../async-result';
import type { IntegrationAdapter, BaseIntegrationConfig, IntegrationMangaData} from '../integration-adapter';
/**
 * Maps a provider status to a standardized MangaStatus
 *
 * @param providerStatus - Provider-specific status
 * @param provider - Optional provider name for provider-specific mappings
 * @returns Standardized MangaStatus
 */
export function mapStatusToDomain(providerStatus: unknown, provider?: string): MangaPublicationStatus {
    return mapToMangaStatus(providerStatus, provider);
}
/**
 * Creates a safe error handler for adapters
 *
 * @param adapterName - Name of the adapter
 * @returns Error handler function
 */
export function createErrorHandler(adapterName: string) {
    return (message: string, error?: unknown): Error => {
        const errorMsg = getErrorMessage(error);
        const errorMessage = `[${adapterName}] ${message}: ${errorMsg}`;
        interface ErrorWithCause extends Error {
            cause?: unknown;
        }
        const wrappedError = new Error(errorMessage) as ErrorWithCause;
        if (error instanceof Error) {
            wrappedError.cause = error;
        }
        return wrappedError;
    };
}
/**
 * Type guard for manga search results
 *
 * @param value - Value to check
 * @returns True if value is an array of manga search results
 */
export function isMangaSearchResultArray(value: unknown): value is IntegrationMangaData[] {
    return Array.isArray(value) &&
        value.every(item => typeof item === 'object' &&
            item !== null &&
            'id' in item &&
            'title' in item);
}
/**
 * Converts a standard async method to an AsyncResult pattern method
 *
 * @param fn - Original async function
 * @param errorHandler - Error handler function
 * @returns AsyncResult-wrapped function
 */
export function wrapWithAsyncResult<T, Args extends unknown[]>(fn: (...args: Args) => Promise<T>, errorHandler: (message: string, error?: unknown) => Error): (...args: Args) => Promise<AsyncResult<T, Error>> {
    return async (...args: Args): Promise<AsyncResult<T, Error>> => {
        try {
            const result = await fn(...args);
            return createSuccessResult(result);
        }
        catch (error: unknown) {
            return createErrorResult(errorHandler('Operation failed', error));
        }
    };
}
/**
 * Applies rate limiting to adapter operations
 *
 * @param throttleMs - Milliseconds to wait between operations
 * @returns Decorator function for rate limiting
 */
export function withRateLimit(throttleMs: number) {
    let lastRequestTime = 0;
    return async <T>(operation: () => Promise<T>): Promise<T> => {
        const now = Date.now();
        const timeSinceLastRequest = now - lastRequestTime;
        if (timeSinceLastRequest < throttleMs) {
            const waitTime = throttleMs - timeSinceLastRequest;
            await new Promise<void>(resolve => {
                setTimeout(resolve, waitTime);
            });
        }
        lastRequestTime = Date.now();
        return operation();
    };
}
/**
 * Safely handles missing fields in API responses
 *
 * @param obj - Object to access
 * @param path - Property path (dot notation)
 * @param defaultValue - Default value if property doesn't exist
 * @returns Property value or default
 */
export function safeAccess<T = unknown>(obj: unknown, path: string, defaultValue: T): T {
    try {
        const parts = path.split('.');
        let current: unknown = obj;
        for (const part of parts) {
            if (current === null) {
                return defaultValue;
            }
            const currentRecord = current as Record<string, unknown>;
            if (part in currentRecord) {
                current = currentRecord[part];
            } else {
                return defaultValue;
            }
        }
        return (current === null) ? defaultValue : current as T;
    }
    catch (_error: unknown) {
        return defaultValue;
    }
}
/**
 * Extends an adapter with additional methods
 *
 * @param adapter - Base adapter
 * @param extensions - Method extensions
 * @returns Extended adapter
 */
export function extendAdapter<T extends BaseIntegrationConfig>(adapter: IntegrationAdapter<T>, extensions: Partial<IntegrationAdapter<T>>): IntegrationAdapter<T> {
    const proto = Object.getPrototypeOf(adapter) as object | null;
    const base: Partial<IntegrationAdapter<T>> = proto !== null ? (Object.create(proto) as Partial<IntegrationAdapter<T>>) : {};
    return Object.assign(base, adapter, extensions) as IntegrationAdapter<T>;
}
/**
 * Creates a configuration validator with default values
 *
 * @param defaults - Default configuration values
 * @param requiredFields - Required configuration fields
 * @returns Configuration validator function
 */
export function createConfigValidator<T extends BaseIntegrationConfig>(defaults: Partial<T>, requiredFields: (keyof T)[]): (config: Partial<T>) => T {
    return (config: Partial<T>) => validateConfig(config, requiredFields, defaults);
}
