/**
 * Prowlarr System Types Type Guards
 * 
 * Type guards for Prowlarr system-related types to reduce complexity
 * and improve maintainability.
 * 
 * @module ProwlarrSystemTypeGuards
 * @category TypeGuards
 * @subcategory Kapowarr
 */

import type {
  SystemStatus,
  ProwlarrSystemStatus
} from "@/types/prowlarr";

import {
  isValidObject,
  hasRequiredProperties,
  hasOptionalProperties
} from "./utils";

/**
 * Type guard for SystemStatus
 * Validates that an object conforms to the SystemStatus interface
 */
export function isSystemStatus(obj: unknown): obj is SystemStatus {
  if (!isValidObject(obj)) {
    return false;
  }

  const requiredProps: Record<string, "string" | "number" | "boolean" | "object" | "array"> = {
    "version": "string",
    "buildTime": "string",
    "isDebug": "boolean",
    "isProduction": "boolean",
    "isAdmin": "boolean",
    "isUserInteractive": "boolean",
    "startupPath": "string",
    "appData": "string",
    "osName": "string",
    "osVersion": "string",
    "isMonoRuntime": "boolean",
    "isMono": "boolean",
    "isLinux": "boolean",
    "isOsx": "boolean",
    "isWindows": "boolean",
    "mode": "string",
    "branch": "string",
    "authentication": "string",
    "sqliteVersion": "string",
    "urlBase": "string",
    "startTime": "string"
  };

  return hasRequiredProperties(obj, requiredProps);
}

/**
 * Type guard for ProwlarrSystemStatus
 * Validates that an object conforms to the ProwlarrSystemStatus interface
 */
export function isProwlarrSystemStatus(obj: unknown): obj is ProwlarrSystemStatus {
  if (!isValidObject(obj)) {
    return false;
  }

  const requiredProps: Record<string, "string" | "number" | "boolean" | "object" | "array"> = {
    "version": "string",
    "buildTime": "string",
    "isDebug": "boolean",
    "isProduction": "boolean",
    "osName": "string",
    "osVersion": "string",
    "mode": "string",
    "branch": "string",
    "authentication": "string",
    "startTime": "string"
  };

  const optionalProps: Record<string, "string" | "number" | "boolean" | "object" | "array"> = {
    "databaseType": "string",
    "databaseVersion": "string",
    "isDocker": "boolean"
  };

  return (
    hasRequiredProperties(obj, requiredProps) &&
    hasOptionalProperties(obj, optionalProps)
  );
}
