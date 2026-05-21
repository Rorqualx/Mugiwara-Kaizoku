/**
 * Configuration Service Adapter
 *
 * This module provides an adapter implementation that bridges the interface
 * gap between different configuration service implementations in the application.
 * It ensures compatibility between the standard ConfigService interface and
 * service-specific implementations, allowing them to work together seamlessly.
 *
 * @module utils/config-service-adapter
 */
// import { logger } from '../utils/logger';
import { ValidationError } from '../utils/errors';

import type { ConfigService } from '../types/config-service';

// Type for the underlying service implementation
interface UnderlyingService {
  isEnabled?: () => Promise<boolean>;
  isProviderEnabled?: () => Promise<boolean>;
  loadConfig?: () => Promise<unknown>;
  getConfig?: () => Promise<unknown>;
  saveConfig?: (config: unknown) => Promise<void>;
  updateConfig?: (config: unknown) => Promise<void>;
  getValue?: <T>(key: string, defaultValue?: T) => Promise<T>;
  get?: <T>(key: string, defaultValue?: T) => Promise<T>;
  setValue?: <T>(key: string, value: T) => Promise<void>;
  set?: <T>(key: string, value: T) => Promise<void>;
  hasKey?: (key: string) => Promise<boolean>;
  has?: (key: string) => Promise<boolean>;
  removeKey?: (key: string) => Promise<void>;
  remove?: (key: string) => Promise<void>;
  delete?: (key: string) => Promise<void>;
}

// Unused imports removed './async-result';
/**
 * Configuration Service Adapter
 *
 * Adapts a legacy or service-specific configuration service to the standard
 * ConfigService interface, ensuring compatibility across the application.
 */
export class ConfigServiceAdapter implements ConfigService {
  private readonly wrappedService: UnderlyingService;

  /**
   * Creates a new ConfigServiceAdapter
   *
   * @param service - The underlying configuration service to adapt
   */
  constructor(service: unknown) {
    if (!service) {
      throw new ValidationError('ConfigServiceAdapter requires a service implementation');
    }
    this.wrappedService = service as UnderlyingService;
  }

  /**
   * Check if the service is enabled
   *
   * @returns Promise resolving to boolean indicating enabled status
   */
  async isEnabled(): Promise<boolean> {
    if (typeof this.wrappedService.isEnabled === 'function') {
      return this.wrappedService.isEnabled();
    }
    if (typeof this.wrappedService.isProviderEnabled === 'function') {
      return this.wrappedService.isProviderEnabled();
    }
    // Default to enabled if we can't determine
    return true;
  }

  /**
   * Load configuration data from storage
   *
   * @returns Promise resolving to the configuration data
   */
  async loadConfig(): Promise<unknown> {
    if (typeof this.wrappedService.loadConfig === 'function') {
      return this.wrappedService.loadConfig();
    }
    if (typeof this.wrappedService.getConfig === 'function') {
      return this.wrappedService.getConfig();
    }
    // Return empty config if we can't load
    return {};
  }

  /**
   * Save configuration data to storage
   *
   * @param config - Configuration data to save
   * @returns Promise resolving when save is complete
   */
  async saveConfig(config: unknown): Promise<void> {
    if (typeof this.wrappedService.saveConfig === 'function') {
      await this.wrappedService.saveConfig(config);
      return;
    }
    if (typeof this.wrappedService.updateConfig === 'function') {
      await this.wrappedService.updateConfig(config);
      return;
    }
    throw new ValidationError('ConfigServiceAdapter: Cannot save config - no compatible method found');
  }

  /**
   * Get a specific configuration value
   *
   * @param key - Configuration key to retrieve
   * @param defaultValue - Default value if key not found
   * @returns Promise resolving to configuration value
   */
  async getValue<T>(key: string, defaultValue?: T): Promise<T> {
    if (typeof this.wrappedService.getValue === 'function') {
      return this.wrappedService.getValue<T>(key, defaultValue);
    }
    if (typeof this.wrappedService.get === 'function') {
      return this.wrappedService.get<T>(key, defaultValue);
    }
    // Try to load the whole config and extract the key
    try {
      const config = await this.loadConfig();
      if (config !== null && typeof config === 'object' && !Array.isArray(config) && key in config) {
        return (config as Record<string, unknown>)[key] as T;
      }
    }
    catch (_e: unknown) {
      // Fallthrough to return default value
    }
    // Return default if we can't get the value
    return defaultValue as T;
  }

