/**
 * Prowlarr HTTP Client
 *
 * Manages HTTP client initialization and provides wrappers
 * for Prowlarr API endpoints (stats, health, download).
 *
 * Extracted from: mangaSearch.ts
 */

import type { HttpClient } from '@/server/base/HttpClient';
import { createHttpClient } from '@/server/base/HttpClient';
import type { AsyncResult } from '@/utils/async-result/index';
import { createSuccessResult, createErrorResult, isSuccess, isError } from '@/utils/async-result/index';
import { logger } from '@/utils/logger';

import type { PrismaClient } from '@prisma/client';

/**
 * Prowlarr API client for indexer aggregation
 *
 * Handles authentication, request management, and API operations
 * for Prowlarr integration.
 */
export class ProwlarrClient {
    private httpClient: HttpClient | null = null;

    constructor(private prismaClient: PrismaClient) { }

    /**
     * Initializes the HTTP client with Prowlarr configuration
     *
     * Fetches API key and base URL from Config table and creates
     * authenticated HTTP client instance.
     *
     * @returns AsyncResult containing initialized HttpClient or error
     */
    private async initializeClient(): Promise<AsyncResult<HttpClient, Error>> {
        try {
            // Get Prowlarr settings from Config table (not Settings table)
            // The UI saves to Config table via ConfigService
            const baseURLConfig = await this.prismaClient.config.findUnique({
                where: { key: 'prowlarrBaseURL' }
            });
            const apiKeyConfig = await this.prismaClient.config.findUnique({
                where: { key: 'prowlarrApiKey' }
            });

            const prowlarrBaseURL = baseURLConfig?.value as string | null;
            const prowlarrApiKey = apiKeyConfig?.value as string | null;

            // Check if Prowlarr is configured (has API key and Base URL)
            if (!prowlarrBaseURL || !prowlarrApiKey) {
                return createErrorResult(
                    new Error('Prowlarr configuration is incomplete. Please configure Prowlarr Base URL and API Key in Settings → Indexers.')
                );
            }

            // Create HTTP client with Prowlarr config
            this.httpClient = createHttpClient({
                baseURL: prowlarrBaseURL,
                headers: {
                    'X-Api-Key': prowlarrApiKey,
                    'Content-Type': 'application/json'
                },
                timeout: 30000 // 30 second timeout
            });

            return createSuccessResult(this.httpClient);
        } catch (error: unknown) {
            const errorMessage = error instanceof Error
                ? error.message
                : 'Failed to initialize Prowlarr client';
            return createErrorResult(new Error(errorMessage));
        }
    }

    /**
     * Gets the initialized HTTP client
     *
     * Initializes client if not already initialized.
     *
     * @returns AsyncResult containing HttpClient or error
     */
    async getClient(): Promise<AsyncResult<HttpClient, Error>> {
        if (!this.httpClient) {
            return this.initializeClient();
        }
        return createSuccessResult(this.httpClient);
    }

    /**
     * Gets indexer statistics from Prowlarr
     *
     * @returns AsyncResult containing indexer stats array
     */
    async getIndexerStats(): Promise<AsyncResult<unknown[], Error>> {
        try {
            if (!this.httpClient) {
                const clientResult = await this.initializeClient();
                if (!isSuccess(clientResult)) {
                    if (isError(clientResult)) {
                        return createErrorResult(clientResult.error);
                    }
                    return createErrorResult(new Error('Failed to initialize client'));
                }
            }

            if (!this.httpClient) {
                return createErrorResult(new Error('Failed to initialize HTTP client'));
            }

            // Prowlarr v1 returns `{ indexers: [...], userAgents: [...], hosts: [...] }`
            // (not a top-level array as the prior signature implied). Unwrap to
            // the indexers array — the only field every caller actually uses.
            const response = await this.httpClient.get<{ indexers?: unknown[] }>('/api/v1/indexerstats');

            if (response.status !== 200) {
                return createErrorResult(new Error(`API request failed: ${response.statusText}`));
            }

            return createSuccessResult(Array.isArray(response.data.indexers) ? response.data.indexers : []);
        } catch (error: unknown) {
            const errorMessage = error instanceof Error
                ? error.message
                : 'Failed to get indexer stats';
            return createErrorResult(new Error(errorMessage));
        }
    }

    /**
     * Tests Prowlarr connectivity
     *
     * @returns AsyncResult indicating if Prowlarr is accessible
     */
    async testConnection(): Promise<AsyncResult<boolean, Error>> {
        try {
            const clientResult = await this.initializeClient();
            if (!isSuccess(clientResult)) {
                if (isError(clientResult)) {
                    return createErrorResult(clientResult.error);
                }
                return createErrorResult(new Error('Failed to initialize client'));
            }

            if (!this.httpClient) {
                return createErrorResult(new Error('Failed to initialize HTTP client'));
            }

            // Test the connection with a simple API call
            const response = await this.httpClient.get('/api/v1/health');

            if (response.status !== 200) {
                return createErrorResult(new Error('Prowlarr health check failed'));
            }

            logger.info('Prowlarr connection test successful');
            return createSuccessResult(true);
        } catch (error: unknown) {
            const errorMessage = error instanceof Error
                ? error.message
                : 'Failed to test Prowlarr connection';
            return createErrorResult(new Error(errorMessage));
        }
    }

    /**
     * Downloads a release via Prowlarr
     *
     * @param downloadUrl - URL of the release to download
     * @returns AsyncResult indicating success or failure
     */
    async downloadRelease(downloadUrl: string): Promise<AsyncResult<void, Error>> {
        try {
            if (!this.httpClient) {
                const clientResult = await this.initializeClient();
                if (!isSuccess(clientResult)) {
                    if (isError(clientResult)) {
                        return createErrorResult(clientResult.error);
                    }
                    return createErrorResult(new Error('Failed to initialize client'));
                }
            }

            if (!this.httpClient) {
                return createErrorResult(new Error('Failed to initialize HTTP client'));
            }

            // Send download request to Prowlarr
            const response = await this.httpClient.post('/api/v1/release/push', {
                downloadUrl,
                protocol: 'torrent' // or 'usenet' based on URL
            });

            if (response.status !== 200) {
                return createErrorResult(
                    new Error(`Failed to push release to download client: ${response.statusText}`)
                );
            }

            logger.info('Successfully pushed release to download client');
            return createSuccessResult(undefined);
        } catch (error: unknown) {
            const errorMessage = error instanceof Error
                ? error.message
                : 'Failed to download release';
            return createErrorResult(new Error(errorMessage));
        }
    }
}
