/**
 * Event Validation Hook
 *
 * Validation utilities for event configuration values
 */

/**
 * Validation errors
 */
export class EventValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EventValidationError';
  }
}

/**
 * Validate retention days
 */
export function validateRetentionDays(days: number): void {
  if (days < 1 || days > 365) {
    throw new EventValidationError('Retention period must be between 1 and 365 days');
  }
}

/**
 * Validate max events
 */
export function validateMaxEvents(maxEvents: number): void {
  if (maxEvents < 10 || maxEvents > 1000) {
    throw new EventValidationError('Maximum events must be between 10 and 1000');
  }
}

/**
 * Hook for event configuration validation
 */
export function useEventValidation(): {
  validateRetentionDays: (days: number) => void;
  validateMaxEvents: (maxEvents: number) => void;
} {
  return {
    validateRetentionDays,
    validateMaxEvents
  };
}
