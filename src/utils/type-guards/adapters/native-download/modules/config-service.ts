/**
 * Config Service Type Guards
 *
 * This module contains type guards for validating configuration service type objects,
 * ensuring type safety for configuration management.
 *
 * @module ConfigServiceTypeGuards
 * @category TypeGuards
 * @subcategory Kapowarr
 */

import type {
  BaseConfigService,
  ApiConfigService,
  MetadataConfigService,
  SearchConfigService,
  ConfigService,
  DatabaseConfigService
} from "@/types/config-service";

/**
 * Type guard for BaseConfigService
 * Validates that an object conforms to the BaseConfigService interface
 */
export function isBaseConfigService(obj: unknown): obj is BaseConfigService {
  return typeof obj === "object" && obj !== null;
}

/**
 * Type guard for ApiConfigService
 * Validates that an object conforms to the ApiConfigService interface
 */
export function isApiConfigService(obj: unknown): obj is ApiConfigService {
  return typeof obj === "object" && obj !== null;
}

/**
 * Type guard for MetadataConfigService
 * Validates that an object conforms to the MetadataConfigService interface
 */
export function isMetadataConfigService(obj: unknown): obj is MetadataConfigService {
  return typeof obj === "object" && obj !== null;
}

/**
 * Type guard for SearchConfigService
 * Validates that an object conforms to the SearchConfigService interface
 */
export function isSearchConfigService(obj: unknown): obj is SearchConfigService {
  return typeof obj === "object" && obj !== null;
}

/**
 * Type guard for ConfigService
 * Validates that an object conforms to the ConfigService interface
 */
export function isConfigService(obj: unknown): obj is ConfigService {
  return typeof obj === "object" && obj !== null;
}

/**
 * Type guard for DatabaseConfigService
 * Validates that an object conforms to the DatabaseConfigService interface
 */
export function isDatabaseConfigService(obj: unknown): obj is DatabaseConfigService {
  return typeof obj === "object" && obj !== null;
}