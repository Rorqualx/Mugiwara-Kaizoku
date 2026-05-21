/**
 * Integration Services Type Guards
 *
 * This module contains type guard utilities for integration service configurations
 * to reduce complexity in the main config-types module.
 *
 * @module IntegrationServicesTypeGuards
 * @category TypeGuards
 * @subcategory Kapowarr
 */

import {
  isOptionalString,
  isOptionalBoolean,
  isOptionalNumber,
  isOptionalDate,
  isOptionalStringArray
} from './base-settings';

/**
 * Validates that a value is a valid Kavita configuration
 */
export function isValidKavitaConfig(candidate: Record<string, unknown>): boolean {
  return (
    isOptionalString(candidate["type"]) &&
    isOptionalString(candidate["host"]) &&
    isOptionalString(candidate["baseUrl"]) &&
    isOptionalString(candidate["apiUrl"]) &&
    isOptionalString(candidate["apiKey"]) &&
    isOptionalString(candidate["username"]) &&
    isOptionalString(candidate["password"]) &&
    isOptionalBoolean(candidate["syncEnabled"]) &&
    isOptionalBoolean(candidate["autoImport"]) &&
    isOptionalStringArray(candidate["libraries"]) &&
    isOptionalNumber(candidate["syncInterval"]) &&
    isOptionalBoolean(candidate["autoSync"]) &&
    isOptionalString(candidate["syncDirection"]) &&
    isOptionalDate(candidate["lastSync"])
  );
}

/**
 * Validates that a value is a valid Komga configuration
 */
export function isValidKomgaConfig(candidate: Record<string, unknown>): boolean {
  return (
    isOptionalString(candidate["type"]) &&
    isOptionalString(candidate["host"]) &&
    isOptionalString(candidate["baseUrl"]) &&
    isOptionalString(candidate["apiUrl"]) &&
    isOptionalString(candidate["authMethod"]) &&
    isOptionalString(candidate["username"]) &&
    isOptionalString(candidate["password"]) &&
    isOptionalString(candidate["apiKey"]) &&
    isOptionalBoolean(candidate["syncEnabled"]) &&
    isOptionalBoolean(candidate["autoImport"]) &&
    isOptionalStringArray(candidate["libraries"]) &&
    isOptionalNumber(candidate["syncInterval"]) &&
    isOptionalBoolean(candidate["autoSync"]) &&
    isOptionalString(candidate["syncDirection"]) &&
    isOptionalDate(candidate["lastSync"])
  );
}

/**
 * Validates that a value is a valid integration settings field
 */
export function isValidIntegrationField(candidate: Record<string, unknown>, field: string): boolean {
  return !(field in candidate) || field in candidate;
}

/**
 * Validates that a value is a valid nested integration settings
 */
export function isValidNestedIntegrationSettings(candidate: Record<string, unknown>): boolean {
  return (
    isValidIntegrationField(candidate, "kavita") &&
    isValidIntegrationField(candidate, "komga") &&
    isValidIntegrationField(candidate, "prowlarr") &&
    isValidIntegrationField(candidate, "suwayomi") &&
    isValidIntegrationField(candidate, "comicvine") &&
    isValidIntegrationField(candidate, "anilist") &&
    isValidIntegrationField(candidate, "fandom") &&
    isValidIntegrationField(candidate, "native_download") &&
    isValidIntegrationField(candidate, "transmission") &&
    isValidIntegrationField(candidate, "deluge") &&
    isValidIntegrationField(candidate, "sabnzbd") &&
    isValidIntegrationField(candidate, "nzbget") &&
    isValidIntegrationField(candidate, "discord") &&
    isValidIntegrationField(candidate, "email") &&
    isValidIntegrationField(candidate, "slack") &&
    isValidIntegrationField(candidate, "telegram")
  );
}

/**
 * Validates that a value is a valid integration settings
 */
export function isValidIntegrationSettings(candidate: Record<string, unknown>): boolean {
  return (
    isValidIntegrationField(candidate, "kavita") &&
    isValidIntegrationField(candidate, "komga") &&
    isValidIntegrationField(candidate, "prowlarr") &&
    isValidIntegrationField(candidate, "suwayomi") &&
    isValidIntegrationField(candidate, "comicvine") &&
    isValidIntegrationField(candidate, "anilist") &&
    isValidIntegrationField(candidate, "fandom") &&
    isValidIntegrationField(candidate, "native_download") &&
    isValidIntegrationField(candidate, "transmission") &&
    isValidIntegrationField(candidate, "deluge") &&
    isValidIntegrationField(candidate, "sabnzbd") &&
    isValidIntegrationField(candidate, "nzbget") &&
    isValidIntegrationField(candidate, "discord") &&
    isValidIntegrationField(candidate, "email") &&
    isValidIntegrationField(candidate, "slack") &&
    isValidIntegrationField(candidate, "telegram")
  );
}
