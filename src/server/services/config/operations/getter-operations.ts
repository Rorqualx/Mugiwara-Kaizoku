/**
 * Configuration Getter Operations
 *
 * Functions for retrieving configuration values in various formats:
 * - Single value retrieval
 * - Metadata-enriched retrieval
 * - Bulk retrieval by scope/category/namespace
 * - Typed configuration objects
 * - Full AppConfig construction
 *
 * Extracted from: configService.ts (lines 293-483)
 */

import { ConfigScope } from '@prisma/client';

import type { AppConfig, ConfigWithMetadata as DomainConfigWithMetadata } from '@/types/search.types';



import type { ConfigServiceMetadata } from '../config-types';

/**
 * Context interface for getter operations
 * Provides access to cache, defaults, and initialization
 */
export interface GetterContext {
  cache: Map<string, ConfigServiceMetadata<unknown>>;
  defaultConfig: Record<string, ConfigServiceMetadata<unknown>>;
  initialized: boolean;
  initialize: () => Promise<void>;
  loadDefaults: () => void;
}

/**
 * Convert internal config metadata to domain config format
 * Handles null/undefined metadata gracefully with sensible defaults
 */
function convertToDomainConfig<T = unknown>(
  key: string,
  config: ConfigServiceMetadata<T>
): DomainConfigWithMetadata<T> {
  // Handle null/undefined metadata with defaults using bracket notation for index signature access
  const rawMetadata = config.metadata as unknown as Record<string, unknown> | null | undefined;
  const scope = rawMetadata?.['scope'] ?? ConfigScope.SYSTEM;
  const category = (rawMetadata?.['category'] as string | undefined) ?? 'Uncategorized';
  const description = rawMetadata?.['description'] as string | undefined;

  return {
    key,
    value: config.value,
    scope: scope as ConfigScope,
    category,
    ...(description && { description }),
    createdAt: new Date(),
    updatedAt: config.updatedAt,
    metadata: rawMetadata ?? { key, label: key, scope, category }
  };
}

/**
 * Get single configuration value
 *
 * @param ctx - Getter context with cache and initialization
 * @param key - Configuration key
 * @param defaultValue - Default value if not found
 * @returns Configuration value
 */
export async function get<T = unknown>(
  ctx: GetterContext,
  key: string,
  defaultValue?: T
): Promise<T> {
  if (!ctx.initialized) await ctx.initialize();

  const cached = ctx.cache.get(key);
  if (cached) return cached.value as T;

  const defaultConfig = ctx.defaultConfig[key];
  if (defaultConfig) {
    ctx.cache.set(key, defaultConfig);
    return defaultConfig.value as T;
  }

  return defaultValue as T;
}

/**
 * Get configuration with full metadata
 *
 * @param ctx - Getter context with cache and initialization
 * @param key - Configuration key
 * @returns Configuration with metadata or undefined if not found
 */
export async function getWithMetadata<T = unknown>(
  ctx: GetterContext,
  key: string
): Promise<DomainConfigWithMetadata<T> | undefined> {
  if (!ctx.initialized) await ctx.initialize();

  const cached = ctx.cache.get(key);
  if (cached) return convertToDomainConfig(key, cached) as DomainConfigWithMetadata<T>;

  const defaultConfig = ctx.defaultConfig[key];
  if (defaultConfig) {
    ctx.cache.set(key, defaultConfig);
    return convertToDomainConfig(key, defaultConfig) as DomainConfigWithMetadata<T>;
  }

  return undefined;
}

/**
 * Get all configurations
 *
 * @param ctx - Getter context with cache and initialization
 * @returns All configurations with metadata
 */
export async function getAll(
  ctx: GetterContext
): Promise<Record<string, DomainConfigWithMetadata<unknown>>> {
  if (!ctx.initialized) await ctx.initialize();
  ctx.loadDefaults();

  const result: Record<string, DomainConfigWithMetadata<unknown>> = {};
  for (const [key, config] of Array.from(ctx.cache.entries())) {
    result[key] = convertToDomainConfig(key, config);
  }
  return result;
}

/**
 * Get configurations by scope
 *
 * @param ctx - Getter context with cache and initialization
 * @param scope - Configuration scope to filter by
 * @returns Configurations matching the scope
 */
export async function getByScope(
  ctx: GetterContext,
  scope: ConfigScope
): Promise<Record<string, DomainConfigWithMetadata<unknown>>> {
  if (!ctx.initialized) await ctx.initialize();
  ctx.loadDefaults();

  const result: Record<string, DomainConfigWithMetadata<unknown>> = {};
  for (const [key, config] of Array.from(ctx.cache.entries())) {
    if (config.metadata.scope === scope) {
      result[key] = convertToDomainConfig(key, config);
    }
  }
  return result;
}

/**
 * Get configurations by category
 *
 * @param ctx - Getter context with cache and initialization
 * @param category - Category to filter by
 * @returns Configurations matching the category
 */
