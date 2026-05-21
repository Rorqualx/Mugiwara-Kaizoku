/**
 * Notification & Configuration Type Guards
 *
 * Type guards for notification systems, configuration objects, and provider status.
 * Focuses on notification configs, app settings, and metadata validation.
 *
 * Type Guards:
 * - isNotificationConfig: Validates notification configuration
 * - isNotificationTestResult: Validates notification test results
 * - isProviderStatus: Validates provider status objects
 * - isAppConfig: Validates app configuration
 * - isMetadataDetails: Validates metadata details
 * - isProviderMetadata: Validates provider metadata
 *
 * Extracted from: search-types.ts (lines 532-534, 540-562, 568-581, 587-601, 607-618, 624-638)
 */

import type {
  NotificationConfig,
  NotificationTestResult,
  ProviderStatus,
  AppConfig,
  MetadataDetails,
  ProviderMetadata
} from "@/types/search.types";

// Import from foundation utils
import {
  isRecord,
  validateRequiredString,
  validateOptionalString,
  validateOptionalStringArray,
  validateOptionalNumber,
  validatePropertyExists,
  validateOptionalProperty,
  validateRequiredBoolean,
  validateRequiredField,
  validateDateField,
  validateOptionalDateField,
  validateOptionalObject
} from './search-types-utils';

/**
 * Type guard for AppConfig
 * Validates that an object conforms to the AppConfig interface
 */
export function isAppConfig(obj: unknown): obj is AppConfig {
  return typeof obj === "object" && obj !== null;
}

/**
 * Type guard for MetadataDetails
 * Validates that an object conforms to the MetadataDetails interface
 */
export function isMetadataDetails(obj: unknown): obj is MetadataDetails {
  if (!isRecord(obj)) return false;

  return (
    validateRequiredString(obj, "title") &&
    validateOptionalStringArray(obj, "alternativeTitles") &&
    validateOptionalString(obj, "description") &&
    validateOptionalProperty(obj, "status") &&
    validateOptionalStringArray(obj, "genres") &&
    validateOptionalProperty(obj, "tags") &&
    validateOptionalStringArray(obj, "authors") &&
    validateOptionalStringArray(obj, "artists") &&
    validateOptionalString(obj, "publisher") &&
    validateOptionalNumber(obj, "volumes") &&
    validateOptionalNumber(obj, "chapters") &&
    validateOptionalString(obj, "coverImage") &&
    validateOptionalString(obj, "bannerImage")
  );
}

/**
 * Type guard for ProviderMetadata
 * Validates that an object conforms to the ProviderMetadata interface
 */
export function isProviderMetadata(obj: unknown): obj is ProviderMetadata {
  if (!isRecord(obj)) return false;

  return (
    validateRequiredString(obj, "provider") &&
    validatePropertyExists(obj, "data") &&
    validateOptionalNumber(obj, "confidence") &&
    validateOptionalDateField(obj, "lastUpdated")
  );
}

/**
 * Type guard for NotificationConfig
 * Validates that an object conforms to the NotificationConfig interface
 */
export function isNotificationConfig(obj: unknown): obj is NotificationConfig {
  if (!isRecord(obj)) return false;

  return (
    validateOptionalObject(obj, "email") &&
    validateOptionalObject(obj, "discord") &&
    validateOptionalObject(obj, "slack") &&
    validateOptionalObject(obj, "telegram") &&
    validateOptionalObject(obj, "webhook")
  );
}

/**
 * Type guard for NotificationTestResult
 * Validates that an object conforms to the NotificationTestResult interface
 */
export function isNotificationTestResult(obj: unknown): obj is NotificationTestResult {
  if (!isRecord(obj)) return false;

  return (
    validateRequiredBoolean(obj, "success") &&
    validateRequiredString(obj, "message")
  );
}

/**
 * Type guard for ProviderStatus
 * Validates that an object conforms to the ProviderStatus interface
 */
export function isProviderStatus(obj: unknown): obj is ProviderStatus {
  if (!isRecord(obj)) return false;

  return (
    validateRequiredString(obj, "provider") &&
    validateRequiredField(obj, "status") &&
    validateDateField(obj, "lastCheck") &&
    validateOptionalNumber(obj, "responseTime") &&
    validateOptionalString(obj, "error")
  );
}