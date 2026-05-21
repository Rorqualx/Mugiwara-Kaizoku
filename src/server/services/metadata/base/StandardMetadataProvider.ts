/**
 * Standard Metadata Provider Base Class
 *
 * Base implementation for all metadata providers.
 * Provides common functionality and ensures consistent behavior.
 */

import { ProviderErrorType } from '@prisma/client';

import { ProviderError } from '@/types/search.types';
import type { MangaMetadata, MetadataDetails } from '@/types/search.types';
import type { AsyncResult} from '@/utils/async-result';
import { createErrorResult} from '@/utils/async-result';


import type { Chapter as ChapterEntity } from '@prisma/client';
// Provider configuration interface
export interface ProviderConfig {
    name: string;
    enabled: boolean;
    priority?: number;
    capabilities?: unknown[];
    apiKey?: string;
    apiUrl?: string;
    baseUrl?: string;
    timeout?: number;
    retries?: number;
    retryLimit?: number;
    rateLimit?: unknown;
    headers?: Record<string, string>;
}
// Search options interface
export interface SearchOptions {
    limit?: number;
    offset?: number;
    filters?: Record<string, unknown>;
}
// Define IMetadataProvider interface
export interface IMetadataProvider {
    search(query: string, options?: SearchOptions): Promise<AsyncResult<MangaMetadata[], Error>>;
    getDetails(id: string): Promise<AsyncResult<MetadataDetails, Error>>;
    getChapters(mangaId: string): Promise<AsyncResult<ChapterEntity[], Error>>;
    // Provider constants
    ANILIST?: string;
    COMICVINE?: string;
    FANDOM?: string;
    NATIVE_DOWNLOAD?: string;
    MANGANELO?: string;
    MANGASEE?: string;
    MYANIMELIST?: string;
    WEBTOONS?: string;
    WIKIPEDIA?: string;
}
/**
 * Abstract base class for metadata providers
 * Implements common functionality and enforces standard patterns
 */
