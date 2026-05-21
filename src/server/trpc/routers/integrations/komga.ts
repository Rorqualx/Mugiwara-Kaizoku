import { Prisma } from '@prisma/client';
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
import { getConfig, getConfigArray, getConfigBoolean } from '@/server/utils/configReader';
import { getKomgaConfig, updateIntegrationSettings } from '@/server/utils/integration/integration-settings';
import { KomgaClient } from '@/server/utils/integration/komga';
import type { KomgaConfig } from '@/types/config.types';
import { toNumberId } from '@/utils/id-converters';
import { logger } from '@/utils/logger';



import { buildKomgaStatus, transformLibraries } from './komga-helpers';

import type { KomgaStatus } from './komga-helpers';

/**
 * Test Komga connection with reduced timeout for status checks
 * Exported for use by the main integrations router
 */
export async function testKomgaConnection(): Promise<CachedIntegrationStatus> {
  try {
    const config = await getKomgaConfig();
    const enabled = await getConfigBoolean('integration.komga.enabled', false);

    if (!config) {
      return createDefaultStatus(enabled, false);
    }

    const client = new KomgaClient(config);

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
    logger.error('Komga connection test failed:', error);
    return createErrorStatus(false, error instanceof Error ? error.message : 'Unknown error');
  }
}

/**
 * Type for Manga with Metadata relation
 */
type MangaWithMetadata = Prisma.MangaGetPayload<{
    include: {
        Metadata: true;
    };
}>;

/**
 * Response type for connection test
 */
interface TestConnectionResponse {
    success: boolean;
    message: string;
    serverInfo: {
        version: string;
        buildDate: string;
    };
}

/**
 * Response type for library operations
 */
interface LibraryResponse {
    success: boolean;
    libraries: Array<{
        id: string;
        name: string;
        root: string;
        type: string;
        unavailableDate?: string;
        isSelected: boolean;
        [key: string]: unknown;
    }>;
}

/**
 * Response type for sync operations
 */
interface SyncResponse {
    success: boolean;
    message: string;
}

/**
 * Komga Integration Router
 *
 * Provides tRPC endpoints for Komga media server integration.
 * Handles authentication (both Basic and API key), library management, and synchronization.
 */
/**
 * Input schema for testing Komga connection
 */
const testConnectionSchema = z.object({
    host: z.string().url().or(z.string().regex(/^https?:\/\/.+/)),
    authMethod: z.enum(['basic', 'apikey']),
    username: z.string().optional(),
    password: z.string().optional(),
    apiKey: z.string().optional()
}).refine(data => {
    if (data.authMethod === 'basic') {
        return !!(data.username && data.password);
    }
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Zod refine exhaustiveness check
    else if (data.authMethod === 'apikey') {
        return !!data.apiKey;
    }
    return false;
}, {
    message: 'Invalid authentication credentials for the selected method'
});
/**
 * Input schema for syncing a library
 */
const syncLibrarySchema = z.object({
    libraryId: z.string().min(1),
    deep: z.boolean().default(false)
});
/**
 * Input schema for syncing manga
 */
