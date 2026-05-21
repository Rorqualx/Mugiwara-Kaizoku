import { prisma } from '@/server/db';
import type { AsyncResult} from '@/utils/async-result';
import { createSuccessResult, createErrorResult, isSuccess, isError } from '@/utils/async-result';
import { logger } from '@/utils/logger';

// Import download client adapters
import { AddDownloadOptions } from './base';
import {
  clientFactories,
  type BaseClientConfig
} from './client-factory';
import {
  isClientEnabled,
  clientConfigBuilders,
  clientDisplayNames,
  type TypedClientConfig
} from './config-builders';

import type { BaseDownloadClient} from './base';
import type { PrismaClient } from '@prisma/client';
// Use ApiClientConfig with type field directly
// No need for separate type alias
interface DownloadOptions {
    category?: string;
    destination?: string;
    paused?: boolean;
}
/**
 * ClientDownloadService - Service for managing downloads via download clients
 *
 * Handles sending downloads to configured clients (Transmission, Deluge, NZBGet, etc.)
 * and monitoring their progress.
 */
export class ClientDownloadService {
    constructor(private prismaClient: PrismaClient = prisma) { }
    /**
     * Send a download to the specified client
     *
     * @param clientType - Type of download client
     * @param url - URL to download
     * @param options - Download options
     * @returns AsyncResult with download ID
     */
    async sendToClient(clientType: string, url: string, options?: DownloadOptions): Promise<AsyncResult<{
        downloadId: string;
    }, Error>> {
        try {
            // Get client configuration
            const configResult = await this.getClientConfig(clientType);
            if (isError(configResult)) {
                return configResult;
            }
            if (!isSuccess(configResult)) {
                return createErrorResult(new Error('Failed to get client configuration'));
            }
            // Create client instance
            const clientResult = await this.createClient(configResult.data);
            if (isError(clientResult)) {
                return clientResult;
            }
            if (!isSuccess(clientResult)) {
                return createErrorResult(new Error('Failed to create client instance'));
            }
            const client = clientResult.data;
            // Add download
            const addOptions: AddDownloadOptions = {
                url,
                ...(options?.destination !== undefined && { destination: options.destination }),
                ...(options?.category !== undefined && { category: options.category }),
                ...(options?.paused !== undefined && { paused: options.paused })
            };
            const downloadResult = await client.addUrl(addOptions);
            if (!isSuccess(downloadResult)) {
                const errorMsg = isError(downloadResult)
                    ? downloadResult.error.message
                    : 'Unknown error occurred';
                logger.error(`Failed to add download to ${clientType}:`, { error: errorMsg, url });
                return createErrorResult(new Error(`Failed to add download to ${clientType}: ${errorMsg}`));
            }
            const downloadId = downloadResult.data["id"];
            logger.info(`Successfully sent download to ${clientType}: ${downloadId}`);
            return createSuccessResult({ downloadId });
        }
        catch (error: unknown) {
            const errorMessage = error instanceof Error
                ? error.message
                : String(error);
            logger.error(`Error sending to ${clientType}:`, error);
            return createErrorResult(new Error(errorMessage));
        }
    }
    /**
     * Creates a download client instance based on type and configuration
     *
     * @param config - Client configuration
     * @returns AsyncResult containing the client instance
     */
    private async createClient(config: BaseClientConfig): Promise<AsyncResult<BaseDownloadClient, Error>> {
        try {
            const factory = clientFactories[config.type];

            if (!factory) {
                return createErrorResult(
                    new Error(`Unsupported download client type: ${config.type}`)
                );
            }

            return await factory(config);
        }
        catch (error: unknown) {
            const errorMessage = error instanceof Error
                ? error.message
                : 'Failed to create download client';
            return createErrorResult(new Error(errorMessage));
        }
    }
    /**
     * Gets download client configuration from Config table
     *
     * @param clientType - Type of client to get config for
     * @returns AsyncResult containing the client configuration
     */
    private async getClientConfig(clientType: string): Promise<AsyncResult<TypedClientConfig, Error>> {
        try {
            // Validate client type
            const configBuilder = clientConfigBuilders[clientType];
            if (!configBuilder) {
                return createErrorResult(new Error(`Unknown client type: ${clientType}`));
            }

            // Query Config table directly to avoid initialization timing issues
            const configEntries = await this.prismaClient.config.findMany({
                where: {
                    key: {
                        startsWith: `download.${clientType}.`
                    }
                }
            });

            // Parse config entries into a map
            const configMap = new Map<string, string>();
            for (const entry of configEntries) {
                const key = entry.key.replace(`download.${clientType}.`, '');
                configMap.set(key, entry.value);
            }

            // Check if client is enabled
            if (!isClientEnabled(configMap)) {
                const displayName = clientDisplayNames[clientType] ?? clientType;
                return createErrorResult(new Error(`${displayName} is not enabled`));
            }

            // Build and return config using the appropriate builder
            const config = configBuilder(configMap);
            return createSuccessResult(config);
        }
        catch (error: unknown) {
            const errorMessage = error instanceof Error
                ? error.message
                : 'Failed to get client configuration';
            logger.error(`Failed to get client config for ${clientType}:`, error);
            return createErrorResult(new Error(errorMessage));
        }
    }
    /**
     * Get download status from client
     *
     * @param clientType - Type of download client
     * @param downloadId - Download ID to check
     * @returns AsyncResult with download status
     */
    async getDownloadStatus(clientType: string, downloadId: string): Promise<AsyncResult<unknown, Error>> {
        try {
            // Get client configuration
            const configResult = await this.getClientConfig(clientType);
            if (isError(configResult)) {
                return configResult;
            }
            if (!isSuccess(configResult)) {
                return createErrorResult(new Error('Failed to get client configuration'));
            }
            // Create client instance
            const clientResult = await this.createClient(configResult.data);
            if (isError(clientResult)) {
                return clientResult;
            }
            if (!isSuccess(clientResult)) {
                return createErrorResult(new Error('Failed to create client instance'));
            }
            const client = clientResult.data;
            // Get status
            const status = await client.getStatus(downloadId);
            return createSuccessResult(status);
        }
        catch (error: unknown) {
            const errorMessage = error instanceof Error
                ? error.message
                : 'Failed to get download status';
            return createErrorResult(new Error(errorMessage));
        }
    }
    /**
     * Remove download from client
     *
     * @param clientType - Type of download client
     * @param downloadId - Download ID to remove
     * @param deleteFiles - Whether to delete downloaded files
     * @returns AsyncResult indicating success
     */
    async removeDownload(clientType: string, downloadId: string, deleteFiles = false): Promise<AsyncResult<void, Error>> {
        try {
            // Get client configuration
            const configResult = await this.getClientConfig(clientType);
            if (isError(configResult)) {
                return configResult;
            }
            if (!isSuccess(configResult)) {
                return createErrorResult(new Error('Failed to get client configuration'));
            }
            // Create client instance
            const clientResult = await this.createClient(configResult.data);
            if (isError(clientResult)) {
                return clientResult;
            }
            if (!isSuccess(clientResult)) {
                return createErrorResult(new Error('Failed to create client instance'));
            }
            const client = clientResult.data;
            // Remove download
            const removeResult = await client.removeItem(downloadId, deleteFiles);
            if (!isSuccess(removeResult) || !removeResult.data) {
                return createErrorResult(new Error('Failed to remove download'));
            }
            return createSuccessResult(undefined);
        }
        catch (error: unknown) {
            const errorMessage = error instanceof Error
                ? error.message
                : 'Failed to remove download';
            return createErrorResult(new Error(errorMessage));
        }
    }
}
