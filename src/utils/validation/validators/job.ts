/**
 * Task Validators
 * 
 * This file contains validation functions for task-related types.
 */

import { JobType, JobStatus } from '@/utils/job-validation';

/**
 * Type guard for task types
 * Checks if a string is a valid JobType
 * 
 * @param type - String to check
 * @returns True if string is a valid JobType
 */
export function isJobType(type: string): type is JobType {
  return Object.values(JobType).includes(type as JobType);
}

/**
 * Type guard for task status
 * Checks if a string is a valid JobStatus
 * 
 * @param status - String to check
 * @returns True if string is a valid JobStatus
 */
export function isJobStatus(status: string): status is JobStatus {
  return Object.values(JobStatus).includes(status as JobStatus);
}

/**
 * Validate task type with error message
 * 
 * @param type - String to validate
 * @returns Validation result with error message if invalid
 */
export function validateJobType(type: string): { valid: boolean; error?: string } {
  if (isJobType(type)) {
    return { valid: true };
  }
  
  return {
    valid: false,
    error: `Invalid task type: ${type}. Valid types are: ${Object.values(JobType).join(', ')}`
  };
}

/**
 * Validate task status with error message
 * 
 * @param status - String to validate
 * @returns Validation result with error message if invalid
 */
export function validateJobStatus(status: string): { valid: boolean; error?: string } {
  if (isJobStatus(status)) {
    return { valid: true };
  }
  
  return {
    valid: false,
    error: `Invalid task status: ${status}. Valid statuses are: ${Object.values(JobStatus).join(', ')}`
  };
}

/**
 * Get all valid task types
 * 
 * @returns Array of all valid task types
 */
export function getAllJobTypes(): JobType[] {
  return Object.values(JobType);
}

/**
 * Get all valid task statuses
 * 
 * @returns Array of all valid task statuses
 */
export function getAllJobStatuses(): JobStatus[] {
  return Object.values(JobStatus);
}

/**
 * Check if a task status represents a completed state
 * 
 * @param status - Task status to check
 * @returns True if status represents a completed state
 */
export function isCompletedStatus(status: JobStatus): boolean {
  return status === JobStatus.completed || status === JobStatus.failed || status === JobStatus.cancelled;
}

/**
 * Check if a task status represents an active state
 * 
 * @param status - Task status to check
 * @returns True if status represents an active state
 */
export function isActiveStatus(status: JobStatus): boolean {
  return status === JobStatus.active || status === JobStatus.pending;
}

/**
 * Check if a task status allows retry
 * 
 * @param status - Task status to check
 * @returns True if status allows retry
 */
export function canRetryStatus(status: JobStatus): boolean {
  return status === JobStatus.failed || status === JobStatus.cancelled;
}
