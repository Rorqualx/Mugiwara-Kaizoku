/**
 * Base Download Client Types and Interfaces
 *
 * Common types and interfaces for all download clients.
 * This consolidates the shared functionality and types to reduce duplication.
 */

import { DownloadStatus} from '@prisma/client';

import type { AsyncResult} from '@/utils/async-result';
import { createErrorResult, isSuccess, isError, isLoading } from '@/utils/async-result'
import { ValidationError } from '@/utils/errors';

// Use DownloadStatus directly from @prisma/client
// No need for alias - use DownloadStatus everywhere
/**
 * Base download client interface
 */
export interface DownloadClient {
    name: string;
    type: 'torrent' | 'usenet';
    // Core methods
    addUrl(options: AddDownloadOptions): Promise<AsyncResult<{
        id: string;
    }, Error>>;
    getStatus(id: string, options?: GetStatusOptions): Promise<AsyncResult<DownloadStatusInfo, Error>>;
    getAllItems(): Promise<AsyncResult<DownloadItem[], Error>>;
    pauseItem(id: string): Promise<AsyncResult<boolean, Error>>;
    resumeItem(id: string): Promise<AsyncResult<boolean, Error>>;
    removeItem(id: string, deleteFiles?: boolean): Promise<AsyncResult<boolean, Error>>;
    // Connection management
    testConnection(): Promise<AsyncResult<ConnectionStatus, Error>>;
    dispose(): void;
}
/**
 * Download status information
 */
export interface DownloadStatusInfo {
    id: string;
    name: string;
    status: DownloadStatus;
    progress: number;
    downloadSpeed: number;
    uploadSpeed?: number;
    eta?: number;
    totalSize: number;
    downloadedSize: number;
    error?: string;
    seedRatio?: number;
    peers?: number;
    seeds?: number;
}
/**
 * Alias for compatibility - use DownloadItem instead
 */
export type DownloadItem = DownloadStatusInfo & {
    dateAdded: Date;
    savePath: string;
    files: Array<{
        name: string;
        size: number;
        progress: number;
        selected?: boolean;
    }>;
    labels?: string[];
    trackers?: string[];
    size?: number; // Add for compatibility
    downloaded?: number; // Add for compatibility
    uploaded?: number; // Add for compatibility
    ratio?: number; // Add for compatibility
    dateCompleted?: Date; // Add for compatibility
    clientSpecific?: Record<string, unknown>; // Add for compatibility
};
/**
 * Options for adding a download
 */
export interface AddDownloadOptions {
    url: string;
    savePath?: string;
    paused?: boolean;
    category?: string;
    priority?: number;
    labels?: string[];
    downloadDir?: string;
    cookies?: string;
    httpUser?: string;
    httpPass?: string;
    destination?: string;
    clientSpecific?: Record<string, unknown>;
}
/**
 * Options for getting status
 */
export interface GetStatusOptions {
    includeFiles?: boolean;
    includeTrackers?: boolean;
    includePeers?: boolean;
}
/**
 * API client configuration
 */
export interface ApiClientConfig {
    host: string;
    port: number;
    username?: string;
    password?: string;
    apiKey?: string;
    useProxy?: boolean;
    proxyUrl?: string;
    timeout?: number;
    ssl?: boolean;
    basePath?: string;
    baseURL?: string; // Added for compatibility with clients expecting full URL
    /**
     * Default category/label applied to dispatched downloads when the call site
     * doesn't override it. Mapped per-client: Deluge → label, Transmission →
     * labels[], NZBGet → category, SABnzbd → cat.
     */
    category?: string;
}
/**
 * Connection status information
 */
export interface ConnectionStatus {
    connected: boolean;
    version?: string;
    error?: string;
    capabilities?: string[];
}
/**
 * Error factory for download clients
 */
export function createDownloadError(message: string, operation?: string): Error {
    const error = new Error(operation ? `${operation}: ${message}` : message);
    return error;
}
/**
 * Base abstract class for download clients
 */
