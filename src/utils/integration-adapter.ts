/**
 * Integration Adapter Pattern
 *
 * This module provides interfaces and utilities for creating and managing
 * integration adapters for external APIs.
 */
import type { MetadataSourceInfo } from '@/types/adapters/native-download-types';

import { ValidationError } from '../utils/errors';
import { logger } from '../utils/logger';

import { isSuccess, isError } from './async-result';
import { mapToMangaStatus } from './status-mapper';

import type { AsyncResult} from './async-result';
import type { BaseIntegrationConfig } from '../types/config.types';
import type { MangaSearchResult, MangaMetadata } from '../types/search.types';
import type { SearchOptions } from '../types/search.types';
import type { MangaPublicationStatus as MangaStatus } from '@prisma/client';
import type { Chapter as ChapterEntity } from '@prisma/client';




// Re-export types for backward compatibility
export type { BaseIntegrationConfig } from '../types/config.types';
export type { SearchOptions } from '../types/search.types';
export type { MetadataSourceInfo } from '@/types/adapters/native-download-types';
export type { MangaSearchResult, MangaMetadata } from '../types/search.types';
/**
 * Generic manga data returned from integration adapters
 */
export interface IntegrationMangaData {
    /**
     * ID can be string or number
     * We support both types to accommodate different external APIs
     */
    id: string | number;
    title: string;
    description?: string;
    coverUrl?: string;
    status?: string;
    genres?: string[];
    tags?: string[];
    authors?: string[];
    [key: string]: unknown;
}
/**
 * Generic interface for integration adapters
 */
export interface IntegrationAdapter<T extends BaseIntegrationConfig = BaseIntegrationConfig> {
    /** Check if the adapter is enabled */
    isEnabled(): boolean;
    /** Get information about the source */
    getSourceInfo(): MetadataSourceInfo;
    // Core methods - ALL use AsyncResult pattern
    search(query: string, options?: SearchOptions): Promise<AsyncResult<MangaSearchResult[], Error>>;
    getMangaById(id: string | number): Promise<AsyncResult<IntegrationMangaData, Error>>;
    getMangaByTitle(title: string): Promise<AsyncResult<IntegrationMangaData, Error>>;
    getChapters(mangaId: string | number, options?: {
        limit?: number;
        offset?: number;
        translatedLanguage?: string[];
    }): Promise<AsyncResult<ChapterEntity[], Error>>;
    getStatus(): Promise<AsyncResult<{
        status: 'ok' | 'error';
        message?: string;
    }, Error>>;
    // Metadata methods - ALL use AsyncResult pattern
    searchManga(query: string, options?: SearchOptions): Promise<AsyncResult<MangaMetadata[], Error>>;
    getMangaMetadataById?(sourceId: string | number): Promise<AsyncResult<MangaMetadata | null, Error>>;
    updateMangaMetadata(mangaId: string | number): Promise<AsyncResult<void, Error>>;
    updateAllMangaMetadata?(limit?: number): Promise<AsyncResult<number, Error>>;
    // Legacy compatibility - DEPRECATED, will be removed
    /** @deprecated Use search() instead */
    searchAsync?(query: string, options?: SearchOptions): Promise<AsyncResult<MangaSearchResult[], Error>>;
    /** @deprecated Use getMangaById() instead */
    getMangaByIdAsync?(id: string | number): Promise<AsyncResult<IntegrationMangaData, Error>>;
    /** @deprecated Use getMangaByTitle() instead */
    getMangaByTitleAsync?(title: string): Promise<AsyncResult<IntegrationMangaData, Error>>;
    /** @deprecated Use getChapters() instead */
    getChaptersAsync?(mangaId: string | number, options?: {
        limit?: number;
        offset?: number;
        translatedLanguage?: string[];
    }): Promise<AsyncResult<ChapterEntity[], Error>>;
    /** @deprecated Use getStatus() instead */
    getStatusAsync?(): Promise<AsyncResult<{
        status: 'ok' | 'error';
        message?: string;
    }, Error>>;
    // Configuration methods
    configure(config: Partial<T>): void;
    getConfig(): T;
    // Cleanup method
    dispose(): void;
}
/**
 * Base class for integration adapters
 */
export class BaseIntegrationAdapter<T extends BaseIntegrationConfig> {
    protected config: T;
    protected source: string;
    constructor(config: T, source: string) {
        this.config = config;
        this["source"] = source;
    }
    /**
     * Logs an error message
     */
    protected log(message: string, error?: unknown): void {
        // Check if config has a logger property
        const configWithLogger = this.config as Record<string, unknown>;
        if (configWithLogger["logger"] && typeof configWithLogger["logger"] === 'function') {
            (configWithLogger["logger"] as (msg: string, err?: unknown) => void)(`[${this["source"]}] ${message}`, error);
        }
        else {
            logger.error(`[${this["source"]}] ${message}`, error instanceof Error ? error.message : String(error));
        }
    }
    /**
     * Creates an error with optional cause
     */
    protected createError(message: string, cause?: unknown): Error {
        const error = new Error(message);
        if (cause && cause instanceof Error) {
            // Use type assertion with unknown intermediate step for safety
            (error as unknown as {
                cause: Error;
            }).cause = cause;
        }
        return error;
    }
    /**
     * Maps a provider status to a standardized MangaStatus
     */
    protected mapStatus(providerStatus: unknown): MangaStatus {
        return mapToMangaStatus(providerStatus);
    }
    /**
     * Default implementation for isEnabled
     */
    public isEnabled(): boolean {
        return this.config.enabled !== false;
    }
    /**
     * Default implementation for getConfig
     */
    public getConfig(): T {
        return { ...this.config };
    }
    /**
     * Default implementation for configure
     */
    public configure(config: Partial<T>): void {
        this.config = { ...this.config, ...config } as T;
    }
    /**
     * Default implementation for dispose
     */
    public dispose(): void {
        // Nothing to clean up by default
    }
    /**
     * Default implementation for getSourceInfo
     * This should be overridden by derived classes
     */
    public getSourceInfo(): MetadataSourceInfo {
        return {
            id: this["source"],
            name: this["source"].charAt(0).toUpperCase() + this["source"].slice(1),
            type: 'metadata',
            version: '1.0.0'
        };
    }
    /**
     * Template method to unwrap AsyncResult for Promise-based interface methods
     * This eliminates duplicate code across all adapter implementations
     * @param asyncFn The async function that returns an AsyncResult
     * @param methodName Name of the method for error messages
     * @returns The unwrapped data or throws an error
     */
    protected async unwrapAsyncResult<T>(asyncFn: () => Promise<AsyncResult<T, Error>>, methodName: string): Promise<T> {
        const result = await asyncFn();
        if (isSuccess(result))
            return result.data;
        if (isError(result))
            throw result.error;
        throw new ValidationError(`Unknown state in ${methodName}`);
    }
}
