/**
 * Config Reader Utility
 *
 * Type-safe wrapper functions for reading from the Config table.
 * Provides helper methods to replace legacy Settings table queries.
 *
 * This utility is part of the Settings → Config migration strategy.
 *
 * IMPORTANT: getJSON<T>() cannot validate generic types at runtime.
 * Callers MUST validate results with Zod schemas after retrieval.
 */

import { z } from 'zod';

import { prisma } from '@/server/db';
import { logger } from '@/utils/logger';


import type { PrismaClient } from '@prisma/client';

/**
 * Config Reader - Type-safe Config table accessors
 */
export class ConfigReader {
  constructor(private prismaClient: PrismaClient = prisma) {}

  /**
   * Get a single config value by key
   *
   * @param key - Config key (e.g., "download.transmission.enabled")
   * @param defaultValue - Default value if key not found
   * @returns The config value or default
   */
  async get<T = string>(key: string, defaultValue?: T): Promise<T | undefined> {
    try {
      const config = await this.prismaClient.config.findUnique({
        where: { key }
      });

      if (!config) {
        return defaultValue;
      }

      // Parse value based on type
      return this.parseValue(config.value, defaultValue) as T;
    } catch (error) {
      logger.error(`[ConfigReader] Error reading config key '${key}':`, error);
      return defaultValue;
    }
  }

  /**
   * Get multiple config values by keys
   *
   * @param keys - Array of config keys
   * @returns Map of key → value
   */
  async getMany(keys: string[]): Promise<Map<string, string>> {
    try {
      const configs = await this.prismaClient.config.findMany({
        where: {
          key: { in: keys }
        }
      });

      const map = new Map<string, string>();
      for (const config of configs) {
        map.set(config.key, config.value);
      }

      return map;
    } catch (error) {
      logger.error(`[ConfigReader] Error reading multiple config keys:`, error);
      return new Map();
    }
  }

  /**
   * Get all config values with a key prefix
   *
   * @param prefix - Key prefix (e.g., "download.transmission.")
   * @returns Map of key → value (keys have prefix removed)
   */
  async getByPrefix(prefix: string): Promise<Map<string, string>> {
    try {
      const configs = await this.prismaClient.config.findMany({
        where: {
          key: { startsWith: prefix }
        }
      });

      const map = new Map<string, string>();
      for (const config of configs) {
        // Remove prefix from key
        const shortKey = config.key.replace(prefix, '');
        map.set(shortKey, config.value);
      }

      return map;
    } catch (error) {
      logger.error(`[ConfigReader] Error reading config by prefix '${prefix}':`, error);
      return new Map();
    }
  }

  /**
   * Get a boolean config value
   *
   * @param key - Config key
   * @param defaultValue - Default value if key not found
   * @returns Boolean value
   */
  async getBoolean(key: string, defaultValue = false): Promise<boolean> {
    const value = await this.get(key);
    if (value === undefined) return defaultValue;

    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      return value.toLowerCase() === 'true';
    }

    return defaultValue;
  }

  /**
   * Get a number config value
   *
   * @param key - Config key
   * @param defaultValue - Default value if key not found
   * @returns Number value
   */
  async getNumber(key: string, defaultValue = 0): Promise<number> {
    const value = await this.get(key);
    if (value === undefined) return defaultValue;

    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const parsed = Number(value);
      return isNaN(parsed) ? defaultValue : parsed;
    }

    return defaultValue;
  }

  /**
   * Get a JSON config value
   *
   * WARNING: This method cannot validate the structure of generic type T at runtime.
   * Callers MUST validate the result with a Zod schema or type guard.
   *
   * Example:
   * ```typescript
   * const MySchema = z.object({ foo: z.string() });
   * const raw = await configReader.getJSON('my.config');
   * const result = MySchema.safeParse(raw);
   * if (result.success) { use result.data }
   * ```
   *
   * @param key - Config key
   * @param defaultValue - Default value if key not found
   * @returns Parsed JSON value (UNVALIDATED - caller must validate)
   */
  async getJSON<T = unknown>(key: string, defaultValue?: T): Promise<T | undefined> {
    const value = await this.get(key);
    if (value === undefined) return defaultValue;

    try {
      if (typeof value === 'string') {
        const parsed: unknown = JSON.parse(value);
        // Note: We cannot fully validate generic type T at runtime
        // Callers MUST validate the result with Zod schemas
        return parsed as T;
      }
      return value as T;
    } catch (error) {
      logger.error(`[ConfigReader] Error parsing JSON for key '${key}':`, error);
      return defaultValue;
    }
  }

  /**
   * Get an array config value
   *
   * NOTE: This validates the value is an array, but cannot validate element types.
   * For type-safe arrays, use getJSON() with a Zod schema.
   *
   * @param key - Config key
   * @param defaultValue - Default value if key not found
   * @returns Array value
   */
  async getArray<T = string>(key: string, defaultValue: T[] = []): Promise<T[]> {
    const value = await this.get(key);
    if (value === undefined) return defaultValue;

    try {
      if (typeof value === 'string') {
        const parsed: unknown = JSON.parse(value);
        const result = z.array(z.unknown()).safeParse(parsed);
        return result.success ? (result.data as T[]) : defaultValue;
      }
      if (Array.isArray(value)) {
        return value as T[];
      }
      return defaultValue;
    } catch (error) {
      logger.error(`[ConfigReader] Error parsing array for key '${key}':`, error);
      return defaultValue;
    }
  }

  /**
   * Parse a config value based on default value type
   *
   * NOTE: For object/array types, this cannot validate the structure matches T.
   * This is a best-effort parsing utility.
   */
  private parseValue<T>(value: string, defaultValue?: T): T | string {
    if (defaultValue === undefined) {
      return value;
    }

    const defaultType = typeof defaultValue;

    switch (defaultType) {
      case 'boolean':
        return (value.toLowerCase() === 'true') as T;

      case 'number':
        { const num = Number(value);
        return (isNaN(num) ? defaultValue : num) as T; }

      case 'object':
        if (Array.isArray(defaultValue)) {
          try {
            const parsed: unknown = JSON.parse(value);
            const result = z.array(z.unknown()).safeParse(parsed);
            return (result.success ? result.data : defaultValue) as T;
          } catch {
            return defaultValue;
          }
        }
        try {
          const parsed: unknown = JSON.parse(value);
          // Note: We cannot fully validate the structure at runtime
          // Type T is expected to match the parsed object structure
          return parsed as T;
        } catch {
          return defaultValue;
        }

      default:
        return value as T;
    }
  }

  /**
   * Check if a config key exists
   *
   * @param key - Config key
   * @returns True if key exists
   */
  async exists(key: string): Promise<boolean> {
    try {
      const count = await this.prismaClient.config.count({
        where: { key }
      });
      return count > 0;
    } catch (error) {
      logger.error(`[ConfigReader] Error checking if key '${key}' exists:`, error);
      return false;
    }
  }
}

// Export singleton instance
export const configReader = new ConfigReader();

// Export convenience functions
export const getConfig = configReader.get.bind(configReader);
export const getConfigBoolean = configReader.getBoolean.bind(configReader);
export const getConfigNumber = configReader.getNumber.bind(configReader);
export const getConfigJSON = configReader.getJSON.bind(configReader);
export const getConfigArray = configReader.getArray.bind(configReader);
export const getConfigMany = configReader.getMany.bind(configReader);
export const getConfigByPrefix = configReader.getByPrefix.bind(configReader);
export const configExists = configReader.exists.bind(configReader);
