/**
 * Configuration tRPC Router
 *
 * This module provides a tRPC router for accessing the configuration system
 * through the API. It allows clients to get and set configuration values,
 * and provides methods for managing the configuration system.
 */
import { ConfigScope, ConfigSource} from '@prisma/client';
import { ConfigValueType } from '@prisma/client';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { configService } from '@/server/services/config/configService';
import { eventEmitter } from '@/server/services/eventEmitter';
import { realtimeEmitter } from '@/server/services/realtime/RealtimeEventEmitter';
import type { ConfigWithMetadata } from '@/types/search.types';
import { createContextualError } from '@/utils/async-result';
import { logger } from '@/utils/logger';


import { toTRPCError } from '../errors';
import { adminProcedure, protectedProcedure } from '../procedures';
import { router, } from '../trpc';
// Convert enum to Zod enum using actual enum values
const ConfigScopeEnum = z.enum([
    ConfigScope.SYSTEM,
    ConfigScope.USER,
    ConfigScope.INTEGRATION,
    ConfigScope.LIBRARY,
    ConfigScope.MANGA,
    ConfigScope.FEATURE,
    ConfigScope.GLOBAL
] as const);
// Convert enum to Zod enum using actual enum values
const ConfigSourceEnum = z.enum([
    ConfigSource.DATABASE,
    ConfigSource.ENV,
    ConfigSource.FILE,
    ConfigSource.OVERRIDE,
    ConfigSource.DEFAULT
] as const);
// Convert enum to Zod enum using actual enum values
const ConfigValueTypeEnum = z.enum([
    ConfigValueType.STRING,
    ConfigValueType.NUMBER,
    ConfigValueType.BOOLEAN,
    ConfigValueType.ARRAY,
    ConfigValueType.OBJECT,
    ConfigValueType.DATE,
    ConfigValueType.JSON
] as const);
/**
 * Configuration router for handling configuration operations
 */
