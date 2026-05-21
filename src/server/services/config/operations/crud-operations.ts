/**
 * Configuration CRUD Operations
 *
 * Functions for creating, reading, updating, and deleting configuration values:
 * - set: Update or create configuration
 * - create: Create new configuration entry
 * - update: Update existing configuration
 * - delete/remove: Delete configuration
 *
 * Extracted from: configService.ts (lines 323-369, 611-824)
 */


import { ConfigValueType, ConfigScope, ConfigSource } from '@prisma/client';

import { prisma } from '@/server/db';
import { realtimeEmitter } from '@/server/services/realtime/RealtimeEventEmitter';
import { ValidationError } from '@/utils/errors';
import { logger } from '@/utils/logger';


import { saveToDatabase, saveToFile, deleteFromDatabase, saveBatchToDatabase, SaveToDatabaseOptions } from '../config-persistence';
import { removeFieldsFromObject, buildSetMetadata, buildCreateMetadata } from '../helpers/metadata-builders';
import { getSourcePriority, detectValueType, stringifyValue } from '../helpers/value-converters';

import type {
  ConfigMetadata,
  ConfigEntity,
  CreateConfigInput,
  UpdateConfigInput,
  ConfigServiceMetadata,
  PrismaWithConfig
} from '../config-types';


/**
 * Context interface for CRUD operations
 */
export interface CrudContext {
  cache: Map<string, ConfigServiceMetadata<unknown>>;
  initialized: boolean;
  initialize: () => Promise<void>;
  configFilePath: string;
}

/**
 * Set configuration value with priority checking
 */
export async function set<T = unknown>(
  ctx: CrudContext,
  key: string,
  value: T,
  options?: {
    scope?: ConfigScope;
    valueType?: ConfigValueType;
    source?: ConfigSource;
    metadata?: Partial<ConfigMetadata>;
  }
): Promise<void> {
  if (!ctx.initialized) await ctx.initialize();

  const source = options?.source ?? ConfigSource.DATABASE;
  const existing = ctx.cache.get(key);

  if (existing && getSourcePriority(existing.source) > getSourcePriority(source)) {
    logger.warn(`Not updating config ${key} from ${source} because ${existing.source} has higher priority`);
    return;
  }

  const valueType = options?.valueType ?? detectValueType(value);
  const scope = options?.scope ?? existing?.metadata.scope ?? ConfigScope.SYSTEM;

  const metadata = buildSetMetadata(key, valueType, scope, existing, options?.metadata);
  const cleanedMetadata = removeFieldsFromObject(metadata, ['scope', 'valueType']) as ConfigMetadata;

  ctx.cache.set(key, {
    value,
    metadata: cleanedMetadata,
    source,
    updatedAt: new Date()
  });

  if (source === ConfigSource.DATABASE) {
    await saveToDatabase({
      key,
      value,
      valueType,
      scope,
      metadata: cleanedMetadata,
      stringifyValue,
      removeFieldsFromObject
    });
  } else if (source === ConfigSource.FILE) {
    await saveToFile(ctx.configFilePath, ctx.cache);
  }

  // Emit WebSocket event for config update
  void realtimeEmitter.emitSystemEvent({
    eventType: 'config:updated',
    source: 'configService',
    message: `Configuration "${key}" updated`,
    data: { key, scope, source }
  });
}

/**
 * Set multiple configuration values atomically with priority checking
 */
