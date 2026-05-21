/**
 * Central Configuration Service
 *
 * Refactored to use modular architecture:
 * - helpers/ - Value conversion, metadata building, domain conversion
 * - operations/ - Getter, CRUD, and management operations
 *
 * Original: 876 lines -> Refactored: ~250 lines
 */
import * as path from 'path';


import { ConfigScope, ConfigSource, ConfigValueType } from '@prisma/client';

import type { AppConfig, ConfigWithMetadata as DomainConfigWithMetadata } from '@/types/search.types';
import { logger } from '@/utils/logger';


import { getDefaultConfig } from './config-defaults';
import { loadFromDatabase, loadFromFile, loadFromEnvironment } from './config-persistence';
import { convertToDomainConfig } from './helpers/domain-converters';
import { getSourcePriority, detectValueType, parseValue } from './helpers/value-converters';
import * as crudOps from './operations/crud-operations';
import * as getterOps from './operations/getter-operations';
import * as managementOps from './operations/management-operations';

import type {
  ConfigMetadata,
  ConfigEntity,
  CreateConfigInput,
  UpdateConfigInput,
  ConfigServiceMetadata
} from './config-types';

// Re-export types for backward compatibility
export type { ConfigMetadata, ConfigEntity, CreateConfigInput, UpdateConfigInput, ConfigServiceMetadata };

/**
 * Configuration service implementation
 * Refactored to delegate to modular operations while maintaining the same public API
 */
export class ConfigService {
  private cache: Map<string, ConfigServiceMetadata<unknown>> = new Map();
  private initialized: boolean = false;
  private configFilePath: string;
  private defaultConfig: Record<string, ConfigServiceMetadata<unknown>> = {};

  constructor() {
    this.configFilePath = path.resolve(process.cwd(), 'data', 'config.json');
    this.defaultConfig = getDefaultConfig();
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      await loadFromDatabase(this.cache, parseValue);
      await loadFromFile(this.configFilePath, this.cache, getSourcePriority, detectValueType);
      loadFromEnvironment(this.cache, getSourcePriority, detectValueType, parseValue);

      this.initialized = true;
      logger.info('Configuration service initialized');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to initialize configuration service: ${errorMessage}`);
      this.initialized = true;
    }
  }

  private loadDefaults(): void {
    for (const [key, config] of Object.entries(this.defaultConfig)) {
      if (!this.cache.get(key)) {
        this.cache.set(key, { ...config });
      }
    }
  }

  private getGetterContext(): getterOps.GetterContext {
    return {
      cache: this.cache,
      defaultConfig: this.defaultConfig,
      initialized: this.initialized,
      initialize: this.initialize.bind(this),
      loadDefaults: this.loadDefaults.bind(this)
    };
  }

  private getCrudContext(): crudOps.CrudContext {
    return {
      cache: this.cache,
      initialized: this.initialized,
      initialize: this.initialize.bind(this),
      configFilePath: this.configFilePath
    };
  }

  private getManagementContext(): managementOps.ManagementContext {
    return {
      cache: this.cache,
      defaultConfig: this.defaultConfig,
      initialized: this.initialized,
      initialize: this.initialize.bind(this),
      loadDefaults: this.loadDefaults.bind(this),
      configFilePath: this.configFilePath,
      set: this.set.bind(this),
      convertToDomainConfig: convertToDomainConfig
    };
  }

  // Getter operations - delegated
  async get<T = unknown>(key: string, defaultValue?: T): Promise<T> {
    return getterOps.get(this.getGetterContext(), key, defaultValue);
  }

  async getWithMetadata<T = unknown>(key: string): Promise<DomainConfigWithMetadata<T> | undefined> {
    return getterOps.getWithMetadata(this.getGetterContext(), key);
  }

  async getAll(): Promise<Record<string, DomainConfigWithMetadata<unknown>>> {
    return getterOps.getAll(this.getGetterContext());
  }

  async getByScope(scope: ConfigScope): Promise<Record<string, DomainConfigWithMetadata<unknown>>> {
    return getterOps.getByScope(this.getGetterContext(), scope);
  }

  async getByCategory(category: string): Promise<Record<string, DomainConfigWithMetadata<unknown>>> {
    return getterOps.getByCategory(this.getGetterContext(), category);
  }

  async getByNamespace(namespace: string): Promise<Record<string, DomainConfigWithMetadata<unknown>>> {
    return getterOps.getByNamespace(this.getGetterContext(), namespace);
  }

  async getTypedConfig<T extends Record<string, unknown>>(namespace?: string): Promise<T> {
    return getterOps.getTypedConfig(this.getGetterContext(), namespace);
  }

  async getAppConfig(): Promise<AppConfig> {
    return getterOps.getAppConfig(this.getGetterContext());
  }

  // CRUD operations - delegated
  async set<T = unknown>(
    key: string,
    value: T,
    options?: {
      scope?: ConfigScope;
      valueType?: ConfigValueType;
      source?: ConfigSource;
      metadata?: Partial<ConfigMetadata>;
    }
  ): Promise<void> {
    return crudOps.set(this.getCrudContext(), key, value, options);
  }

  async setBatch(
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
    return crudOps.setBatch(this.getCrudContext(), items);
  }

  async create(input?: CreateConfigInput): Promise<ConfigEntity> {
    return crudOps.create(this.getCrudContext(), input);
  }

  async update(key?: string, input?: UpdateConfigInput): Promise<ConfigEntity> {
    return crudOps.update(this.getCrudContext(), key, input);
  }

  async delete(key?: string): Promise<void> {
    return crudOps.deleteConfig(this.getCrudContext(), key);
  }

  async remove(key?: string): Promise<void> {
    return crudOps.remove(this.getCrudContext(), key);
  }

  // Management operations - delegated
  async resetToDefaults(scope?: ConfigScope): Promise<void> {
    return managementOps.resetToDefaults(this.getManagementContext(), scope);
  }

  async exportToFile(filePath: string, includeScopes?: ConfigScope[]): Promise<void> {
    return managementOps.exportToFile(this.getManagementContext(), filePath, includeScopes);
  }

  clearCache(key?: string): void {
    return managementOps.clearCache(this.getManagementContext(), key);
  }

  async importFromFile(
    filePath: string,
    options?: {
      overrideExisting?: boolean;
      importScopes?: ConfigScope[];
    }
  ): Promise<void> {
    return managementOps.importFromFile(this.getManagementContext(), filePath, options);
  }

  async migrateFromLegacySettings(): Promise<void> {
    return managementOps.migrateFromLegacySettings(this.getManagementContext());
  }
}

export const configService = new ConfigService();
