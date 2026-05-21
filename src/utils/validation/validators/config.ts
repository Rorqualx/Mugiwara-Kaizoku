/**
 * Configuration Validation Utilities
 *
 * This module provides utilities for validating configuration objects
 * and creating default configurations for adapters and services.
 */
// import { logger } from '@/utils/logger';
import { ValidationError } from '@/utils/errors';
import type { BaseIntegrationConfig } from '@/utils/integration-adapter';
/**
 * Validates a configuration object against required fields and provides defaults
 *
 * @param config - Configuration object to validate
 * @param requiredFields - Array of fields that must exist in the configuration
 * @param defaults - Default values to use for missing fields
 * @returns Valid configuration object with defaults applied
 * @throws Error if required fields are missing
 */
export function validateConfig<T extends BaseIntegrationConfig>(config: Partial<T>, requiredFields: (keyof T)[], defaults: Partial<T>): T {
    // Merge defaults with provided config
    const mergedConfig = { ...defaults, ...config } as T;
    // Check required fields
    const missingFields: string[] = [];
    for (const field of requiredFields) {
        if (mergedConfig[field] === undefined) {
            missingFields.push(field as string);
        }
    }
    // Throw error if required fields are missing
    if (missingFields.length > 0) {
        throw new ValidationError(`Missing required configuration fields: ${missingFields.join(', ')}`);
    }
    return mergedConfig;
}
/**
 * Creates a typed configuration factory function for a specific adapter
 *
 * @param defaults - Default configuration values
 * @param requiredFields - Fields that are required for this adapter
 * @returns A factory function that creates validated configurations
 */
export function createConfigFactory<T extends BaseIntegrationConfig>(defaults: Partial<T>, requiredFields: (keyof T)[] = []): (config?: Partial<T>) => T {
    return (config: Partial<T> = {}) => validateConfig<T>(config, requiredFields, defaults);
}
/**
 * Merges two configuration objects, with values from the second overriding the first
 *
 * @param baseConfig - Base configuration object
 * @param overrides - Configuration values to override
 * @returns Merged configuration object
 */
export function mergeConfigs<T extends BaseIntegrationConfig>(baseConfig: T, overrides: Partial<T>): T {
    return { ...baseConfig, ...overrides };
}
/**
 * Checks if a configuration is valid for a specific adapter
 *
 * @param config - Configuration to check
 * @param requiredFields - Fields that are required for this adapter
 * @returns True if configuration is valid
 */
export function isValidConfig<T extends BaseIntegrationConfig>(config: Partial<T>, requiredFields: (keyof T)[]): boolean {
    try {
        validateConfig(config, requiredFields, {});
        return true;
    }
    catch (_error: unknown) {
        return false;
    }
}