  /**
   * Set a specific configuration value
   *
   * @param key - Configuration key to set
   * @param value - Value to store
   * @returns Promise resolving when update is complete
   */
  async setValue<T>(key: string, value: T): Promise<void> {
    if (typeof this.wrappedService.setValue === 'function') {
      await this.wrappedService.setValue<T>(key, value);
      return;
    }
    if (typeof this.wrappedService.set === 'function') {
      await this.wrappedService.set<T>(key, value);
      return;
    }
    // Try to load the whole config, update it, and save it back
    try {
      const config = await this.loadConfig();
      if (config !== null && typeof config === 'object' && !Array.isArray(config)) {
        (config as Record<string, unknown>)[key] = value;
        await this.saveConfig(config);
        return;
      }
    }
    catch (e: unknown) {
      throw new Error(`ConfigServiceAdapter: Cannot set value for key '${key}': ${String(e)}`);
    }
    throw new ValidationError(`ConfigServiceAdapter: Cannot set value for key '${key}' - no compatible method found`);
  }

  /**
   * Check if a configuration key exists
   *
   * @param key - Configuration key to check
   * @returns Promise resolving to boolean indicating existence
   */
  async hasKey(key: string): Promise<boolean> {
    if (typeof this.wrappedService.hasKey === 'function') {
      return this.wrappedService.hasKey(key);
    }
    if (typeof this.wrappedService.has === 'function') {
      return this.wrappedService.has(key);
    }
    // Try to load the whole config and check if the key exists
    try {
      const config = await this.loadConfig();
      return config !== null && typeof config === 'object' && !Array.isArray(config) && key in config;
    }
    catch (_e: unknown) {
      return false;
    }
  }

  /**
   * Remove a configuration key
   *
   * @param key - Configuration key to remove
   * @returns Promise resolving when removal is complete
   */
  async removeKey(key: string): Promise<void> {
    if (typeof this.wrappedService.removeKey === 'function') {
      await this.wrappedService.removeKey(key);
      return;
    }
    if (typeof this.wrappedService.remove === 'function') {
      await this.wrappedService.remove(key);
      return;
    }
    if (typeof this.wrappedService.delete === 'function') {
      await this.wrappedService.delete(key);
      return;
    }
    // Try to load the whole config, remove the key, and save it back
    try {
      const config = await this.loadConfig();
      if (config !== null && typeof config === 'object' && !Array.isArray(config) && key in config) {
        delete (config as Record<string, unknown>)[key];
        await this.saveConfig(config);
        return;
      }
    }
    catch (e: unknown) {
      throw new Error(`ConfigServiceAdapter: Cannot remove key '${key}': ${String(e)}`);
    }
  }
  /**
   * Get the wrapped service instance
   *
   * @returns The original service implementation
   */
  getWrappedService(): unknown {
    return this.wrappedService;
  }
  /**
   * Create a ConfigServiceAdapter instance with AsyncResult pattern support
   *
   * @param service - The underlying configuration service to adapt
   * @returns A new ConfigServiceAdapter instance
   */
  static createAdapter(service: unknown): ConfigServiceAdapter {
    return new ConfigServiceAdapter(service);
  }
}
/**
 * Factory function to create a ConfigServiceAdapter
 *
 * @param service - The underlying configuration service to adapt
 * @returns A new ConfigServiceAdapter instance
 */
export function createConfigServiceAdapter(service: unknown): ConfigService {
  return new ConfigServiceAdapter(service);
}
/**
 * Check if a service implements the basic ConfigService interface
 *
 * @param service - Service to check
 * @returns Boolean indicating if the service implements the basic interface
 */
export function isConfigService(service: unknown): service is ConfigService {
  if (!service || typeof service !== 'object')
  return false;
  const obj = service as Record<string, unknown>;
  return typeof obj["getValue"] === 'function' &&
  typeof obj["setValue"] === 'function' &&
  typeof obj["hasKey"] === 'function' &&
  typeof obj["removeKey"] === 'function';
}