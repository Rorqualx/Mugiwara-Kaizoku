/**
 * Type definitions for the Configuration Service
 *
 * This module contains all type definitions used by the configuration service,
 * including metadata structures, entity definitions, and input types.
 */

import { ConfigValueType } from '@prisma/client';
import { ConfigScope, ConfigSource } from '@prisma/client';

/**
 * Configuration metadata structure
 * Describes the schema and constraints of a configuration value
 */
export interface ConfigMetadata {
  key: string;
  label: string;
  description?: string;
  type: ConfigValueType;
  defaultValue?: unknown;
  scope: ConfigScope;
  category: string;
  required?: boolean;
  options?: Array<{
    value: string | number | boolean;
    label: string;
  }>;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    message?: string;
  };
  ui?: {
    component?: string;
    order?: number;
    group?: string;
    readonly?: boolean;
    hidden?: boolean;
  };
}

/**
 * Configuration entity structure
 * Represents a configuration value stored in the database
 */
export interface ConfigEntity {
  id: number;
  key: string;
  value: string;
  valueType: ConfigValueType;
  scope: ConfigScope;
  source: ConfigSource;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Input for creating a configuration
 */
export interface CreateConfigInput {
  key: string;
  value: unknown;
  valueType: ConfigValueType;
  scope: ConfigScope;
  source?: ConfigSource;
  metadata?: Partial<ConfigMetadata>;
}

/**
 * Input for updating a configuration
 */
export interface UpdateConfigInput {
  value?: unknown;
  metadata?: Partial<ConfigMetadata>;
  source?: ConfigSource;
}

/**
 * Internal ConfigServiceMetadata interface for cache use
 * This is distinct from the domain-level ConfigWithMetadata interface
 */
export interface ConfigServiceMetadata<T = unknown> {
  value: T;
  metadata: ConfigMetadata;
  source: ConfigSource;
  updatedAt: Date;
}

/**
 * Type for Prisma Config model operations
 */
export type PrismaConfigModel = {
  findMany: () => Promise<Array<{
    key: string;
    value: string;
    valueType: ConfigValueType;
    scope: ConfigScope;
    metadata: Record<string, unknown>;
    updatedAt: Date;
  }>>;
  findUnique: (args: { where: { key: string } }) => Promise<{ key: string } | null>;
  create: (args: {
    data: {
      key: string;
      value: string;
      valueType: ConfigValueType;
      scope: ConfigScope;
      source: ConfigSource;
      metadata: unknown;
    };
    select?: Record<string, boolean>;
  }) => Promise<{
    key: string;
    value: string;
    valueType: ConfigValueType;
    scope: ConfigScope;
    source: ConfigSource;
    metadata: unknown;
    createdAt: Date;
    updatedAt: Date;
  }>;
  update: (args: {
    where: { key: string };
    data: {
      value: string;
      valueType?: ConfigValueType;
      scope?: ConfigScope;
      metadata?: unknown;
      source?: ConfigSource;
      updatedAt?: Date;
    };
    select?: Record<string, boolean>;
  }) => Promise<{
    key: string;
    value: string;
    valueType: ConfigValueType;
    scope: ConfigScope;
    source: ConfigSource;
    metadata: unknown;
    createdAt: Date;
    updatedAt: Date;
  }>;
  deleteMany: (args: { where: { key: string } }) => Promise<unknown>;
};

/**
 * Extended Prisma client type with Config model
 */
export type PrismaWithConfig = {
  Config: PrismaConfigModel;
  $transaction: <T>(
    fn: (tx: PrismaWithConfig) => Promise<T>,
    options?: {
      maxWait?: number;
      timeout?: number;
      isolationLevel?: 'ReadUncommitted' | 'ReadCommitted' | 'RepeatableRead' | 'Serializable';
    }
  ) => Promise<T>;
};

/**
 * Type for Prisma Settings model operations (legacy)
 */
export type PrismaSettingsModel = {
  findFirst: () => Promise<{
    id: number;
    suwayomiEnabled: boolean;
    suwayomiServerPath: string | null;
    suwayomiConfigPath: string | null;
    suwayomiPort: number | null;
    suwayomiSources: unknown;
    metadata: unknown;
    createdAt: Date;
    updatedAt: Date;
  } | null>;
};

/**
 * Extended Prisma client type with Settings model
 */
export type PrismaWithSettings = {
  settings: PrismaSettingsModel;
};
