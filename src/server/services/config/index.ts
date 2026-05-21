/**
 * Configuration Service Module
 *
 * This module provides a unified API for managing application configuration.
 * Re-exports all configuration-related types, functions, and the singleton service.
 */

// Export types
export type {
  ConfigMetadata,
  ConfigEntity,
  CreateConfigInput,
  UpdateConfigInput,
  ConfigServiceMetadata,
  PrismaConfigModel,
  PrismaWithConfig,
  PrismaSettingsModel,
  PrismaWithSettings
} from './config-types';

// Export default config generator
export { getDefaultConfig } from './config-defaults';

// Export persistence functions
export {
  loadFromDatabase,
  saveToDatabase,
  loadFromFile,
  saveToFile,
  loadFromEnvironment,
  deleteFromDatabase,
  exportToFile
} from './config-persistence';

// Export main service class and singleton
export { ConfigService, configService } from './configService';
