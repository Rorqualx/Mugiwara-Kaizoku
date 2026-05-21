/**
 * Base Search Provider Abstract Class
 *
 * This module provides a foundational abstract class for implementing search providers
 * following the adapter pattern. It establishes a common interface and shared
 * functionality for all search providers in the application.
 */
import type { SearchProvider, SearchResult, SearchOptions } from '@/types/search.types';
import { logger } from '@/utils/logger';

import { searchConfigService } from '../configService';

import type { MetadataProvider } from '@prisma/client';
/**
 * Abstract base class for search providers that implements common functionality
 * and enforces the search provider interface
 */
export abstract class BaseSearchProvider implements SearchProvider {
    /**
     * Provider name for display purposes
     */
    abstract name: string;
    /**
     * Provider type enum value for type-safe operations
     */
    abstract type: MetadataProvider;
    /**
     * Cache for settings to avoid frequent database lookups
     */
    private settingsCache: Record<string, unknown> | null = null;
    /**
     * Cache expiration timestamp
     */
    private cacheExpiration: number = 0;
    /**
     * Cache duration in milliseconds (5 minutes)
     */
    private readonly CACHE_DURATION = 5 * 60 * 1000;
    /**
     * Search for manga using the provider's implementation
     *
     * @param query - Search query string
     * @param options - Optional search configuration
     * @returns Promise with search results
     */
    abstract search(query: string, options?: SearchOptions): Promise<SearchResult[]>;
    /**
     * Get detailed metadata for a manga
     *
     * @param id - Manga ID specific to this provider
     * @param title - Optional title for fallback purposes
     * @returns Promise with detailed manga data
     */
    abstract getMetadata(id: string, title?: string): Promise<SearchResult>;
    /**
     * Check if this provider is enabled in the application settings
     *
     * @returns Boolean indicating if the provider is enabled
     */
    async isEnabled(): Promise<boolean> {
        try {
            const enabled = await searchConfigService.isProviderEnabled(this.type);
            return enabled; // Use the value from the config service
        }
        catch (error: unknown) {
  logger.error(`Error checking if provider ${this["name"]} is enabled:`, error instanceof Error ? error.message : String(error));
            return false; // Default to disabled on error
        }
    }
    /**
     * Get the provider's settings from the configuration service
     *
     * @returns Provider settings object or null if not found
     */
    protected async getProviderSettings(): Promise<{
        enabled: boolean;
        [key: string]: unknown;
    } | null> {
        // Check cache first
        const now = Date.now();
        if (this.settingsCache && this.cacheExpiration > now) {
            // Cast to ensure enabled is included
            return this.settingsCache as {
                enabled: boolean;
                [key: string]: unknown;
            };
        }
        try {
            // Get settings from configuration service
            const config = await searchConfigService.loadConfig();
            // Get provider settings or create default
            const providerKey = this.type.toString();
            const providerSettings = config.providers[providerKey] ?? { enabled: true };
            // Update cache
            this.settingsCache = providerSettings;
            this.cacheExpiration = now + this.CACHE_DURATION;
            return providerSettings;
        }
        catch (error: unknown) {
  logger.error(`Error getting settings for provider ${this["name"]}: ${error instanceof Error ? error.message : String(error)}`);
            return null;
        }
    }
    /**
     * Create a base search result entity with common fields
     *
     * @param base - Common manga search result fields
     * @returns Partial search result
     */
    protected createBaseResult(base: Partial<SearchResult>): Partial<SearchResult> {
        return {
            ...base,
            provider: this.type
        };
    }
    /**
     * Log API errors with standardized format
     *
     * @param operation - The operation that failed
     * @param error - The error object
     * @param details - Additional details for debugging
     */
    protected logApiError(operation: string, error: unknown, details?: unknown): void {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(`${this["name"]} API Error - ${operation}: ${errorMessage}`, JSON.stringify({
            provider: this["name"],
            operation,
            details
        }));
    }
}
