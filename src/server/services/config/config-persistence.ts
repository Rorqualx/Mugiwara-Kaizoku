/**
 * Configuration Persistence Module
 *
 * This module handles loading and saving configuration from/to
 * various sources: database, files, and environment variables.
 */

import * as fs from 'fs/promises';

import { ConfigValueType } from '@prisma/client';
import { ConfigScope, ConfigSource } from '@prisma/client';

import { prisma } from '@/server/db';
import { logger } from '@/utils/logger';



import type { ConfigMetadata, ConfigServiceMetadata, PrismaWithConfig } from './config-types';

/**
 * Loads configuration from the database
 */
export async function loadFromDatabase(
  cache: Map<string, ConfigServiceMetadata<unknown>>,
  parseValue: (value: string, type: ConfigValueType) => unknown
): Promise<void> {
  try {
    // Check if Config model exists in Prisma
    if (!('Config' in prisma)) {
      logger.debug('Config model not found in Prisma schema, skipping database configuration loading');
      return;
    }

    // Load all configuration entries from the database
    const dbConfigs = await (prisma as unknown as PrismaWithConfig).Config.findMany();

    // Add each entry to the cache
    for (const config of dbConfigs) {
      const key = config.key;
      // Handle null/undefined metadata with sensible defaults
      const rawMetadata = config.metadata as unknown as ConfigMetadata | null;
      const metadata: ConfigMetadata = rawMetadata ?? {
        key,
        label: key,
        type: config.valueType as ConfigValueType,
        scope: ConfigScope.SYSTEM,
        category: 'Uncategorized'
      };

      cache.set(key, {
        value: parseValue(config.value as string, config.valueType as ConfigValueType),
        metadata,
        source: ConfigSource.DATABASE,
        updatedAt: config.updatedAt
      });
    }

    logger.info(`Loaded ${dbConfigs.length} configuration entries from database`);
  } catch (_error: unknown) {
    // Silently skip if Config table doesn't exist
    logger.debug('Config table not available, using defaults and environment variables');
  }
}

/**
 * Options for saving configuration to database
 */
export interface SaveToDatabaseOptions {
  key: string;
  value: unknown;
  valueType: ConfigValueType;
  scope: ConfigScope;
  metadata: ConfigMetadata;
  stringifyValue: (value: unknown, type: ConfigValueType) => string;
  removeFieldsFromObject: (obj: unknown, fieldsToRemove: string[]) => unknown;
}

/**
 * Saves a configuration value to the database
 */
