/**
 * Job Validation Utilities
 *
 * This module provides validation functions for job types and statuses,
 * ensuring that values used throughout the application conform to the
 * domain type definitions.
 */
import { JobStatus, JobType } from '@prisma/client';

import { logger } from '../utils/logger';

// Re-export JobStatus and JobType for external use
export { JobStatus, JobType };

/**
 * Custom error interface for job-related errors
 * Extends the base Error class with additional properties for job handling
 */
export interface JobError extends Error {
  taskId?: string;  // Keep for compatibility with existing error handling
  jobType?: JobType;  // Keep for compatibility with existing error handling
  code?: string | JobStatus;  // Allow JobStatus enum values for code
}

/**
 * Helper functions for converting string values to JobStatus enum
 * Provides type-safe conversion with fallback to default value
 */
export function toJobStatus(status: string | undefined | null): JobStatus {
  if (!status) return JobStatus.pending;

  // Handle case-insensitive conversion
  const normalizedStatus = status.toUpperCase();

  // Check if it's a valid JobStatus
  if (Object.values(JobStatus).includes(normalizedStatus as JobStatus)) {
    return normalizedStatus as JobStatus;
  }

  // Log warning and return default
  logger.warn(`Invalid job status: ${status}, defaulting to PENDING`);
  return JobStatus.pending;
}

/**
 * Helper function for converting string values to JobType enum
 * Provides type-safe conversion with fallback to default value
 */
export function toJobType(type: string | undefined | null): JobType {
  if (!type) return JobType.chapter_check;

  // Handle case-insensitive conversion
  const normalizedType = type.toUpperCase();

  // Check if it's a valid JobType
  if (Object.values(JobType).includes(normalizedType as JobType)) {
    return normalizedType as JobType;
  }

  // Log warning and return default
  logger.warn(`Invalid job type: ${type}, defaulting to CHAPTER_CHECK`);
  return JobType.chapter_check;
}

/**
 * Type guard to check if a value is a valid JobStatus
 */
export function isValidJobStatus(value: unknown): value is JobStatus {
  return typeof value === 'string' && Object.values(JobStatus).includes(value as JobStatus);
}

/**
 * Type guard to check if a value is a valid JobType
 */
export function isValidJobType(value: unknown): value is JobType {
  return typeof value === 'string' && Object.values(JobType).includes(value as JobType);
}

/**
 * Validate and sanitize job data before processing
 */
export function validateJobData(job: unknown): boolean {
  if (!job) return false;
  const jobRecord = job as Record<string, unknown>;
  if (!jobRecord["id"]) return false;
  if (!isValidJobStatus(jobRecord["status"])) return false;
  if (!isValidJobType(jobRecord["job_type"])) return false;
  return true;
}

// Keep these aliases temporarily for easier migration
export const toTaskStatus = toJobStatus;
export const toTaskType = toJobType;
export type TaskError = JobError;