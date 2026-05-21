/**
 * System Type Guards
 *
 * This module contains type guards for validating system type objects,
 * ensuring type safety for system health monitoring, settings management,
 * application information, Docker container details, extended metrics,
 * and integration status reporting.
 *
 * @module SystemTypeGuards
 * @category TypeGuards
 * @subcategory Kapowarr
 */

import type {
  SystemHealth,
  SystemSettings,
  ApplicationInfoType,
  DockerInfoType,
  ExtendedSystemMetrics,
  IntegrationInfo
} from "@/types/system";

/**
 * Type guard for SystemHealth
 * Validates that an object conforms to the SystemHealth interface
 */
export function isSystemHealth(obj: unknown): obj is SystemHealth {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    "status" in candidate &&
    typeof candidate["database"] === "boolean" &&
    typeof candidate["storage"] === "boolean" &&
    typeof candidate["network"] === "boolean" &&
    "services" in candidate
  );
}

/**
 * Type guard for SystemSettings
 * Validates that an object conforms to the SystemSettings interface
 */
export function isSystemSettings(obj: unknown): obj is SystemSettings {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    typeof candidate["maintenanceMode"] === "boolean" &&
    typeof candidate["debugMode"] === "boolean" &&
    typeof candidate["logLevel"] === "string" &&
    typeof candidate["maxConcurrentJobs"] === "number" &&
    typeof candidate["cacheEnabled"] === "boolean"
  );
}

/**
 * Type guard for ApplicationInfoType
 * Validates that an object conforms to the ApplicationInfoType interface
 */
export function isApplicationInfoType(obj: unknown): obj is ApplicationInfoType {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    typeof candidate["name"] === "string" &&
    typeof candidate["version"] === "string" &&
    typeof candidate["environment"] === "string" &&
    typeof candidate["uptime"] === "number" &&
    typeof candidate["nodeVersion"] === "string" &&
    (!("npmVersion" in candidate) || typeof candidate["npmVersion"] === "string")
  );
}

/**
 * Type guard for DockerInfoType
 * Validates that an object conforms to the DockerInfoType interface
 */
export function isDockerInfoType(obj: unknown): obj is DockerInfoType {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    typeof candidate["isDocker"] === "boolean" &&
    (!("containerName" in candidate) || typeof candidate["containerName"] === "string") &&
    (!("containerId" in candidate) || typeof candidate["containerId"] === "string") &&
    (!("image" in candidate) || typeof candidate["image"] === "string") &&
    (!("version" in candidate) || typeof candidate["version"] === "string")
  );
}

/**
 * Type guard for ExtendedSystemMetrics
 * Validates that an object conforms to the ExtendedSystemMetrics interface
 */
export function isExtendedSystemMetrics(obj: unknown): obj is ExtendedSystemMetrics {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    "cpu" in candidate &&
    "memory" in candidate &&
    "disk" in candidate &&
    (!("network" in candidate) || "network" in candidate)
  );
}

/**
 * Type guard for IntegrationInfo
 * Validates that an object conforms to the IntegrationInfo interface
 */
export function isIntegrationInfo(obj: unknown): obj is IntegrationInfo {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    typeof candidate["name"] === "string" &&
    "status" in candidate &&
    (!("lastSync" in candidate) || candidate["lastSync"] instanceof Date) &&
    (!("error" in candidate) || typeof candidate["error"] === "string")
  );
}