export async function saveToDatabase(options: SaveToDatabaseOptions): Promise<void> {
  const { key, value, valueType, scope, metadata, stringifyValue, removeFieldsFromObject } = options;
  try {
    // Check if Config model exists in Prisma
    if (!('Config' in prisma)) {
      logger.debug('Config model not available, skipping database save');
      return;
    }

    // Check if the configuration already exists
    const existing = await (prisma as unknown as PrismaWithConfig).Config.findUnique({
      where: { key }
    });

    const stringValue = stringifyValue(value, valueType);

    // Remove scope and valueType from metadata at all levels to avoid conflicts
    const cleanMetadata = removeFieldsFromObject(metadata, ['scope', 'valueType']);

    // Ensure scope is a valid ConfigScope enum value
    let validScope = scope;
    if (typeof scope === 'string') {
      const scopeMap: Record<string, ConfigScope> = {
        'GLOBAL': ConfigScope.GLOBAL,
        'LIBRARY': ConfigScope.LIBRARY,
        'MANGA': ConfigScope.MANGA,
        'USER': ConfigScope.USER,
        'SYSTEM': ConfigScope.SYSTEM,
        'INTEGRATION': ConfigScope.INTEGRATION,
        'FEATURE': ConfigScope.FEATURE,
        'global': ConfigScope.GLOBAL,
        'library': ConfigScope.LIBRARY,
        'manga': ConfigScope.MANGA,
        'user': ConfigScope.USER,
        'system': ConfigScope.SYSTEM,
        'integration': ConfigScope.INTEGRATION,
        'feature': ConfigScope.FEATURE
      };
      validScope = scopeMap[scope as string] ?? ConfigScope.SYSTEM;
    }

    // Ensure valueType is a valid ConfigValueType enum value
    let validValueType = valueType;
    if (typeof valueType === 'string') {
      const valueTypeMap: Record<string, ConfigValueType> = {
        'STRING': ConfigValueType.STRING,
        'NUMBER': ConfigValueType.NUMBER,
        'BOOLEAN': ConfigValueType.BOOLEAN,
        'OBJECT': ConfigValueType.OBJECT,
        'ARRAY': ConfigValueType.ARRAY,
        'string': ConfigValueType.STRING,
        'number': ConfigValueType.NUMBER,
        'boolean': ConfigValueType.BOOLEAN,
        'object': ConfigValueType.OBJECT,
        'array': ConfigValueType.ARRAY
      };
      validValueType = valueTypeMap[valueType as string] ?? ConfigValueType.STRING;
    }

    if (existing) {
      // Update existing configuration
      await (prisma as unknown as PrismaWithConfig).Config.update({
        where: { key: key },
        data: {
          value: stringValue,
          valueType: validValueType,
          scope: validScope,
          metadata: cleanMetadata as Record<string, unknown>,
          updatedAt: new Date()
        }
      });
    } else {
      // Create new configuration
      await (prisma as unknown as PrismaWithConfig).Config.create({
        data: {
          key,
          value: stringValue,
          valueType: validValueType,
          scope: validScope,
          source: ConfigSource.DATABASE,
          metadata: cleanMetadata as Record<string, unknown>
        }
      });
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to save configuration to database: ${errorMessage}`);
    throw new Error(`Failed to save configuration: ${error}`);
  }
}

/**
 * Saves multiple configuration values to the database atomically using transaction
 */
export async function saveBatchToDatabase(options: SaveToDatabaseOptions[]): Promise<void> {
  if (options.length === 0) {
    return;
  }

  try {
    // Check if Config model exists in Prisma
    if (!('Config' in prisma)) {
      logger.debug('Config model not available, skipping database batch save');
      return;
    }

    // Use Prisma transaction for atomicity
    await (prisma as unknown as PrismaWithConfig).$transaction(async (tx: PrismaWithConfig) => {
      /* eslint-disable no-await-in-loop */
      for (const option of options) {
        const { key, value, valueType, scope, metadata, stringifyValue, removeFieldsFromObject } = option;

        // Check if the configuration already exists
        const existing = await tx.Config.findUnique({
          where: { key }
        });

        const stringValue = stringifyValue(value, valueType);

        // Remove scope and valueType from metadata at all levels to avoid conflicts
        const cleanMetadata = removeFieldsFromObject(metadata, ['scope', 'valueType']);

        // Ensure scope is a valid ConfigScope enum value
        let validScope = scope;
        if (typeof scope === 'string') {
          const scopeMap: Record<string, ConfigScope> = {
            'GLOBAL': ConfigScope.GLOBAL,
            'LIBRARY': ConfigScope.LIBRARY,
            'MANGA': ConfigScope.MANGA,
            'USER': ConfigScope.USER,
            'SYSTEM': ConfigScope.SYSTEM,
            'INTEGRATION': ConfigScope.INTEGRATION,
            'FEATURE': ConfigScope.FEATURE,
            'global': ConfigScope.GLOBAL,
            'library': ConfigScope.LIBRARY,
            'manga': ConfigScope.MANGA,
            'user': ConfigScope.USER,
            'system': ConfigScope.SYSTEM,
            'integration': ConfigScope.INTEGRATION,
            'feature': ConfigScope.FEATURE
          };
          validScope = scopeMap[scope as string] ?? ConfigScope.SYSTEM;
        }

        // Ensure valueType is a valid ConfigValueType enum value
        let validValueType = valueType;
        if (typeof valueType === 'string') {
          const valueTypeMap: Record<string, ConfigValueType> = {
            'STRING': ConfigValueType.STRING,
            'NUMBER': ConfigValueType.NUMBER,
            'BOOLEAN': ConfigValueType.BOOLEAN,
            'OBJECT': ConfigValueType.OBJECT,
            'ARRAY': ConfigValueType.ARRAY,
            'string': ConfigValueType.STRING,
            'number': ConfigValueType.NUMBER,
            'boolean': ConfigValueType.BOOLEAN,
            'object': ConfigValueType.OBJECT,
            'array': ConfigValueType.ARRAY
          };
          validValueType = valueTypeMap[valueType as string] ?? ConfigValueType.STRING;
        }

        if (existing) {
          // Update existing configuration
          await tx.Config.update({
            where: { key: key },
            data: {
              value: stringValue,
              valueType: validValueType,
              scope: validScope,
              metadata: cleanMetadata as Record<string, unknown>,
              updatedAt: new Date()
            }
          });
        } else {
          // Create new configuration
          await tx.Config.create({
            data: {
              key,
              value: stringValue,
              valueType: validValueType,
              scope: validScope,
              source: ConfigSource.DATABASE,
              metadata: cleanMetadata as Record<string, unknown>
            }
          });
        }
      }
      /* eslint-enable no-await-in-loop */
    });

    logger.info(`Successfully saved ${options.length} configuration entries atomically`);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to save batch configuration to database: ${errorMessage}`);
    throw new Error(`Failed to save batch configuration: ${error}`);
  }
}

/**
 * Loads configuration from file
 */
