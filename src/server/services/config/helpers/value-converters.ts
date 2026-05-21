/**
 * Value Converter Utilities
 *
 * Functions for converting configuration values between different formats:
 * - Type detection from runtime values
 * - Parsing string values to typed values
 * - Stringifying typed values for storage
 * - Source priority calculation
 *
 * Extracted from: configService.ts (lines 119-187)
 */

import { ConfigValueType, ConfigSource } from '@prisma/client';

import { logger } from '@/utils/logger';



/**
 * Get priority for configuration source
 * Higher priority sources override lower priority ones
 *
 * Priority order (highest to lowest):
 * - ENV: 4 (environment variables)
 * - DATABASE: 3 (database stored values)
 * - FILE: 2 (configuration files)
 * - OVERRIDE: 1 (manual overrides)
 * - DEFAULT: 0 (default values)
 */
export function getSourcePriority(source: ConfigSource): number {
  switch (source) {
    case ConfigSource.ENV:
      return 4;
    case ConfigSource.DATABASE:
      return 3;
    case ConfigSource.FILE:
      return 2;
    case ConfigSource.OVERRIDE:
      return 1;
    case ConfigSource.DEFAULT:
    default:
      return 0;
  }
}

/**
 * Detect ConfigValueType from runtime value
 *
 * Maps JavaScript runtime types to ConfigValueType enum values:
 * - null -> STRING
 * - string -> STRING
 * - number -> NUMBER
 * - boolean -> BOOLEAN
 * - Array -> ARRAY
 * - Date -> DATE
 * - object -> OBJECT
 */
export function detectValueType(value: unknown): ConfigValueType {
  if (value === null) return ConfigValueType.STRING;
  if (typeof value === 'string') return ConfigValueType.STRING;
  if (typeof value === 'number') return ConfigValueType.NUMBER;
  if (typeof value === 'boolean') return ConfigValueType.BOOLEAN;
  if (Array.isArray(value)) return ConfigValueType.ARRAY;
  if (value instanceof Date) return ConfigValueType.DATE;
  if (typeof value === 'object') return ConfigValueType.OBJECT;
  return ConfigValueType.STRING;
}

/**
 * Parse string value to typed value based on ConfigValueType
 *
 * Converts stored string values back to their original types:
 * - STRING: returns as-is
 * - NUMBER: converts to number
 * - BOOLEAN: converts 'true' or '1' to true, otherwise false
 * - ARRAY/OBJECT/JSON: parses as JSON
 * - DATE: creates Date object
 */
export function parseValue(value: string, type: ConfigValueType): unknown {
  try {
    switch (type) {
      case ConfigValueType.STRING:
        return value;
      case ConfigValueType.NUMBER:
        return Number(value);
      case ConfigValueType.BOOLEAN:
        return value.toLowerCase() === 'true' || value === '1';
      case ConfigValueType.ARRAY:
      case ConfigValueType.OBJECT:
      case ConfigValueType.JSON:
        return JSON.parse(value);
      case ConfigValueType.DATE:
        return new Date(value);
      default:
        return value;
    }
  } catch (error: unknown) {
    logger.warn(`Failed to parse value "${value}" as ${type}: ${error}`);
    return value;
  }
}

/**
 * Convert typed value to string for storage
 *
 * Serializes typed values to strings for database/file storage:
 * - ARRAY/OBJECT/JSON: JSON.stringify
 * - DATE: ISO string format
 * - Others: String conversion
 */
export function stringifyValue(value: unknown, type: ConfigValueType): string {
  try {
    switch (type) {
      case ConfigValueType.ARRAY:
      case ConfigValueType.OBJECT:
      case ConfigValueType.JSON:
        return JSON.stringify(value);
      case ConfigValueType.DATE:
        return value instanceof Date ? value.toISOString() : String(value);
      default:
        return String(value);
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.warn(`Failed to stringify value for storage: ${errorMessage}`);
    return String(value);
  }
}