export async function getByCategory(
  ctx: GetterContext,
  category: string
): Promise<Record<string, DomainConfigWithMetadata<unknown>>> {
  if (!ctx.initialized) await ctx.initialize();
  ctx.loadDefaults();

  const result: Record<string, DomainConfigWithMetadata<unknown>> = {};
  for (const [key, config] of Array.from(ctx.cache.entries())) {
    if (config.metadata.category === category) {
      result[key] = convertToDomainConfig(key, config);
    }
  }
  return result;
}

/**
 * Get configurations by namespace prefix
 *
 * @param ctx - Getter context with cache and initialization
 * @param namespace - Namespace prefix to filter by
 * @returns Configurations matching the namespace
 */
export async function getByNamespace(
  ctx: GetterContext,
  namespace: string
): Promise<Record<string, DomainConfigWithMetadata<unknown>>> {
  if (!ctx.initialized) await ctx.initialize();
  ctx.loadDefaults();

  const result: Record<string, DomainConfigWithMetadata<unknown>> = {};
  for (const [key, config] of Array.from(ctx.cache.entries())) {
    if (key.startsWith(`${namespace}.`)) {
      result[key] = convertToDomainConfig(key, config);
    }
  }
  return result;
}

/**
 * Get typed configuration object from namespace
 *
 * @param ctx - Getter context with cache and initialization
 * @param namespace - Namespace to retrieve configuration from
 * @returns Typed configuration object
 */
export async function getTypedConfig<T extends Record<string, unknown>>(
  ctx: GetterContext,
  namespace?: string
): Promise<T> {
  if (!namespace) return {} as T;

  const configs = await getByNamespace(ctx, namespace);
  const result: Record<string, unknown> = {};

  for (const [key, config] of Object.entries(configs)) {
    const resultKey = key.replace(`${namespace}.`, '');
    result[resultKey] = config.value;
  }

  return result as T;
}

/**
 * Get full AppConfig object
 *
 * Assembles the complete application configuration by loading
 * typed configurations from all namespaces.
 *
 * @param ctx - Getter context with cache and initialization
 * @returns Full application configuration
 */
export async function getAppConfig(ctx: GetterContext): Promise<AppConfig> {
  if (!ctx.initialized) await ctx.initialize();
  ctx.loadDefaults();

  const themeConfig = (await getTypedConfig<Record<string, unknown>>(ctx, 'theme')) as unknown as AppConfig['theme'];
  const backupConfig = (await getTypedConfig<Record<string, unknown>>(
    ctx,
    'backup'
  )) as unknown as AppConfig['backup'];
  const fileOrganizationConfig = (await getTypedConfig<Record<string, unknown>>(
    ctx,
    'fileOrganization'
  )) as unknown as AppConfig['fileOrganization'];
  const notificationsConfig = (await getTypedConfig<Record<string, unknown>>(
    ctx,
    'notifications'
  )) as unknown as AppConfig['notifications'];
  const metadataProvidersConfig = (await getTypedConfig<Record<string, unknown>>(
    ctx,
    'metadataProviders'
  )) as unknown as AppConfig['metadataProviders'];
  const downloadClientsConfig = (await getTypedConfig<Record<string, unknown>>(
    ctx,
    'downloadClients'
  )) as unknown as AppConfig['downloadClients'];
  const authConfig = (await getTypedConfig<Record<string, unknown>>(ctx, 'auth')) as unknown as AppConfig['auth'];
  const loggingConfig = (await getTypedConfig<Record<string, unknown>>(
    ctx,
    'logging'
  )) as unknown as AppConfig['logging'];
  const serverConfig = (await getTypedConfig<Record<string, unknown>>(
    ctx,
    'server'
  )) as unknown as AppConfig['server'];

  const version = await get<string>(ctx, 'version', '1.0.0');
  const installId = await get<string>(ctx, 'installId', '');
  const firstRun = await get<boolean>(ctx, 'firstRun', true);
  const setupComplete = await get<boolean>(ctx, 'setupComplete', false);

  return {
    version,
    installId,
    firstRun,
    setupComplete,
    theme: themeConfig ?? ({} as AppConfig['theme']),
    backup: backupConfig ?? ({} as AppConfig['backup']),
    fileOrganization: fileOrganizationConfig ?? ({} as AppConfig['fileOrganization']),
    notifications: notificationsConfig ?? ({} as AppConfig['notifications']),
    metadataProviders: metadataProvidersConfig ?? ({} as AppConfig['metadataProviders']),
    downloadClients: downloadClientsConfig ?? ({} as AppConfig['downloadClients']),
    auth: authConfig ?? ({} as AppConfig['auth']),
    logging: loggingConfig ?? ({} as AppConfig['logging']),
    server: serverConfig ?? ({} as AppConfig['server'])
  };
}
