/**
 * Kapowarr Type Guards Module Aggregator
 *
 * This file aggregates all decomposed type guard modules for the Native download adapter.
 * It serves as the main entry point for all configuration type guards.
 *
 * @module KapowarrTypeGuards
 * @category TypeGuards
 * @subcategory Kapowarr
 */

// Import functions for use within this file
import { isRecord } from "./config-utils";
import {
  isValidDownloadClientSettings
} from "./download-client-types";
import {
  isValidIntegrationSettings
} from "./integration-services";
import {
  isValidNotificationSettings
} from "./notification-services";
import {
  isValidProviderSettings
} from "./provider-services";

// ============================================================================
// Foundation Utilities
// ============================================================================

export {
  isRecord,
  isString,
  isBoolean,
  isNumber,
  isRequiredProperty,
  validateConfig
} from "./config-utils";

// ============================================================================
// Download Client Types
// ============================================================================

export {
  isValidTransmissionConfig,
  isValidDelugeConfig,
  isValidSABnzbdConfig,
  isValidNZBGetConfig,
  isValidDownloadClientField,
  isValidDownloadClientSettings
} from "./download-client-types";

// ============================================================================
// Notification Services
// ============================================================================

export {
  isValidDiscordConfig,
  isValidEmailConfig,
  isValidSlackConfig,
  isValidTelegramConfig,
  isValidNotificationField,
  isValidNotificationSettings
} from "./notification-services";

// ============================================================================
// Integration Services
// ============================================================================

export {
  isValidKavitaConfig,
  isValidKomgaConfig,
  isValidIntegrationField,
  isValidNestedIntegrationSettings,
  isValidIntegrationSettings
} from "./integration-services";

// ============================================================================
// Provider Services
// ============================================================================

export {
  isValidComicVineConfig,
  isValidAniListConfig,
  isValidFandomConfig,
  isValidWikipediaConfig,
  isValidProviderField,
  isValidProviderSettings
} from "./provider-services";

// ============================================================================
// Base Settings
// ============================================================================

export {
  isOptionalString,
  isOptionalNumber,
  isOptionalBoolean,
  isOptionalDate,
  isOptionalStringArray,
  isOptionalNumberArray,
  isStringArray,
  isNumberArray,
  isValidHostConfig,
  isValidApiConfig,
  isValidWebhookConfig,
  isValidSyncConfig
} from "./base-settings";

// ============================================================================
// Main Aggregated Functions
// ============================================================================

/**
 * Check if any configuration is valid
 */
export function isValidConfig(obj: unknown): boolean {
  if (!isRecord(obj)) {
    return false;
  }

  return (
    isValidDownloadClientSettings(obj) ||
    isValidNotificationSettings(obj) ||
    isValidIntegrationSettings(obj) ||
    isValidProviderSettings(obj)
  );
}

/**
 * Get configuration type from object
 */
export function getConfigType(obj: unknown): string | null {
  if (!isRecord(obj)) {
    return null;
  }

  // Check each category in order of specificity
  if (isValidDownloadClientSettings(obj)) return "download:client";
  if (isValidNotificationSettings(obj)) return "notification:service";
  if (isValidIntegrationSettings(obj)) return "integration:service";
  if (isValidProviderSettings(obj)) return "provider:service";

  return null;
}

/**
 * Validate any configuration
 */
export function validateAnyConfig(obj: unknown): {
  isValid: boolean;
  errors: string[];
  type: string | null;
} {
  const errors: string[] = [];
  const type = getConfigType(obj);

  if (!type) {
    errors.push("Unknown configuration type");
    return { isValid: false, errors, type: null };
  }

  // Basic validation - check if the configuration is valid
  if (!isValidConfig(obj)) {
    errors.push(`Invalid ${type} configuration`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    type
  };
}

/**
 * Normalize any configuration
 */
export function normalizeAnyConfig(obj: unknown): Record<string, unknown> {
  if (!isRecord(obj)) {
    return {};
  }

  // Return the object as-is since normalization functions don't exist
  return obj as Record<string, unknown>;
}

/**
 * Check if configuration is enabled
 */
export function isConfigEnabled(obj: unknown): boolean {
  if (!isRecord(obj)) {
    return false;
  }

  // Check if the configuration has an "enabled" field and it's not false
  return !("enabled" in obj) || obj["enabled"] !== false;
}

/**
 * Get all valid configurations from array
 */
export function getValidConfigs(configs: unknown[]): string[] {
  const validConfigs: string[] = [];

  for (const config of configs) {
    if (isConfigEnabled(config)) {
      const type = getConfigType(config);
      if (type) {
        validConfigs.push(type);
      }
    }
  }

  return validConfigs;
}

/**
 * Create configuration validator with custom rules
 */
export function createConfigValidator(
  rules: Record<string, (value: unknown) => boolean>
): (obj: unknown) => boolean {
  return (obj: unknown): boolean => {
    if (!isRecord(obj)) {
      return false;
    }

    for (const [key, validator] of Object.entries(rules)) {
      if (key in obj && !validator(obj[key])) {
        return false;
      }
    }

    return true;
  };
}

/**
 * Create configuration normalizer with custom transformations
 */
export function createConfigNormalizer(
  transformations: Record<string, (value: unknown) => unknown>
): (obj: unknown) => Record<string, unknown> {
  return (obj: unknown): Record<string, unknown> => {
    if (!isRecord(obj)) {
      return {};
    }

    const normalized: Record<string, unknown> = { ...obj };

    for (const [key, transform] of Object.entries(transformations)) {
      if (key in normalized) {
        normalized[key] = transform(normalized[key]);
      }
    }

    return normalized;
  };
}
