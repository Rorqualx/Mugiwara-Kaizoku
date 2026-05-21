import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import {
  createConnectedStatus,
  createDefaultStatus,
  createDisconnectedStatus,
  createErrorStatus,
  STATUS_CHECK_TIMEOUT_MS,
  type CachedIntegrationStatus
} from '@/server/services/integration/statusCache';
import { realtimeEmitter } from '@/server/services/realtime/RealtimeEventEmitter';
import { adminProcedure, protectedProcedure } from '@/server/trpc/procedures';
import { router } from '@/server/trpc/trpc';
import { getConfigArray, getConfig, getConfigBoolean } from '@/server/utils/configReader';
import { getKavitaConfig, updateIntegrationSettings } from '@/server/utils/integration/integration-settings';
import { KavitaClient } from '@/server/utils/integration/kavita';
import { toNumberId } from '@/utils/id-converters';
/**
 * Kavita Integration Router
 *
 * Provides tRPC endpoints for Kavita media server integration.
 * Handles authentication, library management, and synchronization.
 */
import { logger } from '@/utils/logger';

/**
 * Test Kavita connection with reduced timeout for status checks
 * Exported for use by the main integrations router
 */
export async function testKavitaConnection(): Promise<CachedIntegrationStatus> {
  try {
    const config = await getKavitaConfig();
    const enabled = await getConfigBoolean('integration.kavita.enabled', false);

    if (!config?.apiKey) {
      return createDefaultStatus(enabled, false);
    }

    const client = new KavitaClient(config);

    // Use AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => { controller.abort(); }, STATUS_CHECK_TIMEOUT_MS);

    try {
      const isConnected = await client.testConnection();
      clearTimeout(timeoutId);

      if (isConnected) {
        return createConnectedStatus(enabled);
      }
      return createDisconnectedStatus(enabled);
    } catch (error: unknown) {
      clearTimeout(timeoutId);
      const errorMessage = error instanceof Error ? error.message : 'Connection test failed';
      return createErrorStatus(enabled, errorMessage);
    }
  } catch (error: unknown) {
    logger.error('Kavita connection test failed:', error);
    return createErrorStatus(false, error instanceof Error ? error.message : 'Unknown error');
  }
}
/**
 * Input schema for testing Kavita connection
 */
const testConnectionSchema = z.object({
    host: z.string().url().or(z.string().regex(/^https?:\/\/.+/)),
    apiKey: z.string().min(1, 'API key is required')
});
/**
 * Input schema for syncing a library
 */
const syncLibrarySchema = z.object({
    libraryId: z.number().int().positive()
});
/**
 * Input schema for syncing manga
 */
