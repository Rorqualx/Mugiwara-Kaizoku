/**
 * Client Types Type Guards
 *
 * This module contains type guards for validating client-side type objects,
 * ensuring type safety for job-related operations.
 *
 * @module ClientTypesTypeGuards
 * @category TypeGuards
 * @subcategory Kapowarr
 */

import type { JobError, DomainJob } from "@/types/clientTypes";

import {
  hasDomainJobStructure,
  isValidDomainJobStatus,
  isValidProgress,
  isValidTimestamp,
  isValidPriority,
  isValidRetryCount,
  isValidTimeout,
  isValidWorkerId,
  isValidQueue
} from "./domain-job-utils";

/**
 * Type guard for JobError
 * Validates that an object conforms to the JobError interface
 */
export function isJobError(obj: unknown): obj is JobError {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    typeof candidate["code"] === "string" &&
    typeof candidate["message"] === "string" &&
    (!("details" in candidate) || "details" in candidate) &&
    (!("jobId" in candidate) || "jobId" in candidate) &&
    (!("jobType" in candidate) || "jobType" in candidate)
  );
}

/**
 * Validates required properties of a domain job
 */
function validateRequiredDomainJobProperties(candidate: Record<string, unknown>): boolean {
  return (
    "id" in candidate &&
    "jobType" in candidate &&
    "status" in candidate &&
    isValidDomainJobStatus(candidate["status"]) &&
    isValidPriority(candidate["priority"]) &&
    "payload" in candidate &&
    "metadata" in candidate &&
    isValidTimestamp(candidate["createdAt"]) &&
    isValidTimestamp(candidate["updatedAt"])
  );
}

/**
 * Validates optional properties of a domain job
 */
function validateOptionalDomainJobProperties(candidate: Record<string, unknown>): boolean {
  // Check optional date properties
  if ("completedAt" in candidate && !isValidTimestamp(candidate["completedAt"])) {
    return false;
  }
  if ("failedAt" in candidate && !isValidTimestamp(candidate["failedAt"])) {
    return false;
  }

  // Check optional numeric properties
  if ("progress" in candidate && !isValidProgress(candidate["progress"])) {
    return false;
  }
  if ("retryCount" in candidate && !isValidRetryCount(candidate["retryCount"])) {
    return false;
  }
  if ("maxRetries" in candidate && !isValidRetryCount(candidate["maxRetries"])) {
    return false;
  }
  if ("timeout" in candidate && !isValidTimeout(candidate["timeout"])) {
    return false;
  }

  // Check optional string properties
  if ("workerId" in candidate && !isValidWorkerId(candidate["workerId"])) {
    return false;
  }
  if ("queue" in candidate && !isValidQueue(candidate["queue"])) {
    return false;
  }

  return true;
}

/**
 * Type guard for DomainJob
 * Validates that an object conforms to the DomainJob interface
 */
export function isDomainJob(obj: unknown): obj is DomainJob {
  // Basic structure check
  if (!hasDomainJobStructure(obj)) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  // Check required properties
  if (!validateRequiredDomainJobProperties(candidate)) {
    return false;
  }

  // Check optional properties
  if (!validateOptionalDomainJobProperties(candidate)) {
    return false;
  }

  return true;
}
