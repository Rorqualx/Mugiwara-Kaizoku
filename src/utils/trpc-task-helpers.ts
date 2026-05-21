/**
 * TRPC Task Helper Functions
 * 
 * This module provides helper functions for working with TRPC task queries
 * and mutations, with proper conversion between domain and Prisma enum types.
 */

import { JobStatus, JobType } from '@/utils/job-validation';

// Type aliases for clarity
type DomainJobStatus = JobStatus;
type DomainJobType = JobType;

/**
 * Creates a properly formatted task status query parameter for TRPC
 * @param status Domain JobStatus value
 * @returns Properly formatted query parameter object
 */
export function createJobStatusQuery(status?: DomainJobStatus): Record<string, string> | Record<string, never> {
  // Return an empty object if no status is provided
  if (status === undefined) {
    return {};
  }

  // Instead of using the filter object, use the string directly
  return {
    status: status.toString().toUpperCase()
  };
}

/**
 * Creates a properly formatted task type query parameter for TRPC
 * @param type Domain JobType value
 * @returns Properly formatted query parameter object
 */
export function createJobTypeQuery(type?: DomainJobType): Record<string, DomainJobType> | Record<string, never> {
  // Return an empty object if no type is provided
  if (type === undefined) {
    return {};
  }

  return {
    type: type
  };
}

/**
 * Creates a properly formatted task query parameter for TRPC
 * with both status and type
 * @param status Domain JobStatus value
 * @param type Domain JobType value
 * @returns Properly formatted query parameter object
 */
export function createTaskQuery(status?: JobStatus, type?: DomainJobType): Record<string, unknown> {
  const query: Record<string, unknown> = {};

  if (status) {
    query["status"] = status;
  }

  if (type) {
    query["type"] = type;
  }

  return query;
}

/**
 * Creates a properly formatted task status update parameter for TRPC
 * @param status Domain JobStatus value
 * @returns Properly formatted update parameter object
 */
export function createJobStatusUpdate(status: DomainJobStatus): { status: DomainJobStatus } {
  return {
    status: status
  };
}

/**
 * Creates a properly formatted task type update parameter for TRPC
 * @param type Domain JobType value
 * @returns Properly formatted update parameter object
 */
export function createJobTypeUpdate(type: DomainJobType): { type: DomainJobType } {
  return {
    type: type
  };
}