export abstract class StandardMetadataProvider implements IMetadataProvider {
    // Core identification - must be set by subclasses
    abstract readonly providerId: string;
    abstract readonly providerName: string;
    abstract readonly version: string;
    // Configuration
    public readonly config: ProviderConfig;
    // Rate limiting
    private lastRequestTime: number = 0;
    private requestQueue: Array<() => void> = [];
    constructor(config: ProviderConfig) {
        this.config = this.normalizeConfig(config);
        if (!this.validateConfig()) {
            throw new ProviderError('Invalid provider configuration', ProviderErrorType.UNKNOWN, 'unknown', { error: 'CONFIGURATION_ERROR' });
        }
    }
    /**
     * Normalize configuration with defaults
     */
    protected normalizeConfig(config: ProviderConfig): ProviderConfig {
        return {
            name: config["name"],
            enabled: config.enabled,
            priority: config.priority ?? 0,
            capabilities: config.capabilities ?? [],
            rateLimit: config.rateLimit,
            ...(config.headers !== undefined && { headers: config.headers }),
            timeout: config.timeout ?? 30000, // 30 seconds default
            retries: config.retries ?? 3
        };
    }
    /**
     * Standard search implementation with error handling
     */
    async search(query: string, options?: SearchOptions): Promise<AsyncResult<MangaMetadata[], Error>> {
        if (!this.config.enabled) {
            return createErrorResult(new ProviderError('Provider is disabled', ProviderErrorType.UNKNOWN, this.providerId, { error: 'PROVIDER_DISABLED' }));
        }
        try {
            await this.enforceRateLimit();
            const timeout = this.config.timeout ?? 30000;
            const result = await this.withTimeout(this.doSearch(query, options), timeout);
            return result;
        }
        catch (error: unknown) {const errorMessage = error instanceof Error ? error.message : String(error);
return this.handleError(errorMessage);
        }
    }
    /**
     * Standard getById implementation with error handling
     */
    async getById(id: string): Promise<AsyncResult<MangaMetadata | null, Error>> {
        if (!this.config.enabled) {
            return createErrorResult(new ProviderError('Provider is disabled', ProviderErrorType.UNKNOWN, this.providerId, { error: 'PROVIDER_DISABLED' }));
        }
        try {
            await this.enforceRateLimit();
            const timeout = this.config.timeout ?? 30000;
            const result = await this.withTimeout(this.doGetById(id), timeout);
            return result;
        }
        catch (error: unknown) {const errorMessage = error instanceof Error ? error.message : String(error);
return this.handleError(errorMessage);
        }
    }
    /**
     * Standard getDetails implementation (alias for getMetadata)
     */
    async getDetails(id: string): Promise<AsyncResult<MetadataDetails, Error>> {
        return this.getMetadata(id);
    }
    /**
     * Standard getMetadata implementation with error handling
     */
    async getMetadata(mangaId: string): Promise<AsyncResult<MetadataDetails, Error>> {
        if (!this.config.enabled) {
            return createErrorResult(new ProviderError('Provider is disabled', ProviderErrorType.UNKNOWN, this.providerId, { error: 'PROVIDER_DISABLED' }));
        }
        try {
            await this.enforceRateLimit();
            const timeout = this.config.timeout ?? 30000;
            const result = await this.withTimeout(this.doGetMetadata(mangaId), timeout);
            return result;
        }
        catch (error: unknown) {const errorMessage = error instanceof Error ? error.message : String(error);
return this.handleError(errorMessage);
        }
    }
    /**
     * Standard getChapters implementation with error handling
     */
    async getChapters(mangaId: string): Promise<AsyncResult<ChapterEntity[], Error>> {
        if (!this.config.enabled) {
            return createErrorResult(new ProviderError('Provider is disabled', ProviderErrorType.UNKNOWN, this.providerId, { error: 'PROVIDER_DISABLED' }));
        }
        try {
            await this.enforceRateLimit();
            const timeout = this.config.timeout ?? 30000;
            const result = await this.withTimeout(this.doGetChapters(mangaId), timeout);
            return result;
        }
        catch (error: unknown) {const errorMessage = error instanceof Error ? error.message : String(error);
return this.handleError(errorMessage);
        }
    }
    /**
     * Validate provider configuration
     */
    validateConfig(): boolean {
        // Base validation - can be overridden by subclasses
        if (!this.config.enabled) {
            return true; // Disabled providers are valid
        }
        // If enabled, check for required configuration
        return this.doValidateConfig();
    }
    /**
     * Check if provider is available
     */
    async isAvailable(): Promise<boolean> {
        if (!this.config.enabled) {
            return false;
        }
        try {
            return await this.doCheckAvailability();
        }
        catch {
            return false;
        }
    }
    // Abstract methods that must be implemented by subclasses
    protected abstract doSearch(query: string, options?: SearchOptions): Promise<AsyncResult<MangaMetadata[], Error>>;
    protected abstract doGetById(id: string): Promise<AsyncResult<MangaMetadata | null, Error>>;
    protected abstract doGetMetadata(mangaId: string): Promise<AsyncResult<MetadataDetails, Error>>;
    protected abstract doGetChapters(mangaId: string): Promise<AsyncResult<ChapterEntity[], Error>>;
    protected abstract doValidateConfig(): boolean;
    protected abstract doCheckAvailability(): Promise<boolean>;
    /**
     * Rate limiting implementation
     */
    protected async enforceRateLimit(): Promise<void> {
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;
        const rateLimit = this.config.rateLimit;
        if (typeof rateLimit === 'number' && timeSinceLastRequest < rateLimit) {
            const delay = rateLimit - timeSinceLastRequest;
            await new Promise<void>(resolve => { setTimeout(resolve, delay); });
        }
        this.lastRequestTime = Date.now();
    }
    /**
     * Timeout wrapper for async operations
     */
    protected async withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
        const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => {
                reject(new ProviderError(`Operation timed out after ${timeoutMs}ms`, ProviderErrorType.TIMEOUT, this.providerId, { error: 'TIMEOUT' }));
            }, timeoutMs);
        });
        return Promise.race([promise, timeoutPromise]);
    }
    /**
     * Standard error handling
     */
    protected handleError<T>(error: unknown): AsyncResult<T, Error> {
        if (error instanceof ProviderError) {
            return createErrorResult(error);
        }
        if (error instanceof Error) {
            return createErrorResult(new ProviderError((error instanceof Error ? error.message : String(error)), ProviderErrorType.UNKNOWN, this.providerId, { error: 'UNKNOWN_ERROR', originalError: error }));
        }
        return createErrorResult(new ProviderError(String(error), ProviderErrorType.UNKNOWN, this.providerId, { error: 'UNKNOWN_ERROR' }));
    }
    /**
     * Make HTTP request with standard error handling
     */
    protected async makeRequest<T>(url: string, options?: RequestInit): Promise<T> {
        try {
            const response = await fetch(url, {
                ...options,
                headers: {
                    'User-Agent': `Kaizoku/${this.version}`,
                    'Accept': 'application/json',
                    ...options?.headers
                }
            });
            if (!response.ok) {
                throw new ProviderError(`API request failed: ${response["status"]} ${response.statusText}`, ProviderErrorType.NETWORK, this.providerId, { error: 'API_ERROR', status: response["status"] });
            }
            const data: unknown = await response.json();
            return data as T;
        }
        catch (error: unknown) {
            if (error instanceof ProviderError) {
                throw error;
            }
            throw new ProviderError('Network request failed', ProviderErrorType.NETWORK, this.providerId, { error: 'NETWORK_ERROR', originalError: error });
        }
    }
}
