/**
 * Event Status Validator
 *
 * State machine validation for calendar event status transitions.
 * Ensures events follow valid state transitions and prevents invalid updates.
 *
 * @module server/services/calendar/validators/event-status-validator
 */

import { EventStatus } from '@prisma/client';

// ============================================================================
// Error Classes
// ============================================================================

/**
 * Error thrown when an invalid status transition is attempted
 */
export class InvalidStatusTransitionError extends Error {
  constructor(
    public readonly fromStatus: EventStatus,
    public readonly toStatus: EventStatus,
    public readonly eventId?: number
  ) {
    const eventIdStr = eventId !== undefined ? ` (event ${eventId})` : '';
    super(
      `Invalid status transition${eventIdStr}: cannot transition from ${fromStatus} to ${toStatus}`
    );
    this.name = 'InvalidStatusTransitionError';
  }
}

// ============================================================================
// State Machine Configuration
// ============================================================================

/**
 * Valid status transitions map
 *
 * State machine for calendar event status:
 * - SCHEDULED: Initial state, can move to CONFIRMED, DELAYED, CANCELLED, or RELEASED
 * - CONFIRMED: Event is confirmed, can move to RELEASED, DELAYED, or CANCELLED
 * - DELAYED: Event is delayed, can move to RELEASED, CANCELLED, or back to SCHEDULED
 * - RELEASED: Terminal state (event has been released)
 * - CANCELLED: Can be rescheduled back to SCHEDULED
 */
export const VALID_STATUS_TRANSITIONS: ReadonlyMap<EventStatus, ReadonlySet<EventStatus>> = new Map([
  [
    EventStatus.SCHEDULED,
    new Set([
      EventStatus.CONFIRMED,
      EventStatus.DELAYED,
      EventStatus.CANCELLED,
      EventStatus.RELEASED,
    ]),
  ],
  [
    EventStatus.CONFIRMED,
    new Set([
      EventStatus.RELEASED,
      EventStatus.DELAYED,
      EventStatus.CANCELLED,
    ]),
  ],
  [
    EventStatus.DELAYED,
    new Set([
      EventStatus.RELEASED,
      EventStatus.CANCELLED,
      EventStatus.SCHEDULED, // Can be rescheduled
    ]),
  ],
  [
    EventStatus.RELEASED,
    new Set<EventStatus>(), // Terminal state - no transitions allowed
  ],
  [
    EventStatus.CANCELLED,
    new Set([
      EventStatus.SCHEDULED, // Can be rescheduled
    ]),
  ],
]);

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Check if a status transition is valid
 *
 * @param fromStatus - Current event status
 * @param toStatus - Target event status
 * @returns true if transition is valid, false otherwise
 */
export function isValidStatusTransition(
  fromStatus: EventStatus,
  toStatus: EventStatus
): boolean {
  // Same status is always valid (no-op)
  if (fromStatus === toStatus) {
    return true;
  }

  const validTransitions = VALID_STATUS_TRANSITIONS.get(fromStatus);
  if (!validTransitions) {
    return false;
  }

  return validTransitions.has(toStatus);
}

/**
 * Validate a status transition and throw if invalid
 *
 * @param fromStatus - Current event status
 * @param toStatus - Target event status
 * @param eventId - Optional event ID for error context
 * @param force - If true, allows transition even if invalid (admin override)
 * @throws InvalidStatusTransitionError if transition is invalid and force is false
 */
export function validateStatusTransition(
  fromStatus: EventStatus,
  toStatus: EventStatus,
  eventId?: number,
  force = false
): void {
  if (force) {
    return; // Admin override - allow any transition
  }

  if (!isValidStatusTransition(fromStatus, toStatus)) {
    throw new InvalidStatusTransitionError(fromStatus, toStatus, eventId);
  }
}

/**
 * Get all valid target statuses from a given status
 *
 * @param status - Current status
 * @returns Array of valid target statuses
 */
export function getValidTransitions(status: EventStatus): EventStatus[] {
  const validTransitions = VALID_STATUS_TRANSITIONS.get(status);
  if (!validTransitions) {
    return [];
  }
  return Array.from(validTransitions);
}

/**
 * Check if a status is a terminal state
 *
 * @param status - Status to check
 * @returns true if status is terminal (no outgoing transitions)
 */
export function isTerminalStatus(status: EventStatus): boolean {
  const validTransitions = VALID_STATUS_TRANSITIONS.get(status);
  return validTransitions?.size === 0;
}

/**
 * Get human-readable description of valid transitions
 *
 * @param status - Current status
 * @returns Description of valid transitions
 */
export function getTransitionDescription(status: EventStatus): string {
  const validTransitions = getValidTransitions(status);

  if (validTransitions.length === 0) {
    return `${status} is a terminal state - no further transitions allowed`;
  }

  return `${status} can transition to: ${validTransitions.join(', ')}`;
}

// ============================================================================
// Batch Validation
// ============================================================================

/**
 * Result of validating a status transition
 */
export interface StatusTransitionValidationResult {
  isValid: boolean;
  fromStatus: EventStatus;
  toStatus: EventStatus;
  eventId: number;
  error: InvalidStatusTransitionError | undefined;
}

/**
 * Validate multiple status transitions
 *
 * @param transitions - Array of transitions to validate
 * @returns Array of validation results
 */
export function validateStatusTransitions(
  transitions: Array<{
    eventId: number;
    fromStatus: EventStatus;
    toStatus: EventStatus;
  }>
): StatusTransitionValidationResult[] {
  return transitions.map(({ eventId, fromStatus, toStatus }) => {
    const isValid = isValidStatusTransition(fromStatus, toStatus);
    return {
      isValid,
      fromStatus,
      toStatus,
      eventId,
      error: isValid
        ? undefined
        : new InvalidStatusTransitionError(fromStatus, toStatus, eventId),
    };
  });
}

/**
 * Filter transitions to only include valid ones
 *
 * @param transitions - Array of transitions to filter
 * @returns Array of valid transitions
 */
export function filterValidTransitions<T extends { fromStatus: EventStatus; toStatus: EventStatus }>(
  transitions: T[]
): T[] {
  return transitions.filter(({ fromStatus, toStatus }) =>
    isValidStatusTransition(fromStatus, toStatus)
  );
}
