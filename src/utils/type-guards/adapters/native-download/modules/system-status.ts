/**
 * System Status Type Guards
 *
 * This module contains type guards for validating system status type objects,
 * ensuring type safety for integration status, database information, system metrics,
 * Docker container information, and application status reporting.
 *
 * @module SystemStatusTypeGuards
 * @category TypeGuards
 * @subcategory Kapowarr
 */

import type {
  IntegrationStatusData,
  DatabaseInfo,
  SystemInfo,
  DockerInfo,
  ApplicationInfo,
  SystemStatusResponse
} from "@/types/system-status";

/**
 * Type guard for IntegrationStatusData
 * Validates that an object conforms to the IntegrationStatusData interface
 */
export function isIntegrationStatusData(obj: unknown): obj is IntegrationStatusData {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    (!("metadata" in candidate) || "metadata" in candidate) &&
    (!("sources" in candidate) || "sources" in candidate)
  );
}

/**
 * Type guard for DatabaseInfo
 * Validates that an object conforms to the DatabaseInfo interface
 */
export function isDatabaseInfo(obj: unknown): obj is DatabaseInfo {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    typeof candidate["name"] === "string" &&
    typeof candidate["host"] === "string" &&
    typeof candidate["port"] === "string" &&
    typeof candidate["user"] === "string" &&
    typeof candidate["isConnected"] === "boolean"
  );
}

/**
 * Type guard for SystemInfo
 * Validates that an object conforms to the SystemInfo interface
 */
export function isSystemInfo(obj: unknown): obj is SystemInfo {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    typeof candidate["platform"] === "string" &&
    typeof candidate["arch"] === "string" &&
    Array.isArray(candidate["cpus"]) &&
    typeof candidate["totalMemory"] === "number" &&
    typeof candidate["freeMemory"] === "number" &&
    typeof candidate["uptime"] === "number" &&
    Array.isArray(candidate["loadAvg"]) && candidate["loadAvg"].every((x: unknown) => typeof x === "number") &&
    typeof candidate["hostname"] === "string" &&
    "networkInterfaces" in candidate
  );
}

/**
 * Type guard for DockerInfo
 * Validates that an object conforms to the DockerInfo interface
 */
export function isDockerInfo(obj: unknown): obj is DockerInfo {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    typeof candidate["isDocker"] === "boolean" &&
    "containerInfo" in candidate
  );
}

/**
 * Type guard for ApplicationInfo
 * Validates that an object conforms to the ApplicationInfo interface
 */
export function isApplicationInfo(obj: unknown): obj is ApplicationInfo {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    typeof candidate["version"] === "string" &&
    typeof candidate["nodeEnv"] === "string" &&
    typeof candidate["port"] === "string" &&
    typeof candidate["nodeVersion"] === "string" &&
    typeof candidate["startTime"] === "string"
  );
}

/**
 * Type guard for SystemStatusResponse
 * Validates that an object conforms to the SystemStatusResponse interface
 */
export function isSystemStatusResponse(obj: unknown): obj is SystemStatusResponse {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    "database" in candidate &&
    "system" in candidate &&
    "docker" in candidate &&
    "application" in candidate &&
    (!("integrations" in candidate) || "integrations" in candidate)
  );
}