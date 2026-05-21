/**
 * Task Unions Type Guards
 *
 * This module contains type guards for validating task union type objects,
 * ensuring type safety for background task management, job states, task filtering,
 * and progress tracking in the application's task execution system.
 *
 * @module TaskUnionsTypeGuards
 * @category TypeGuards
 * @subcategory Kapowarr
 */

import type {
  Task,
  TaskWithProgress,
  JobState,
  TaskFilter
} from "@/types/task-unions";

/**
 * Type guard for Task
 * Validates that an object conforms to the Task interface
 */
export function isTask(obj: unknown): obj is Task {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    typeof candidate["id"] === "number" &&
    "type" in candidate &&
    "status" in candidate &&
    candidate["createdAt"] instanceof Date &&
    candidate["updatedAt"] instanceof Date &&
    candidate["lastChecked"] instanceof Date &&
    "scheduledAt" in candidate &&
    "interval" in candidate &&
    typeof candidate["priority"] === "number" &&
    "queueId" in candidate &&
    typeof candidate["retryCount"] === "number" &&
    typeof candidate["maxRetries"] === "number" &&
    "mangaId" in candidate &&
    "chapterId" in candidate &&
    "errorMessage" in candidate
  );
}

/**
 * Type guard for TaskWithProgress
 * Validates that an object conforms to the TaskWithProgress interface
 */
export function isTaskWithProgress(obj: unknown): obj is TaskWithProgress {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    typeof candidate["progress"] === "number"
  );
}

/**
 * Type guard for JobState
 * Validates that an object conforms to the JobState interface
 */
export function isJobState(obj: unknown): obj is JobState {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    Array.isArray(candidate["tasks"]) &&
    typeof candidate["isLoading"] === "boolean" &&
    "error" in candidate &&
    "filter" in candidate
  );
}

/**
 * Type guard for TaskFilter
 * Validates that an object conforms to the TaskFilter interface
 */
export function isTaskFilter(obj: unknown): obj is TaskFilter {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const candidate = obj as Record<string, unknown>;

  return (
    (!("status" in candidate) || Array.isArray(candidate["status"])) &&
    (!("type" in candidate) || Array.isArray(candidate["type"])) &&
    (!("mangaId" in candidate) || typeof candidate["mangaId"] === "number") &&
    (!("page" in candidate) || typeof candidate["page"] === "number") &&
    (!("limit" in candidate) || typeof candidate["limit"] === "number") &&
    (!("sortBy" in candidate) || "sortBy" in candidate) &&
    (!("sortDirection" in candidate) || "sortDirection" in candidate)
  );
}