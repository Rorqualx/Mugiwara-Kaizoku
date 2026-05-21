/**
 * Base Settings Type Guards
 *
 * This module contains reusable type guard utilities for common configuration patterns
 * to reduce complexity and duplication in the main config-types module.
 *
 * @module BaseSettingsTypeGuards
 * @category TypeGuards
 * @subcategory Kapowarr
 */

/**
 * Validates that a value is a string or undefined
 */
export function isOptionalString(value: unknown): value is string | undefined {
  return typeof value === "string" || value === undefined;
}

/**
 * Validates that a value is a number or undefined
 */
export function isOptionalNumber(value: unknown): value is number | undefined {
  return typeof value === "number" || value === undefined;
}

/**
 * Validates that a value is a boolean or undefined
 */
export function isOptionalBoolean(value: unknown): value is boolean | undefined {
  return typeof value === "boolean" || value === undefined;
}

/**
 * Validates that a value is a Date instance or undefined
 */
export function isOptionalDate(value: unknown): value is Date | undefined {
  return value instanceof Date || value === undefined;
}

/**
 * Validates that a value is an array of strings or undefined
 */
export function isOptionalStringArray(value: unknown): value is string[] | undefined {
  return Array.isArray(value) && value.every((x: unknown) => typeof x === "string") || value === undefined;
}

/**
 * Validates that a value is an array of numbers or undefined
 */
export function isOptionalNumberArray(value: unknown): value is number[] | undefined {
  return Array.isArray(value) && value.every((x: unknown) => typeof x === "number") || value === undefined;
}

/**
 * Validates that a value is a string array
 */
export function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((x: unknown) => typeof x === "string");
}

/**
 * Validates that a value is a number array
 */
export function isNumberArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((x: unknown) => typeof x === "number");
}

/**
 * Validates that a value is a valid host configuration
 */
export function isValidHostConfig(candidate: Record<string, unknown>): boolean {
  return (
    typeof candidate["host"] === "string" &&
    typeof candidate["port"] === "number" &&
    isOptionalString(candidate["username"]) &&
    isOptionalString(candidate["password"]) &&
    isOptionalBoolean(candidate["ssl"])
  );
}

/**
 * Validates that a value is a valid API configuration
 */
export function isValidApiConfig(candidate: Record<string, unknown>): boolean {
  return (
    typeof candidate["apiUrl"] === "string" &&
    typeof candidate["apiKey"] === "string"
  );
}

/**
 * Validates that a value is a valid webhook configuration
 */
export function isValidWebhookConfig(candidate: Record<string, unknown>): boolean {
  return (
    typeof candidate["webhookUrl"] === "string" &&
    isOptionalString(candidate["username"]) &&
    isOptionalString(candidate["avatarUrl"]) &&
    isOptionalString(candidate["channel"]) &&
    isOptionalString(candidate["iconEmoji"])
  );
}

/**
 * Validates that a value is a valid sync configuration
 */
export function isValidSyncConfig(candidate: Record<string, unknown>): boolean {
  return (
    isOptionalBoolean(candidate["syncEnabled"]) &&
    isOptionalBoolean(candidate["autoImport"]) &&
    isOptionalBoolean(candidate["autoSync"]) &&
    isOptionalNumber(candidate["syncInterval"]) &&
    isOptionalStringArray(candidate["libraries"])
  );
}