export async function setBatch(
  ctx: CrudContext,
  items: Array<{
    key: string;
    value: unknown;
    options?: {
      scope?: ConfigScope;
      valueType?: ConfigValueType;
      source?: ConfigSource;
      metadata?: Partial<ConfigMetadata>;
    };
  }>
): Promise<void> {
  if (!ctx.initialized) await ctx.initialize();

  const databaseItems: Array<SaveToDatabaseOptions> = [];
  let hasFileSource = false;

  // Process each item
  for (const item of items) {
    const { key, value, options } = item;
    const source = options?.source ?? ConfigSource.DATABASE;
    const existing = ctx.cache.get(key);

    // Priority check
    if (existing && getSourcePriority(existing.source) > getSourcePriority(source)) {
      logger.warn(`Not updating config ${key} from ${source} because ${existing.source} has higher priority`);
      continue;
    }

    const valueType = options?.valueType ?? detectValueType(value);
    const scope = options?.scope ?? existing?.metadata.scope ?? ConfigScope.SYSTEM;

    const metadata = buildSetMetadata(key, valueType, scope, existing, options?.metadata);
    const cleanedMetadata = removeFieldsFromObject(metadata, ['scope', 'valueType']) as ConfigMetadata;

    // Update cache
    ctx.cache.set(key, {
      value,
      metadata: cleanedMetadata,
      source,
      updatedAt: new Date()
    });

    // Collect items for database batch save
    if (source === ConfigSource.DATABASE) {
      databaseItems.push({
        key,
        value,
        valueType,
        scope,
        metadata: cleanedMetadata,
        stringifyValue,
        removeFieldsFromObject
      });
    } else if (source === ConfigSource.FILE) {
      hasFileSource = true;
    }
    // Other sources (ENV, DEFAULT) don't need persistence
  }

  // Perform atomic database save if any DATABASE items
  if (databaseItems.length > 0) {
    await saveBatchToDatabase(databaseItems);
  }

  // Save to file if any FILE items
  if (hasFileSource) {
    await saveToFile(ctx.configFilePath, ctx.cache);
  }

  // Emit WebSocket event for batch config update
  const updatedKeys = items.map(item => item.key);
  void realtimeEmitter.emitSystemEvent({
    eventType: 'config:batch:updated',
    source: 'configService',
    message: `${updatedKeys.length} configuration(s) updated`,
    data: { keys: updatedKeys, count: updatedKeys.length }
  });
}

/**
 * Create new configuration entry
 */
