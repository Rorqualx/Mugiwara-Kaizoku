/**
 * NZBGet Utilities Module
 *
 * Foundation utilities for NZBGet client including type definitions,
 * response validation, and error handling.
 *
 * Extracted from: nzbgetClient.ts
 * Purpose: Shared utilities to reduce complexity and enable code reuse
 */

import { ValidationError } from '@/utils/errors';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * NZBGet JSON-RPC request structure
 */
export interface NzbgetRequest {
    version: string;
    method: string;
    params: unknown[];
    id: number;
}

/**
 * NZBGet JSON-RPC response structure
 */
export interface NzbgetResponse<T = unknown> {
    version: string;
    result?: T;
    error?: {
        code: number;
        message: string;
    };
    id: number;
}

/**
 * NZBGet group (active download)
 */
export interface NzbgetGroup {
    NZBID: number;
    NZBName: string;
    Status: string;
    Category: string;
    FileSizeMB: number;
    RemainingSizeMB: number;
    DownloadedSizeMB: number;
    DownloadRate: number;
    RemainingSizeLo: number;
    DownloadedSizeLo: number;
    Priority: number;
    AddTime: number;
    DestDir: string;
    ParStatus: string;
    UnpackStatus: string;
    Health: number;
}

/**
 * NZBGet history item
 */
export interface NzbgetHistoryItem {
    NZBID: number;
    Name: string;
    Status: string;
    Category: string;
    ParStatus: string;
    UnpackStatus: string;
    FileSizeMB: number;
    DownloadedSizeMB: number;
    HistoryTime: number;
    DestDir: string;
}

/**
 * NZBGet status
 */
export interface NzbgetStatus {
    DownloadRate: number;
    RemainingSizeMB: number;
    DownloadedSizeMB: number;
    ServerPaused: boolean;
    Version: string;
}

// ============================================================================
// Response Validation Functions
// ============================================================================

/**
 * Check if response data is HTML (authentication failure)
 *
 * @param data - Response data to check
 * @returns True if data appears to be HTML
 */
export function isHTMLResponse(data: unknown): boolean {
    if (typeof data !== 'string') return false;
    const dataStr = data as string;
    return dataStr.includes('<!DOCTYPE') || dataStr.includes('<html') || dataStr === '';
}

/**
 * Validate that response has required data property
 *
 * @param data - Response data to validate
 * @throws {ValidationError} If data is missing or invalid
 */
export function validateResponseData(data: unknown): void {
    if (!data) {
        throw new ValidationError('Response missing data property');
    }
    if (typeof data !== 'object') {
        throw new ValidationError(`Invalid response data type: expected object but got ${typeof data}`);
    }
}

/**
 * Check if object is a valid JSON-RPC response
 *
 * @param data - Data to check
 * @returns True if data is a valid JSON-RPC response
 */
export function isValidJSONRPCResponse(data: unknown): boolean {
    if (!data || typeof data !== 'object') return false;
    return ('version' in data) || ('jsonrpc' in data);
}

/**
 * Parse response text to JSON
 *
 * @param text - Response text to parse
 * @returns Parsed JSON data
 * @throws {Error} If parsing fails
 */
export function parseResponseText(text: string): unknown {
    try {
        return JSON.parse(text);
    } catch (_error: unknown) {
        throw new Error(`Invalid response format: expected JSON but got string`);
    }
}

/**
 * Extract result from JSON-RPC response
 *
 * @param response - JSON-RPC response
 * @returns Extracted result
 * @throws {ValidationError} If response is invalid or contains error
 */
export function extractJSONRPCResult<T>(response: unknown): T {
    const jsonResponse = response as NzbgetResponse<T>;

    if (!isValidJSONRPCResponse(jsonResponse)) {
        throw new ValidationError('Invalid JSON-RPC response: missing version/jsonrpc field');
    }

    if (jsonResponse.error) {
        throw new ValidationError(
            `NZBGet error: ${jsonResponse.error.message} (code: ${jsonResponse.error.code})`
        );
    }

    if (!('result' in jsonResponse)) {
        throw new ValidationError('Invalid JSON-RPC response: missing result field');
    }

    return jsonResponse.result as T;
}

// ============================================================================
// Error Handling Utilities
// ============================================================================

/**
 * Create authentication error
 *
 * @param message - Optional custom error message
 * @returns Error instance with authentication message
 */
export function createAuthError(message?: string): Error {
    return new Error(message ?? 'Authentication failed: Invalid username or password');
}

/**
 * Create HTTP error from status code
 *
 * @param status - HTTP status code
 * @param statusText - Optional status text
 * @returns Error instance with appropriate message
 */
export function createHTTPError(status: number, statusText?: string): Error {
    const text = statusText ?? 'Unknown';
    switch (status) {
        case 401:
            return new Error('Authentication failed (401 Unauthorized). Please check your NZBGet username and password.');
        case 403:
            return new Error('Access forbidden (403). Please check your NZBGet permissions.');
        case 404:
            return new Error('NZBGet API endpoint not found (404). Please verify the server URL.');
        default:
            return new Error(`NZBGet HTTP error ${status}: ${text}`);
    }
}

/**
 * Convert unknown error to Error instance
 *
 * @param error - Unknown error value
 * @returns Error instance
 */
export function handleError(error: unknown): Error {
    if (error instanceof Error) {
        return error;
    }
    return new Error(String(error));
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard for NzbgetResponse
 *
 * @param value - Value to check
 * @returns True if value is a valid NzbgetResponse
 */
export function isNzbgetResponse<T>(value: unknown): value is NzbgetResponse<T> {
    return (
        typeof value === 'object' &&
        value !== null &&
        ('version' in value || 'jsonrpc' in value)
    );
}

/**
 * Type guard for error with response property
 *
 * @param error - Error to check
 * @returns True if error has response property
 */
export function hasResponseProperty(error: unknown): error is { response: { status?: number; statusText?: string; data?: unknown } } {
    return (
        typeof error === 'object' &&
        error !== null &&
        'response' in error &&
        typeof (error as { response?: unknown }).response === 'object'
    );
}
