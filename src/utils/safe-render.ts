/**
 * Safe rendering utilities to prevent objects from being rendered as React children
 */
import type React from 'react';

import { logger } from '@/utils/logger';

/**
 * Helper to safely get a property from a Record<string, unknown>
 */
function safeGetProperty(record: Record<string, unknown>, property: string): unknown {
  if (property in record) {
    return record[property];
  }
  return undefined;
}

/**
 * Ensures a value is safe to render as a React child
 * Converts objects to strings, handles null/undefined, etc.
 */
export function safeRender(value: unknown): React.ReactNode {
    // Handle null/undefined
    if (value === null) {
        return null;
    }

    // Handle primitives (safe to render)
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        return value;
    }

    // Handle React elements (already safe)
    if (typeof value === 'object' && 'type' in value && 'props' in value) {
        return value as unknown as React.ReactNode;
    }

    // Handle Error objects
    if (value instanceof Error) {
        return value.message;
    }

    // Handle arrays (check each element)
    if (Array.isArray(value)) {
        return value.map((item, _index) => safeRender(item));
    }

    // Handle objects - extract message or convert to string
    if (typeof value === 'object') {
        const objRecord = value as Record<string, unknown>;
        // Try to extract a message property
        const message = safeGetProperty(objRecord, 'message');
        if ('message' in value && typeof message === 'string') {
            return message;
        }
        const errorProp = safeGetProperty(objRecord, 'error');
        if ('error' in value && typeof errorProp === 'string') {
            return errorProp;
        }

        // Log warning and return safe message
        logger.warn('[safeRender] Attempted to render object as React child', { value });
        return '[Object]';
    }

    // Fallback
    return String(value);
}

/**
 * Ensures error messages are safe strings
 */
export function safeErrorMessage(error: unknown, fallback = 'An error occurred'): string {
    if (!error) return fallback;

    if (error instanceof Error) {
        return error.message;
    }

    if (typeof error === 'string') {
        return error;
    }

    if (typeof error === 'object') {
        const errorRecord = error as Record<string, unknown>;
        // Try to extract message
        const message = safeGetProperty(errorRecord, 'message');
        if ('message' in error && typeof message === 'string') {
            return message;
        }
        const errorProp = safeGetProperty(errorRecord, 'error');
        if ('error' in error && typeof errorProp === 'string') {
            return errorProp;
        }

        // Log the object for debugging but don't stringify it
        logger.error('[safeErrorMessage] Error object', { error });
        return fallback;
    }

    return fallback;
}