const syncMangaSchema = z.object({
    mangaId: z.union([z.string(), z.number()]),
    seriesId: z.string().optional()
});
export const komgaRouter = router({
    /**
     * Test connection to Komga server
     */
    testConnection: adminProcedure.input(testConnectionSchema).mutation(async ({ input }): Promise<TestConnectionResponse> => {
        try {
            logger.info(`Testing Komga connection to ${input.host} using ${input.authMethod} auth`);
            const komgaConfig: KomgaConfig = {
                enabled: true,
                type: 'komga',
                host: input.host,
                authMethod: input.authMethod,
                libraries: [],
                syncInterval: 60,
                autoSync: false,
                syncDirection: 'bidirectional',
                ...(input.username ? { username: input.username } : {}),
                ...(input.password ? { password: input.password } : {}),
                ...(input.apiKey ? { apiKey: input.apiKey } : {})
            };

            const client = new KomgaClient(komgaConfig);
            const isConnected = await client.testConnection();
            if (!isConnected) {
                throw new TRPCError({
                    code: 'BAD_REQUEST',
                    message: 'Failed to connect to Komga server. Please check your credentials and host URL.'
                });
            }
            // Try to get server info as additional validation
            const serverInfo = await client.getServerInfo();
            // Emit WebSocket event for real-time sync
            void realtimeEmitter.emitSystemEvent({
                eventType: 'komga:tested',
                source: 'komga-router',
                message: 'Komga connection test successful',
                data: { host: input.host, version: serverInfo.version },
            });
            return {
                success: true,
                message: 'Connection successful',
                serverInfo: {
                    version: serverInfo.version,
                    buildDate: serverInfo.buildDate
                }
            };
        }
        catch (error: unknown) {
            logger.error('Komga connection test failed:', error);
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
     * Get all libraries from Komga
     */
    getLibraries: protectedProcedure.query(async (): Promise<LibraryResponse> => {
        try {
            const config = await getKomgaConfig();
            const selectedLibraries = await getConfigArray<string>('integration.komga.libraries', []);

            if (!config) {
                throw new TRPCError({
                    code: 'PRECONDITION_FAILED',
                    message: 'Komga integration is not configured'
                });
            }
            // Validate auth credentials based on method
            if (config.authMethod === 'basic' && (!config.username || !config.password)) {
                throw new TRPCError({
                    code: 'PRECONDITION_FAILED',
                    message: 'Komga basic auth credentials are not configured'
                });
            }
            if (config.authMethod === 'apikey' && !config.apiKey) {
                throw new TRPCError({
                    code: 'PRECONDITION_FAILED',
                    message: 'Komga API key is not configured'
                });
            }
            const client = new KomgaClient(config);
            const libraries = await client.getLibraries();

            // Transform KomgaLibrary[] to RawKomgaLibrary[] format
            const rawLibraries = libraries.map(lib => {
                const unavailableDate: string | undefined = lib.unavailableDate;

                return {
                    id: lib.id,
                    name: lib.name,
                    root: lib.root,
                    type: lib.type ?? 'MANGA',
                    unavailableDate
                };
            });

            return {
                success: true,
                libraries: transformLibraries(rawLibraries, selectedLibraries)
            };
        }
        catch (error: unknown) {
            logger.error('Failed to get Komga libraries:', error);
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
    syncLibrary: adminProcedure.input(syncLibrarySchema).mutation(async ({ input }): Promise<SyncResponse> => {
        try {
            const config = await getKomgaConfig();
            if (!config) {
                throw new TRPCError({
                    code: 'PRECONDITION_FAILED',
                    message: 'Komga integration is not configured'
                });
            }
            logger.info(`Starting Komga library sync for library ID: ${input.libraryId} (deep: ${input.deep})`);
            const client = new KomgaClient(config);
            // Trigger library scan
            await client.scanLibrary(input.libraryId, input.deep);
            // Update last sync time
            await updateIntegrationSettings('komga', {
                lastSync: new Date().toISOString()
            });
            // Emit WebSocket event for real-time sync
            void realtimeEmitter.emitSystemEvent({
                eventType: 'komga:library:synced',
                source: 'komga-router',
                message: `Library scan initiated for library ${input.libraryId}`,
                data: { libraryId: input.libraryId, deep: input.deep },
            });
            return {
                success: true,
                message: `Library scan initiated for library ${input.libraryId}`
            };
        }
        catch (error: unknown) {
            logger.error('Komga library sync failed:', error);
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
     * Sync manga to Komga
     */
    syncManga: adminProcedure.input(syncMangaSchema).mutation(async ({ input, ctx }): Promise<SyncResponse> => {
        try {
            const config = await getKomgaConfig();
            if (!config) {
                throw new TRPCError({
                    code: 'PRECONDITION_FAILED',
                    message: 'Komga integration is not configured'
                });
            }
            const numericMangaId = toNumberId(input.mangaId);
            const manga: MangaWithMetadata | null = await ctx.prisma.manga.findUnique({
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
            logger.info(`Syncing manga "${manga.title}" to Komga`);
            const client = new KomgaClient(config);
            // If seriesId is provided, refresh its metadata
            if (input.seriesId) {
                await client.refreshSeriesMetadata(input.seriesId);
            }
            // Emit WebSocket event for real-time sync
            void realtimeEmitter.emitSystemEvent({
                eventType: 'komga:manga:synced',
                source: 'komga-router',
                message: `Manga "${manga.title}" synced to Komga`,
                data: { mangaId: numericMangaId, mangaTitle: manga.title, seriesId: input.seriesId },
            });
            return {
                success: true,
                message: `Manga "${manga.title}" synced to Komga`
            };
        }
        catch (error: unknown) {
            logger.error('Komga manga sync failed:', error);
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
     * Get Komga integration status
     */
    getStatus: protectedProcedure.query(async (): Promise<KomgaStatus> => {
        try {
            const config = await getKomgaConfig();
            const [enabled, hostValue, selectedLibraries] = await Promise.all([
                getConfigBoolean('integration.komga.enabled', false),
                getConfig('integration.komga.host'),
                getConfigArray<string>('integration.komga.libraries', [])
            ]);

            // Convert undefined to null for host (buildKomgaStatus expects string | null)
            const host = hostValue ?? null;

            return await buildKomgaStatus(config, enabled, host, selectedLibraries);
        }
        catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error('Failed to get Komga status:', errorMessage);
            throw new TRPCError({
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Failed to get status'
            });
        }
    })
});
