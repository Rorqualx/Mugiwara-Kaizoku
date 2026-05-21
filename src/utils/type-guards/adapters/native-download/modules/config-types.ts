/**
 * Config Types Type Guards
 *
 * This module contains type guards for validating configuration type objects,
 * ensuring type safety for various integration configurations.
 *
 * @module ConfigTypesTypeGuards
 * @category TypeGuards
 * @subcategory Kapowarr
 */

import type {
  BaseIntegrationConfig,
  NativeDownloadConfig,
  FandomConfig,
  AnilistConfig,
  TransmissionConfig,
  DelugeConfig,
  SABnzbdConfig,
  NZBGetConfig,
  ProwlarrConfig,
  DiscordConfig,
  EmailConfig,
  SlackConfig,
  TelegramConfig,
  KavitaConfig,
  KomgaConfig,
  NestedIntegrationSettings,
  IntegrationSettings
} from "@/types/config.types";

import {
  isValidTransmissionConfig,
  isValidDelugeConfig,
  isValidSABnzbdConfig,
  isValidNZBGetConfig
} from './download-client-types';

/**
 * Helper function to validate optional string properties
 */
function validateOptionalString(obj: Record<string, unknown>, key: string): boolean {
  return !(key in obj) || typeof obj[key] === "string";
}

/**
 * Helper function to validate optional boolean properties
 */
function validateOptionalBoolean(obj: Record<string, unknown>, key: string): boolean {
  return !(key in obj) || typeof obj[key] === "boolean";
}

/**
 * Helper function to validate optional number properties
 */
function validateOptionalNumber(obj: Record<string, unknown>, key: string): boolean {
  return !(key in obj) || typeof obj[key] === "number";
}

/**
 * Helper function to validate optional string array properties
 */
function validateOptionalStringArray(obj: Record<string, unknown>, key: string): boolean {
  return !(key in obj) || (Array.isArray(obj[key]) && (obj[key] as unknown[]).every((x: unknown) => typeof x === "string"));
}

/**
 * Helper function to validate optional Date properties
 */
function validateOptionalDate(obj: Record<string, unknown>, key: string): boolean {
  return !(key in obj) || obj[key] instanceof Date;
}

/**
 * Type guard for BaseIntegrationConfig
 * Validates that an object conforms to the BaseIntegrationConfig interface
 */
export function isBaseIntegrationConfig(obj: unknown): obj is BaseIntegrationConfig {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    typeof candidate["enabled"] === "boolean" &&
    (!("name" in candidate) || typeof candidate["name"] === "string") &&
    (!("id" in candidate) || typeof candidate["id"] === "string") &&
    (!("priority" in candidate) || typeof candidate["priority"] === "number") &&
    (!("timeout" in candidate) || typeof candidate["timeout"] === "number")
  );
}

/**
 * Type guard for NativeDownloadConfig
 * Validates that an object conforms to the NativeDownloadConfig interface
 */
export function isNativeDownloadConfig(obj: unknown): obj is NativeDownloadConfig {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    typeof candidate["url"] === "string" &&
    typeof candidate["apiKey"] === "string" &&
    (!("baseUrl" in candidate) || typeof candidate["baseUrl"] === "string") &&
    (!("rootFolder" in candidate) || typeof candidate["rootFolder"] === "string") &&
    (!("qualityProfile" in candidate) || typeof candidate["qualityProfile"] === "string") &&
    (!("metadataProfile" in candidate) || typeof candidate["metadataProfile"] === "string") &&
    (!("selectors" in candidate) || "selectors" in candidate)
  );
}

/**
 * Type guard for FandomConfig
 * Validates that an object conforms to the FandomConfig interface
 */
export function isFandomConfig(obj: unknown): obj is FandomConfig {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    (!("baseUrl" in candidate) || typeof candidate["baseUrl"] === "string") &&
    (!("apiKey" in candidate) || typeof candidate["apiKey"] === "string") &&
    (!("wikiDomain" in candidate) || typeof candidate["wikiDomain"] === "string")
  );
}

/**
 * Type guard for AnilistConfig
 * Validates that an object conforms to the AnilistConfig interface
 */
export function isAnilistConfig(obj: unknown): obj is AnilistConfig {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    (!("clientId" in candidate) || typeof candidate["clientId"] === "string") &&
    (!("clientSecret" in candidate) || typeof candidate["clientSecret"] === "string") &&
    (!("accessToken" in candidate) || typeof candidate["accessToken"] === "string")
  );
}

/**
 * Type guard for TransmissionConfig
 * Validates that an object conforms to the TransmissionConfig interface
 */
export function isTransmissionConfig(obj: unknown): obj is TransmissionConfig {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }
  return isValidTransmissionConfig(obj as Record<string, unknown>);
}

/**
 * Type guard for DelugeConfig
 * Validates that an object conforms to the DelugeConfig interface
 */
export function isDelugeConfig(obj: unknown): obj is DelugeConfig {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }
  return isValidDelugeConfig(obj as Record<string, unknown>);
}

/**
 * Type guard for SABnzbdConfig
 * Validates that an object conforms to the SABnzbdConfig interface
 */
export function isSABnzbdConfig(obj: unknown): obj is SABnzbdConfig {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }
  return isValidSABnzbdConfig(obj as Record<string, unknown>);
}