export const configRouter = router({
    /**
     * Get all configuration values
     */
    getAll: protectedProcedure
        .query(async () => {
        const configs = await configService.getAll();
        return configs as Record<string, ConfigWithMetadata>;
    }),
    /**
     * Get a configuration value by key
     *
     * SECURITY: Changed from publicProcedure — arbitrary key access could
     * leak sensitive config (API keys, tokens). Theme/UI config should use
     * a dedicated public endpoint with key whitelisting if needed pre-auth.
     */
    get: protectedProcedure
        .input(z.object({
        key: z.string(),
        defaultValue: z.unknown().optional(),
        skipCache: z.boolean().optional()
    }))
        .mutation(async ({ input }): Promise<unknown> => {
        try {
            // If skipCache is true, force a database read
            if (input.skipCache) {
                // Currently no direct way to bypass cache in ConfigService, so we'll invalidate first
                configService.clearCache(input.key);
            }
            return await configService.get(input.key, input.defaultValue);
        }
        catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error(`Error getting config ${input.key}:`, error);
            throw toTRPCError(
                createContextualError(errorMessage, 'CONFIG_GET_ERROR', { key: input.key })
            );
        }
    }),
    /**
     * Get a configuration value with its metadata.
     *
     * Gated to authenticated users — config metadata leaks defaults, scopes,
     * and validation rules that are only useful to logged-in admins viewing
     * the settings pages. Public callers don't need this.
     */
    getWithMetadata: protectedProcedure
        .input(z.object({
        key: z.string()
    }))
        .query(async ({ input }): Promise<ConfigWithMetadata | null> => {
        const config = await configService.getWithMetadata(input.key);
        // Convert undefined to null for TanStack Query compatibility
        // TanStack Query does not accept undefined as a valid query result
        return config ?? null;
    }),
    /**
     * Set a configuration value
     */
    update: adminProcedure
        .input(z.object({
        key: z.string(),
        value: z.unknown(),
        scope: ConfigScopeEnum.optional(),
        source: ConfigSourceEnum.optional(),
        metadata: z.record(z.unknown()).optional()
    }))
        .mutation(async ({ input }) => {
        const options: {
            scope?: ConfigScope;
            source?: ConfigSource;
            metadata?: Record<string, unknown>;
        } = {};
        if (input.scope !== undefined) options.scope = input.scope;
        if (input["source"] !== undefined) options.source = input["source"];
        if (input.metadata !== undefined) options.metadata = input.metadata;

        await configService.set(input.key, input.value, options);
        // Emit settings updated notification
        await eventEmitter.emit('system:warning', {
            message: `Configuration updated: ${input.key}`,
            context: input.key
        });
        // Emit typed config event for in-process subscribers (e.g. live converter
        // (un)registration in conversion-initializer).
        eventEmitter.emit('config:updated', { key: input.key, value: input.value });
        // Emit WebSocket event for real-time sync
        void realtimeEmitter.emitSystemEvent({
            eventType: 'config:updated',
            source: 'config-router',
            message: `Configuration updated: ${input.key}`,
            data: { key: input.key },
        });
        logger.info(`Updated configuration: ${input.key}`);
        return true as boolean;
    }),
    /**
     * Set a configuration value with simpler API
     */
    set: adminProcedure
        .input(z.object({
        key: z.string(),
        value: z.unknown(),
        metadata: z.record(z.unknown()).optional()
    }))
        .mutation(async ({ input }): Promise<{ success: true }> => {
        try {
            const options: { metadata?: Record<string, unknown> } = {};
            if (input.metadata !== undefined) options.metadata = input.metadata;

            await configService.set(input.key, input.value, options);
            // Emit settings updated notification
            await eventEmitter.emit('system:warning', {
                message: `Configuration set: ${input.key}`,
                context: input.key
            });
            // Emit typed config event for in-process subscribers (e.g. live converter
            // (un)registration in conversion-initializer).
            eventEmitter.emit('config:updated', { key: input.key, value: input.value });
            // Emit WebSocket event for real-time sync
            void realtimeEmitter.emitSystemEvent({
                eventType: 'config:set',
                source: 'config-router',
                message: `Configuration set: ${input.key}`,
                data: { key: input.key },
            });
            logger.info(`Set configuration: ${input.key}`);
            return { success: true };
        }
        catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error(`Error setting config ${input.key}:`, error);
            // Throw TRPCError so callers' useMutation onError fires correctly. The previous
            // AsyncResult envelope let the caller's onSuccess fire on a "successful failure".
            throw new TRPCError({
                code: 'INTERNAL_SERVER_ERROR',
                message: `Failed to set ${input.key}: ${errorMessage}`,
            });
        }
    }),
    /**
     * Reset configuration to defaults
     */
    resetToDefaults: adminProcedure
        .input(z.object({
        scope: ConfigScopeEnum.optional()
    }))
        .mutation(async ({ input }) => {
        await configService.resetToDefaults(input.scope);
        // Emit WebSocket event for real-time sync
        void realtimeEmitter.emitSystemEvent({
            eventType: 'config:reset',
            source: 'config-router',
            message: `Configuration reset to defaults${input.scope ? ` for scope: ${input.scope}` : ''}`,
            data: { scope: input.scope },
        });
        logger.info(`Reset configuration to defaults${input.scope ? ` for scope: ${input.scope}` : ''}`);
        return true as boolean;
    }),
    /**
     * Get configuration values by scope
     */
    getByScope: protectedProcedure
        .input(z.object({
        scope: ConfigScopeEnum
    }))
        .query(async ({ input }) => {
        const configs = await configService.getByScope(input.scope);
        return configs as Record<string, ConfigWithMetadata>;
    }),
    /**
     * Get configuration values by category
     */
    getByCategory: protectedProcedure
        .input(z.object({
        category: z.string()
    }))
        .query(async ({ input }) => {
        const configs = await configService.getByCategory(input.category);
        return configs as Record<string, ConfigWithMetadata>;
    }),
    /**
     * Get configuration values by namespace
     */
    getByNamespace: protectedProcedure
        .input(z.object({
        namespace: z.string().optional()
    }))
        .mutation(async ({ input }): Promise<{values: Record<string, unknown>}> => {
        try {
            // If no namespace provided, get all configs
            const configs = input.namespace
                ? await configService.getByNamespace(input.namespace)
                : await configService.getAll();
            return {
                values: configs as Record<string, unknown>
            };
        }
        catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error(`Error getting configs by namespace ${input.namespace}:`, error);
            throw toTRPCError(
                createContextualError(errorMessage, 'CONFIG_NAMESPACE_ERROR', { namespace: input.namespace })
            );
        }
    }),
    /**
     * Get the complete application configuration
     */
    getAppConfig: protectedProcedure
        .query(async () => {
        const config = await configService.getAppConfig();
        return config;
    }),
    /**
     * Create a new configuration entry
     */
    create: adminProcedure
        .input(z.object({
        key: z.string(),
        value: z.unknown(),
        valueType: ConfigValueTypeEnum,
        scope: ConfigScopeEnum,
        source: ConfigSourceEnum.optional(),
        metadata: z.record(z.unknown()).optional()
    }))
        .mutation(async ({ input }) => {
        const key = String(input.key);
        // Safely convert enum values
        const valueType = input.valueType as ConfigValueType;
        const scope = input.scope as ConfigScope;
        const source = input["source"] as ConfigSource | undefined;

        const createInput: {
            key: string;
            value: unknown;
            valueType: ConfigValueType;
            scope: ConfigScope;
            source?: ConfigSource;
            metadata?: Record<string, unknown>;
        } = {
            key,
            value: input.value,
            valueType,
            scope,
            ...(source !== undefined ? { source } : {}),
            ...(input.metadata !== undefined ? { metadata: input.metadata } : {})
        };

        const config = await configService.create(createInput);
        logger.info(`Created configuration: ${input.key}`);
        return config;
    }),
    /**
     * Delete a configuration entry
     */
    delete: adminProcedure
        .input(z.object({
        key: z.string()
    }))
        .mutation(async ({ input }) => {
        await configService.delete(input.key);
        // Emit WebSocket event for real-time sync
        void realtimeEmitter.emitSystemEvent({
            eventType: 'config:deleted',
            source: 'config-router',
            message: `Configuration deleted: ${input.key}`,
            data: { key: input.key },
        });
        logger.info(`Deleted configuration: ${input.key}`);
        return true as boolean;
    }),
    /**
     * Export configuration to a file
     */
    exportToFile: protectedProcedure
        .input(z.object({
        filePath: z.string(),
        includeScopes: z.array(ConfigScopeEnum).optional()
    }))
        .mutation(async ({ input }) => {
        await configService.exportToFile(input.filePath, input.includeScopes);
        // Emit config exported notification
        await eventEmitter.emit('system:warning', {
            message: `Configuration exported to: ${input.filePath}`,
            context: input.filePath
        });
        logger.info(`Exported configuration to file: ${input.filePath}`);
        return true as boolean;
    }),
    /**
     * Import configuration from a file
     */
    importFromFile: adminProcedure
        .input(z.object({
        filePath: z.string(),
        overrideExisting: z.boolean().optional(),
        importScopes: z.array(ConfigScopeEnum).optional()
    }))
        .mutation(async ({ input }) => {
        const options: {
            overrideExisting?: boolean;
            importScopes?: ConfigScope[];
        } = {};
        if (input.overrideExisting !== undefined) options.overrideExisting = input.overrideExisting;
        if (input.importScopes !== undefined) options.importScopes = input.importScopes as ConfigScope[];

        await configService.importFromFile(input.filePath, options);
        // Emit config imported notification
        await eventEmitter.emit('system:warning', {
            message: `Configuration imported from: ${input.filePath}`,
            context: input.filePath
        });
        logger.info(`Imported configuration from file: ${input.filePath}`);
        return true as boolean;
    }),
    /**
     * Migrate from legacy settings
     */
    migrateFromLegacySettings: adminProcedure
        .mutation(async () => {
        await configService.migrateFromLegacySettings();
        logger.info('Migrated legacy settings to new configuration system');
        return true as boolean;
    })
});
