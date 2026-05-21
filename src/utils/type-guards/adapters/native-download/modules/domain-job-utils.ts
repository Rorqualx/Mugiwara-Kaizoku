/**
 * Domain Job Validation Utilities
 *
 * Shared helper functions and type definitions for domain job validation.
 * These utilities are used across all domain job validation modules.
 */

// DomainJob type is imported in client-types.ts where it's actually used

/**
 * Common validation patterns for domain job properties
 */
export const DOMAIN_JOB_PROPERTIES = {
  // Required properties for all domain jobs
  REQUIRED: ['id', 'jobType', 'status', 'priority', 'payload', 'metadata', 'createdAt', 'updatedAt'] as const,
  
  // Optional properties that may be present
  OPTIONAL: ['result', 'completedAt', 'failedAt', 'error', 'progress', 'retryCount', 'maxRetries', 'timeout', 'workerId', 'queue'] as const,
  
  // Job statuses that are valid for domain jobs
  VALID_STATUSES: [
    'pending',
    'running',
    'completed',
    'failed',
    'cancelled'
  ] as const
} as const;

/**
 * Validates that an object has the basic structure of a domain job
 */
export function hasDomainJobStructure(obj: unknown): obj is Record<string, unknown> {
  return typeof obj === 'object' && obj !== null && !Array.isArray(obj);
}

/**
 * Validates that an object has all required domain job properties
 */
export function hasRequiredDomainJobProperties(obj: Record<string, unknown>): boolean {
  return DOMAIN_JOB_PROPERTIES.REQUIRED.every(prop => prop in obj);
}

/**
 * Validates that a job status is a recognized domain job status
 */
export function isValidDomainJobStatus(status: unknown): status is string {
  return typeof status === 'string' && 
    DOMAIN_JOB_PROPERTIES.VALID_STATUSES.includes(status as typeof DOMAIN_JOB_PROPERTIES.VALID_STATUSES[number]);
}

/**
 * Validates that progress is a valid number between 0 and 100
 */
export function isValidProgress(progress: unknown): progress is number {
  return typeof progress === 'number' && progress >= 0 && progress <= 100;
}

/**
 * Validates that timestamps are valid Date objects
 */
export function isValidTimestamp(timestamp: unknown): timestamp is Date {
  return timestamp instanceof Date && !isNaN(timestamp.getTime());
}

/**
 * Validates that priority is a valid number
 */
export function isValidPriority(priority: unknown): priority is number {
  return typeof priority === 'number' && priority >= 0;
}

/**
 * Validates that retry count is a valid number
 */
export function isValidRetryCount(retryCount: unknown): retryCount is number {
  return typeof retryCount === 'number' && retryCount >= 0;
}

/**
 * Validates that timeout is a valid number
 */
export function isValidTimeout(timeout: unknown): timeout is number {
  return typeof timeout === 'number' && timeout >= 0;
}

/**
 * Validates that worker ID is a valid string
 */
export function isValidWorkerId(workerId: unknown): workerId is string {
  return typeof workerId === 'string' && workerId.length > 0;
}

/**
 * Validates that queue is a valid string
 */
export function isValidQueue(queue: unknown): queue is string {
  return typeof queue === 'string' && queue.length > 0;
}
