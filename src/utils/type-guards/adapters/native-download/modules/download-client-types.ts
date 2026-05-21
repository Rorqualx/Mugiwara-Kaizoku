/**
 * Download Client Types Type Guards
 *
 * This module contains type guard utilities for download client configurations
 * to reduce complexity in the main config-types module.
 *
 * @module DownloadClientTypesTypeGuards
 * @category TypeGuards
 * @subcategory Kapowarr
 */

import {
  isOptionalString,
  isOptionalBoolean,
  isOptionalNumber,
  isOptionalDate
} from './base-settings';

/**
 * Validates that a value is a valid Transmission configuration
 */
export function isValidTransmissionConfig(candidate: Record<string, unknown>): boolean {
  return (
    isOptionalString(candidate["type"]) &&
    isOptionalString(candidate["host"]) &&
    isOptionalNumber(candidate["port"]) &&
    isOptionalString(candidate["username"]) &&
    isOptionalString(candidate["password"]) &&
    isOptionalBoolean(candidate["ssl"]) &&
    isOptionalString(candidate["downloadDir"]) &&
    isOptionalBoolean(candidate["enabled"]) &&
    isOptionalNumber(candidate["priority"]) &&
    isOptionalBoolean(candidate["removeCompleted"]) &&
    isOptionalBoolean(candidate["removeFailed"]) &&
    isOptionalNumber(candidate["timeout"]) &&
    isOptionalDate(candidate["lastSync"])
  );
}

/**
 * Validates that a value is a valid Deluge configuration
 */
export function isValidDelugeConfig(candidate: Record<string, unknown>): boolean {
  return (
    isOptionalString(candidate["type"]) &&
    isOptionalString(candidate["host"]) &&
    isOptionalNumber(candidate["port"]) &&
    isOptionalString(candidate["username"]) &&
    isOptionalString(candidate["password"]) &&
    isOptionalBoolean(candidate["ssl"]) &&
    isOptionalString(candidate["downloadDir"]) &&
    isOptionalBoolean(candidate["enabled"]) &&
    isOptionalNumber(candidate["priority"]) &&
    isOptionalBoolean(candidate["removeCompleted"]) &&
    isOptionalBoolean(candidate["removeFailed"]) &&
    isOptionalNumber(candidate["timeout"]) &&
    isOptionalDate(candidate["lastSync"])
  );
}

/**
 * Validates that a value is a valid SABnzbd configuration
 */
export function isValidSABnzbdConfig(candidate: Record<string, unknown>): boolean {
  return (
    isOptionalString(candidate["type"]) &&
    isOptionalString(candidate["host"]) &&
    isOptionalNumber(candidate["port"]) &&
    isOptionalString(candidate["apiKey"]) &&
    isOptionalString(candidate["username"]) &&
    isOptionalString(candidate["password"]) &&
    isOptionalBoolean(candidate["ssl"]) &&
    isOptionalString(candidate["downloadDir"]) &&
    isOptionalBoolean(candidate["enabled"]) &&
    isOptionalNumber(candidate["priority"]) &&
    isOptionalBoolean(candidate["removeCompleted"]) &&
    isOptionalBoolean(candidate["removeFailed"]) &&
    isOptionalNumber(candidate["timeout"]) &&
    isOptionalDate(candidate["lastSync"])
  );
}

/**
 * Validates that a value is a valid NZBGet configuration
 */
export function isValidNZBGetConfig(candidate: Record<string, unknown>): boolean {
  return (
    isOptionalString(candidate["type"]) &&
    isOptionalString(candidate["host"]) &&
    isOptionalNumber(candidate["port"]) &&
    isOptionalString(candidate["username"]) &&
    isOptionalString(candidate["password"]) &&
    isOptionalBoolean(candidate["ssl"]) &&
    isOptionalString(candidate["downloadDir"]) &&
    isOptionalBoolean(candidate["enabled"]) &&
    isOptionalNumber(candidate["priority"]) &&
    isOptionalBoolean(candidate["removeCompleted"]) &&
    isOptionalBoolean(candidate["removeFailed"]) &&
    isOptionalNumber(candidate["timeout"]) &&
    isOptionalDate(candidate["lastSync"])
  );
}

/**
 * Validates that a value is a valid download client settings field
 */
export function isValidDownloadClientField(candidate: Record<string, unknown>, field: string): boolean {
  return !(field in candidate) || field in candidate;
}

/**
 * Validates that a value is a valid download client settings
 */
export function isValidDownloadClientSettings(candidate: Record<string, unknown>): boolean {
  return (
    isValidDownloadClientField(candidate, "transmission") &&
    isValidDownloadClientField(candidate, "deluge") &&
    isValidDownloadClientField(candidate, "sabnzbd") &&
    isValidDownloadClientField(candidate, "nzbget") &&
    isValidDownloadClientField(candidate, "qbittorrent") &&
    isValidDownloadClientField(candidate, "rtorrent")
  );
}