export async function create(
  ctx: CrudContext,
  input?: CreateConfigInput
): Promise<ConfigEntity> {
  if (!ctx.initialized) await ctx.initialize();

  if (!input) {
    return {
      id: 0,
      key: '',
      value: '',
      valueType: ConfigValueType.STRING,
      scope: ConfigScope.SYSTEM,
      source: ConfigSource.DEFAULT,
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  try {
    const { key, value, valueType, scope, source = ConfigSource.DATABASE, metadata } = input;

    if (ctx.cache.has(key)) {
      throw new ValidationError(`Configuration key '${key}' already exists`);
    }

    const fullMetadata = buildCreateMetadata(key, valueType, scope, metadata);
    const stringValue = stringifyValue(value, valueType);
    const cleanedMetadata = removeFieldsFromObject(fullMetadata, ['scope', 'valueType']);

    const config = await (prisma as unknown as PrismaWithConfig).Config.create({
      data: {
        key,
        value: stringValue,
        valueType,
        scope,
        source,
        metadata: cleanedMetadata as Record<string, unknown>
      },
      select: {
        key: true,
        value: true,
        valueType: true,
        scope: true,
        source: true,
        metadata: true,
        createdAt: true,
        updatedAt: true
      }
    });

    ctx.cache.set(key, {
      value,
      metadata: fullMetadata,
      source,
      updatedAt: config.updatedAt
    });

    // Emit WebSocket event for config creation
    void realtimeEmitter.emitSystemEvent({
      eventType: 'config:created',
      source: 'configService',
      message: `Configuration "${key}" created`,
      data: { key, scope, source, valueType }
    });

    return {
      id: 0,
      key: config.key,
      value: stringValue,
      valueType,
      scope,
      source,
      metadata: fullMetadata as unknown as Record<string, unknown>,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to create configuration: ${errorMessage}`);
    throw new Error(`Failed to create configuration: ${error}`);
  }
}

/**
 * Update existing configuration
 */
export async function update(
  ctx: CrudContext,
  key?: string,
  input?: UpdateConfigInput
): Promise<ConfigEntity> {
  if (!ctx.initialized) await ctx.initialize();

  if (!key || !input) {
    return {
      id: 0,
      key: '',
      value: '',
      valueType: ConfigValueType.STRING,
      scope: ConfigScope.SYSTEM,
      source: ConfigSource.DEFAULT,
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  try {
    const { value, metadata, source } = input;
    const existing = ctx.cache.get(key);

    if (!existing) {
      throw new ValidationError(`Configuration key '${key}' not found`);
    }

    const updateValue = value !== undefined ? value : existing.value;
    const updateSource = source ?? existing.source;

    if (updateSource === ConfigSource.DATABASE) {
      const dbConfig = await (prisma as unknown as PrismaWithConfig).Config.findUnique({
        where: { key }
      });

      if (!dbConfig) {
        throw new ValidationError(`Configuration key '${key}' not found in database`);
      }

      const updateMetadata: ConfigMetadata = {
        ...existing.metadata,
        ...(metadata ?? {})
      };

      const valueType = existing.metadata.type;
      const stringValue = stringifyValue(updateValue, valueType);
      const cleanedMetadata = removeFieldsFromObject(updateMetadata, ['scope', 'valueType']);

      const config = await (prisma as unknown as PrismaWithConfig).Config.update({
        where: { key: dbConfig.key },
        data: {
          value: stringValue,
          metadata: cleanedMetadata as Record<string, unknown>,
          source: updateSource
        },
        select: {
          key: true,
          value: true,
          valueType: true,
          scope: true,
          source: true,
          metadata: true,
          createdAt: true,
          updatedAt: true
        }
      });

      ctx.cache.set(key, {
        value: updateValue,
        metadata: updateMetadata,
        source: updateSource,
        updatedAt: config.updatedAt
      });

      // Emit WebSocket event for config update (database source)
      void realtimeEmitter.emitSystemEvent({
        eventType: 'config:updated',
        source: 'configService',
        message: `Configuration "${key}" updated`,
        data: { key, scope: updateMetadata.scope, source: updateSource }
      });

      return {
        id: 0,
        key: config.key,
        value: stringValue,
        valueType: updateMetadata.type,
        scope: updateMetadata.scope,
        source: updateSource,
        metadata: updateMetadata as unknown as Record<string, unknown>,
        createdAt: config.createdAt,
        updatedAt: config.updatedAt
      };
    } else {
      const updatedMetadata: ConfigMetadata = {
        ...existing.metadata,
        ...(metadata ?? {})
      };

      const now = new Date();

      ctx.cache.set(key, {
        value: updateValue,
        metadata: updatedMetadata,
        source: updateSource,
        updatedAt: now
      });

      if (updateSource === ConfigSource.FILE) {
        await saveToFile(ctx.configFilePath, ctx.cache);
      }

      // Emit WebSocket event for config update (non-database source)
      void realtimeEmitter.emitSystemEvent({
        eventType: 'config:updated',
        source: 'configService',
        message: `Configuration "${key}" updated`,
        data: { key, scope: updatedMetadata.scope, source: updateSource }
      });

      return {
        id: 0,
        key,
        value: stringifyValue(updateValue, updatedMetadata.type),
        valueType: updatedMetadata.type,
        scope: updatedMetadata.scope,
        source: updateSource,
        metadata: updatedMetadata as unknown as Record<string, unknown>,
        createdAt: now,
        updatedAt: now
      };
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to update configuration: ${errorMessage}`);
    throw new Error(`Failed to update configuration: ${error}`);
  }
}

/**
 * Delete configuration by key
 */
export async function deleteConfig(
  ctx: CrudContext,
  key?: string
): Promise<void> {
  if (!ctx.initialized) await ctx.initialize();

  if (!key) return;

  try {
    ctx.cache.delete(key);
    await deleteFromDatabase(key);
    logger.info(`Deleted configuration: ${key}`);

    // Emit WebSocket event for config deletion
    void realtimeEmitter.emitSystemEvent({
      eventType: 'config:deleted',
      source: 'configService',
      message: `Configuration "${key}" deleted`,
      data: { key }
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to delete configuration: ${errorMessage}`);
    throw new Error(`Failed to delete configuration: ${error}`);
  }
}

/**
 * Alias for deleteConfig
 */
export async function remove(ctx: CrudContext, key?: string): Promise<void> {
  return deleteConfig(ctx, key);
}