const syncMangaSchema = z.object({
    mangaId: z.union([z.string(), z.number()]),
    seriesId: z.number().int().positive().optional()
});
export const kavitaRouter = router({
    /**
     * Test connection to Kavita server
     */
    testConnection: adminProcedure.input(testConnectionSchema).mutation(async ({ input }) => {
        try {
            logger.info(`Testing Kavita connection to ${input.host}`);
            const client = new KavitaClient({
                type: 'kavita',
                enabled: true,
                host: input.host,
                apiKey: input.apiKey,
                libraries: [],
                syncInterval: 60,
                autoSync: false,
                syncDirection: 'bidirectional'
            });
            const isConnected = await client.testConnection();
            if (!isConnected) {
                throw new TRPCError({
                    code: 'BAD_REQUEST',
                    message: 'Failed to connect to Kavita server. Please check your host URL and API key.'
                });
            }
            // Try to get server info as additional validation
            const serverInfo = await client.getServerInfo();
            // Emit WebSocket event for real-time sync
            void realtimeEmitter.emitSystemEvent({
                eventType: 'kavita:tested',
                source: 'kavita-router',
                message: 'Kavita connection test successful',
                data: { host: input.host, version: serverInfo.version },
            });
            return {
                success: true,
                message: 'Connection successful',
                serverInfo: {
                    version: serverInfo.version,
                    isDocker: serverInfo.isDocker
                }
            };
        }
        catch (error: unknown) {
            logger.error('Kavita connection test failed:', error);
            if (error instanceof TRPCError) {
                throw error;
            }
            throw new TRPCError({
                code: 'INTERNAL_SERVER_ERROR',
                message: error instanceof Error ? error.message : 'Failed to test connection'
            });
        }
    }),
    /**
     * Get all libraries from Kavita
     */
    getLibraries: protectedProcedure.query(async () => {
        try {
            const config = await getKavitaConfig();
            const selectedLibraries = await getConfigArray<string>('integration.kavita.libraries', []);

            if (!config?.apiKey) {
                throw new TRPCError({
                    code: 'PRECONDITION_FAILED',
                    message: 'Kavita integration is not configured'
                });
            }
            const client = new KavitaClient(config);
            const libraries = await client.getLibraries();
            return {
                success: true,
                libraries: libraries.map(lib => ({
                    id: lib["id"],
                    name: lib["name"],
                    type: lib.type,
                    folders: lib.folders,
                    lastScanned: lib.lastScanned,
                    isSelected: selectedLibraries.includes(lib["name"])
                }))
            };
        }
        catch (error: unknown) {
            logger.error('Failed to get Kavita libraries:', error);
            if (error instanceof TRPCError) {
                throw error;
            }
            throw new TRPCError({
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Failed to fetch libraries'
            });
        }
    }),
    /**
     * Sync a specific library
     */
    syncLibrary: adminProcedure.input(syncLibrarySchema).mutation(async ({ input }) => {
        try {
            const config = await getKavitaConfig();
            if (!config?.apiKey) {
                throw new TRPCError({
                    code: 'PRECONDITION_FAILED',
                    message: 'Kavita integration is not configured'
                });
            }
            logger.info(`Starting Kavita library sync for library ID: ${input.libraryId}`);
            const client = new KavitaClient(config);
            // Trigger library scan
            await client.scanLibrary(input.libraryId);
            // Update last sync time
            await updateIntegrationSettings('kavita', {
                lastSync: new Date().toISOString()
            });
            // Emit WebSocket event for real-time sync
            void realtimeEmitter.emitSystemEvent({
                eventType: 'kavita:library:synced',
                source: 'kavita-router',
                message: `Library sync initiated for library ${input.libraryId}`,
                data: { libraryId: input.libraryId },
            });
            return {
                success: true,
                message: `Library sync initiated for library ${input.libraryId}`
            };
        }
        catch (error: unknown) {
            logger.error('Kavita library sync failed:', error);
            if (error instanceof TRPCError) {
                throw error;
            }
            throw new TRPCError({
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Failed to sync library'
            });
        }
    }),
    /**
     * Sync manga to Kavita
     */
    syncManga: adminProcedure.input(syncMangaSchema).mutation(async ({ input, ctx }) => {
        try {
            const config = await getKavitaConfig();
            if (!config?.apiKey) {
                throw new TRPCError({
                    code: 'PRECONDITION_FAILED',
                    message: 'Kavita integration is not configured'
                });
            }
            const numericMangaId = toNumberId(input.mangaId);
            const manga = await ctx.prisma.manga.findUnique({
                where: {
                    id: numericMangaId
                },
                include: {
                    Metadata: true
                }
            });
            if (!manga) {
                throw new TRPCError({
                    code: 'NOT_FOUND',
                    message: 'Manga not found'
                });
            }
            logger.info(`Syncing manga "${manga["title"]}" to Kavita`);
            const client = new KavitaClient(config);
            // If seriesId is provided, refresh its metadata
            if (input.seriesId) {
                await client.refreshSeriesMetadata(input.seriesId);
            }
            // Emit WebSocket event for real-time sync
            void realtimeEmitter.emitSystemEvent({
                eventType: 'kavita:manga:synced',
                source: 'kavita-router',
                message: `Manga "${manga["title"]}" synced to Kavita`,
                data: { mangaId: numericMangaId, mangaTitle: manga["title"], seriesId: input.seriesId },
            });
            return {
                success: true,
                message: `Manga "${manga["title"]}" synced to Kavita`
            };
        }
        catch (error: unknown) {
            logger.error('Kavita manga sync failed:', error);
            if (error instanceof TRPCError) {
                throw error;
            }
            throw new TRPCError({
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Failed to sync manga'
            });
        }
    }),
    /**
     * Get Kavita integration status
     */
    getStatus: protectedProcedure.query(async () => {
        try {
            const config = await getKavitaConfig();
            const [enabled, host, selectedLibraries] = await Promise.all([
                getConfigBoolean('integration.kavita.enabled', false),
                getConfig('integration.kavita.host'),
                getConfigArray<string>('integration.kavita.libraries', [])
            ]);

            const status = {
                enabled,
                configured: !!(config?.apiKey),
                host,
                lastSync: config?.lastSync,
                autoSync: config?.autoSync ?? false,
                syncInterval: config?.syncInterval ?? 60,
                syncDirection: config?.syncDirection ?? 'bidirectional',
                selectedLibraries
            };
            // If configured, try to get connection status
            if (status.configured && status.enabled && config) {
                try {
                    const client = new KavitaClient(config);
                    const isConnected = await client.testConnection();
                    return {
                        ...status,
                        connectionStatus: isConnected ? ('connected' as const) : ('disconnected' as const),
                        connectionError: isConnected ? null : 'Unable to connect to server'
                    };
                }
                catch (error: unknown) {
                    return {
                        ...status,
                        connectionStatus: 'error' as const,
                        connectionError: error instanceof Error ? error.message : 'Unknown error'
                    };
                }
            }
            return {
                ...status,
                connectionStatus: 'not-configured' as const,
                connectionError: null
            };
        }
        catch (error: unknown) {const errorMessage = error instanceof Error ? error.message : String(error);
logger.error('Failed to get Kavita status:', errorMessage);
            throw new TRPCError({
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Failed to get status'
            });
        }
    })
});