export abstract class BaseDownloadClient implements DownloadClient {
    public abstract name: string;
    public abstract type: 'torrent' | 'usenet';
    protected config: ApiClientConfig;
    protected sessionId?: string | null;
    protected lastSessionRefresh?: Date;
    protected sessionRefreshInterval: number = 30 * 60 * 1000; // 30 minutes
    protected connectionError?: Error;
    protected errorFactory = createDownloadError;
    constructor(config: ApiClientConfig) {
        this.config = config;
    }
    // Abstract methods that each client must implement
    abstract addUrl(options: AddDownloadOptions): Promise<AsyncResult<{
        id: string;
    }, Error>>;
    abstract getStatus(id: string, options?: GetStatusOptions): Promise<AsyncResult<DownloadStatusInfo, Error>>;
    abstract getAllItems(): Promise<AsyncResult<DownloadItem[], Error>>;
    abstract pauseItem(id: string): Promise<AsyncResult<boolean, Error>>;
    abstract resumeItem(id: string): Promise<AsyncResult<boolean, Error>>;
    abstract removeItem(id: string, deleteFiles?: boolean): Promise<AsyncResult<boolean, Error>>;
    abstract testConnection(): Promise<AsyncResult<ConnectionStatus, Error>>;
    abstract dispose(): void;
    /**
     * Maps client-specific status to standard status
     */
    protected abstract mapStatus(clientStatus: unknown): DownloadStatus;
    /**
     * Gets the client type identifier
     */
    abstract getClientType(): string;
    /**
     * Updates connection status
     */
    protected updateConnectionStatus(connected: boolean, error?: string): void {
        if (error) {
            this.connectionError = new Error(error);
        }
        // Don't set undefined if exactOptionalPropertyTypes is enabled
    }
    /**
     * Common helper to build API URL
     */
    protected buildUrl(path: string): string {
        const protocol = this.config.ssl ? 'https' : 'http';
        const basePath = this.config.basePath ?? '';
        return `${protocol}://${this.config.host}:${this.config.port}${basePath}${path}`;
    }
    /**
     * Common helper to build auth headers
     */
    protected buildAuthHeaders(): Record<string, string> {
        const headers: Record<string, string> = {};
        if (this.config.username && this.config.password) {
            const auth = Buffer.from(`${this.config.username}:${this.config.password}`).toString('base64');
            headers['Authorization'] = `Basic ${auth}`;
        }
        if (this.config.apiKey) {
            headers['X-Api-Key'] = this.config.apiKey;
        }
        return headers;
    }
    /**
     * Common helper to handle session management
     */
    protected async ensureSession(): Promise<void> {
        if (!this.sessionId || this.isSessionExpired()) {
            await this.refreshSession();
        }
    }
    /**
     * Check if session has expired
     */
    protected isSessionExpired(): boolean {
        if (!this.lastSessionRefresh)
            return true;
        const now = new Date();
        const elapsed = now.getTime() - this.lastSessionRefresh.getTime();
        return elapsed > this.sessionRefreshInterval;
    }
    /**
     * Refresh session - override in subclasses that need session management
     */
    protected refreshSession(): Promise<void> {
        // Default implementation - subclasses can override
        this.lastSessionRefresh = new Date();
        return Promise.resolve();
    }
    /**
     * Common helper to convert sizes
     */
    protected convertSize(bytes: number): number {
        return Math.round(bytes);
    }
    /**
     * Common helper to convert speeds
     */
    protected convertSpeed(bytesPerSecond: number): number {
        return Math.round(bytesPerSecond);
    }
    /**
     * Common helper to calculate ETA
     */
    protected calculateEta(remainingBytes: number, downloadSpeed: number): number | undefined {
        if (downloadSpeed <= 0)
            return undefined;
        return Math.round(remainingBytes / downloadSpeed);
    }
    /**
     * Common helper to normalize file paths
     */
    protected normalizePath(path: string): string {
        // Remove trailing slashes and normalize separators
        return path.replace(/\\/g, '/').replace(/\/$/, '');
    }
    /**
     * Common helper to validate download options
     */
    protected validateDownloadOptions(options?: AddDownloadOptions): AddDownloadOptions {
        const validated: AddDownloadOptions = {
            url: options?.url ?? ''
        };
        if (options?.savePath) {
            validated.savePath = this.normalizePath(options.savePath);
        }
        if (options?.category) {
            validated.category = options.category.trim();
        }
        if (options?.labels) {
            validated.labels = options.labels.filter(label => label.trim().length > 0);
        }
        if (typeof options?.paused === 'boolean') {
            validated.paused = options.paused;
        }
        if (typeof options?.priority === 'number') {
            validated.priority = Math.max(0, Math.min(10, options.priority));
        }
        return validated;
    }
    /**
     * Common helper to handle API errors
     */
    protected handleApiError(error: unknown, operation: string): Error {
        if (error instanceof Error) {
            // Add context to existing error
            // Removed malformed assignment
            return error;
        }
        // Convert unknown errors to Error instances
        return new Error(`${operation} failed: ${String(error)}`);
    }
    /**
     * Common helper to extract error message from various response formats
     */
    protected extractErrorMessage(response: unknown): string {
        if (!response || typeof response !== 'object') {
            return 'Unknown error';
        }
        const obj = response as Record<string, unknown>;
        // Check common error field names
        if (typeof obj["error"] === 'string')
            return obj["error"];
        if (typeof obj["message"] === 'string')
            return obj["message"];
        if (typeof obj["errorMessage"] === 'string')
            return obj["errorMessage"];
        if (typeof obj["error_message"] === 'string')
            return obj["error_message"];
        // Check nested error object
        if (obj["error"] && typeof obj["error"] === 'object') {
            const errorObj = obj["error"] as Record<string, unknown>;
            if (typeof errorObj["message"] === 'string')
                return errorObj["message"];
            if (typeof errorObj["description"] === 'string')
                return errorObj["description"];
        }
        return 'Unknown error';
    }
    /**
     * Template method to execute async operations and unwrap AsyncResult
     * This eliminates duplicate code in download client implementations
     * @param asyncOperation The async operation that returns an AsyncResult
     * @param operationName Name of the operation for error messages
     * @returns The unwrapped data or throws an error
     */
    protected async executeAsyncOperation<T>(asyncOperation: () => Promise<AsyncResult<T, Error>>, operationName: string): Promise<T> {
        const result = await asyncOperation();
        if (isSuccess(result)) {
            return result.data;
        }
        if (isError(result)) {
            throw result.error;
        }
        if (isLoading(result)) {
            throw new ValidationError(`Operation still in progress: ${operationName} for ${this.type}`);
        }
        throw new ValidationError(`${operationName} failed: operation not started`);
    }
    /**
     * Wrapper method for operations that need AsyncResult return type
     * This is used when the interface requires AsyncResult but internal implementation
     * already returns AsyncResult
     * @param asyncOperation The async operation
     * @param operationName Name of the operation for error messages
     * @returns AsyncResult with proper error handling
     */
    protected async wrapAsyncOperation<T>(asyncOperation: () => Promise<AsyncResult<T, Error>>, operationName: string): Promise<AsyncResult<T, Error>> {
        try {
            const result = await asyncOperation();
            if (isSuccess(result) || isError(result)) {
                return result;
            }
            if (isLoading(result)) {
                return createErrorResult(new Error(`Operation still in progress: ${operationName} for ${this.type}`));
            }
            return createErrorResult(new Error(`${operationName} failed: operation not started`));
        }
        catch (error: unknown) {
            return createErrorResult(error instanceof Error
                ? error
                : new Error(`${operationName} failed: ${String(error)}`));
        }
    }
}
/**
 * Maps download status to a normalized status type
 */
export function normalizeDownloadStatus(status: string): DownloadStatus {
    const normalized = status.toLowerCase();
    if (normalized.includes('download'))
        return DownloadStatus.DOWNLOADING;
    if (normalized.includes('seed'))
        return DownloadStatus.SEEDING;
    if (normalized.includes('pause') || normalized.includes('stop'))
        return DownloadStatus.PAUSED;
    if (normalized.includes('complete') || normalized.includes('finish'))
        return DownloadStatus.COMPLETED;
    if (normalized.includes('error') || normalized.includes('fail'))
        return DownloadStatus.ERROR;
    if (normalized.includes('queue') || normalized.includes('wait'))
        return DownloadStatus.QUEUED;
    return DownloadStatus.DOWNLOADING; // Default fallback
}