/**
 * Type guard for NZBGetConfig
 * Validates that an object conforms to the NZBGetConfig interface
 */
export function isNZBGetConfig(obj: unknown): obj is NZBGetConfig {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }
  return isValidNZBGetConfig(obj as Record<string, unknown>);
}

/**
 * Type guard for ProwlarrConfig
 * Validates that an object conforms to the ProwlarrConfig interface
 */
export function isProwlarrConfig(obj: unknown): obj is ProwlarrConfig {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    typeof candidate["apiUrl"] === "string" &&
    typeof candidate["apiKey"] === "string" &&
    (!("syncCategories" in candidate) || Array.isArray(candidate["syncCategories"]) && candidate["syncCategories"].every((x: unknown) => typeof x === "number"))
  );
}

/**
 * Type guard for DiscordConfig
 * Validates that an object conforms to the DiscordConfig interface
 */
export function isDiscordConfig(obj: unknown): obj is DiscordConfig {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    typeof candidate["webhookUrl"] === "string" &&
    (!("username" in candidate) || typeof candidate["username"] === "string") &&
    (!("avatarUrl" in candidate) || typeof candidate["avatarUrl"] === "string")
  );
}

/**
 * Type guard for EmailConfig
 * Validates that an object conforms to the EmailConfig interface
 */
export function isEmailConfig(obj: unknown): obj is EmailConfig {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    typeof candidate["host"] === "string" &&
    typeof candidate["port"] === "number" &&
    (!("username" in candidate) || typeof candidate["username"] === "string") &&
    (!("password" in candidate) || typeof candidate["password"] === "string") &&
    typeof candidate["from"] === "string" &&
    Array.isArray(candidate["to"]) && candidate["to"].every((x: unknown) => typeof x === "string") &&
    (!("ssl" in candidate) || typeof candidate["ssl"] === "boolean")
  );
}

/**
 * Type guard for SlackConfig
 * Validates that an object conforms to the SlackConfig interface
 */
export function isSlackConfig(obj: unknown): obj is SlackConfig {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    typeof candidate["webhookUrl"] === "string" &&
    (!("channel" in candidate) || typeof candidate["channel"] === "string") &&
    (!("username" in candidate) || typeof candidate["username"] === "string") &&
    (!("iconEmoji" in candidate) || typeof candidate["iconEmoji"] === "string")
  );
}

/**
 * Type guard for TelegramConfig
 * Validates that an object conforms to the TelegramConfig interface
 */
export function isTelegramConfig(obj: unknown): obj is TelegramConfig {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    typeof candidate["botToken"] === "string" &&
    typeof candidate["chatId"] === "string"
  );
}

/**
 * Type guard for KavitaConfig
 * Validates that an object conforms to the KavitaConfig interface
 */
export function isKavitaConfig(obj: unknown): obj is KavitaConfig {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    validateOptionalString(candidate, "host") &&
    validateOptionalString(candidate, "baseUrl") &&
    validateOptionalString(candidate, "apiUrl") &&
    validateOptionalString(candidate, "apiKey") &&
    validateOptionalString(candidate, "username") &&
    validateOptionalString(candidate, "password") &&
    validateOptionalBoolean(candidate, "syncEnabled") &&
    validateOptionalBoolean(candidate, "autoImport") &&
    validateOptionalBoolean(candidate, "autoSync") &&
    validateOptionalStringArray(candidate, "libraries") &&
    validateOptionalNumber(candidate, "syncInterval") &&
    validateOptionalDate(candidate, "lastSync")
  );
}

/**
 * Type guard for KomgaConfig
 * Validates that an object conforms to the KomgaConfig interface
 */
export function isKomgaConfig(obj: unknown): obj is KomgaConfig {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    validateOptionalString(candidate, "host") &&
    validateOptionalString(candidate, "baseUrl") &&
    validateOptionalString(candidate, "apiUrl") &&
    validateOptionalString(candidate, "username") &&
    validateOptionalString(candidate, "password") &&
    validateOptionalString(candidate, "apiKey") &&
    validateOptionalBoolean(candidate, "syncEnabled") &&
    validateOptionalBoolean(candidate, "autoImport") &&
    validateOptionalBoolean(candidate, "autoSync") &&
    validateOptionalStringArray(candidate, "libraries") &&
    validateOptionalNumber(candidate, "syncInterval") &&
    validateOptionalDate(candidate, "lastSync")
  );
}

/**
 * Type guard for NestedIntegrationSettings
 * Validates that an object conforms to the NestedIntegrationSettings interface
 * All properties are optional, so any object passes validation
 */
export function isNestedIntegrationSettings(obj: unknown): obj is NestedIntegrationSettings {
  // All properties in NestedIntegrationSettings are optional
  // So we only need to verify it's a valid object
  return typeof obj === "object" && obj !== null;
}

/**
 * Type guard for IntegrationSettings
 * Validates that an object conforms to the IntegrationSettings interface
 * All properties are optional, so any object passes validation
 */
export function isIntegrationSettings(obj: unknown): obj is IntegrationSettings {
  // All properties in IntegrationSettings are optional
  // So we only need to verify it's a valid object
  return typeof obj === "object" && obj !== null;
}
