/**
 * Prisma Transaction Type Guards
 *
 * This module contains type guards for validating Prisma transaction type objects,
 * ensuring type safety for database transaction operations and job payloads.
 *
 * @module PrismaTransactionTypeGuards
 * @category TypeGuards
 * @subcategory Kapowarr
 */

import type {
  JobTransaction,
  TaskPayload
} from "@/types/prisma-transaction";

/**
 * Type guard for JobTransaction
 * Validates that an object conforms to the JobTransaction interface
 */
export function isJobTransaction(obj: unknown): obj is JobTransaction {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    "job" in candidate
  );
}

/**
 * Type guard for TaskPayload
 * Validates that an object conforms to the TaskPayload interface
 */
export function isTaskPayload(obj: unknown): obj is TaskPayload {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    typeof candidate["type"] === "string" &&
    "data" in candidate
  );
}