export async function loadFromFile(
  configFilePath: string,
  cache: Map<string, ConfigServiceMetadata<unknown>>,
  getSourcePriority: (source: ConfigSource) => number,
  detectValueType: (value: unknown) => ConfigValueType
): Promise<void> {
  try {
    // Check if the configuration file exists
    try {
      await fs.access(configFilePath);
    } catch (_error: unknown) {
      logger.info('Configuration file does not exist, skipping file loading');
      return;
    }

    // Read and parse the configuration file
    const fileContent = await fs.readFile(configFilePath, 'utf-8');
    const fileConfig = JSON.parse(fileContent) as Record<string, unknown>;

    // Add each entry to the cache, but only if it doesn't exist or has higher priority
    for (const [key, value] of Object.entries(fileConfig)) {
      const existing = cache.get(key);

      // Only override if the existing value is not from a higher priority source
      if (!existing || getSourcePriority(existing.source) < getSourcePriority(ConfigSource.FILE)) {
        // Create metadata with required fields first
        const fileMetadata: ConfigMetadata = existing?.metadata ?? {
          key,
          label: key,
          type: detectValueType(value),
          scope: ConfigScope.SYSTEM,
          category: 'File Config'
        };

        cache.set(key, {
          value,
          metadata: fileMetadata,
          source: ConfigSource.FILE,
          updatedAt: new Date()
        });
      }
    }

    logger.info(`Loaded configuration from file: ${configFilePath}`);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to load configuration from file: ${errorMessage}`);
  }
}

/**
 * Saves configuration to file
 */
export async function saveToFile(
  configFilePath: string,
  cache: Map<string, ConfigServiceMetadata<unknown>>
): Promise<void> {
  try {
    // Collect all configuration from FILE source
    const fileConfig: Record<string, unknown> = {};

    for (const [key, config] of Array.from(cache.entries())) {
      if (config.source === ConfigSource.FILE) {
        fileConfig[key] = config.value;
      }
    }

    // Write to file
    await fs.writeFile(configFilePath, JSON.stringify(fileConfig, null, 2), 'utf-8');
    logger.info(`Saved configuration to file: ${configFilePath}`);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to save configuration to file: ${errorMessage}`);
    throw new Error(`Failed to save configuration to file: ${error}`);
  }
}

/**
 * Loads configuration from environment variables
 */
export function loadFromEnvironment(
  cache: Map<string, ConfigServiceMetadata<unknown>>,
  getSourcePriority: (source: ConfigSource) => number,
  detectValueType: (value: unknown) => ConfigValueType,
  parseValue: (value: string, type: ConfigValueType) => unknown
): void {
  try {
    // Process environment variables starting with APP_CONFIG_
    const configVars = Object.entries(process.env).filter(([key]) => key.startsWith('APP_CONFIG_'));

    for (const [envKey, value] of configVars) {
      // Convert environment variable name to config key
      // APP_CONFIG_SERVER_PORT -> server.port
      const key = envKey
        .replace('APP_CONFIG_', '')
        .toLowerCase()
        .replace(/_/g, '.');

      const existing = cache.get(key);

      // Determine value type and parse the value
      let parsedValue: unknown = value;
      const valueType = existing?.metadata.type ?? detectValueType(value);
      parsedValue = parseValue(value as string, valueType);

      // Only override if the existing value is not from a higher priority source
      if (!existing || getSourcePriority(existing.source) < getSourcePriority(ConfigSource.ENV)) {
        // Create metadata with required fields first
        const envMetadata: ConfigMetadata = existing?.metadata ?? {
          key,
          label: key,
          type: valueType,
          scope: ConfigScope.SYSTEM,
          category: 'Environment'
        };

        cache.set(key, {
          value: parsedValue,
          metadata: envMetadata,
          source: ConfigSource.ENV,
          updatedAt: new Date()
        });
      }
    }

    logger.info(`Loaded ${configVars.length} configuration entries from environment variables`);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to load configuration from environment variables: ${errorMessage}`);
  }
}

/**
 * Deletes a configuration entry from the database
 */
export async function deleteFromDatabase(key: string): Promise<void> {
  try {
    if ('Config' in prisma) {
      await (prisma as unknown as PrismaWithConfig).Config.deleteMany({
        where: { key }
      });
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to delete configuration from database: ${errorMessage}`);
    throw error;
  }
}

/**
 * Exports configuration to a file
 */
export async function exportToFile(
  filePath: string,
  cache: Map<string, ConfigServiceMetadata<unknown>>,
  includeScopes: ConfigScope[] | undefined,
  convertToDomainConfig: <T>(key: string, config: ConfigServiceMetadata<T>) => unknown
): Promise<void> {
  try {
    // Collect configuration to export
    const exportConfig: Record<string, unknown> = {};

    for (const [key, config] of Array.from(cache.entries())) {
      // Include all scopes or only specified scopes
      if (!includeScopes || includeScopes.includes(config.metadata.scope)) {
        exportConfig[key] = convertToDomainConfig(key, config);
      }
    }

    // Write to file
    await fs.writeFile(filePath, JSON.stringify(exportConfig, null, 2), 'utf-8');
    logger.info(`Exported configuration to file: ${filePath}`);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to export configuration to file: ${errorMessage}`);
    throw new Error(`Failed to export configuration: ${error}`);
  }
}
