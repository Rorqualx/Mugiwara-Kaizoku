/**
 * Tracked Download State Machine
 *
 * Pure function state machine for download lifecycle transitions.
 * No side effects — only determines valid state transitions.
 *
 * @module server/services/download/tracked-download/state-machine
 */

import { TrackedDownloadEvent, TrackedDownloadState } from './types';

import type { TransitionResult } from './types';

// ============================================================================
// Transition Table
// ============================================================================

/**
 * Defines all valid state transitions.
 * Map<CurrentState, Map<Event, NextState>>
 */
const TRANSITION_TABLE = new Map<
  TrackedDownloadState,
  Map<TrackedDownloadEvent, TrackedDownloadState>
>([
  [
    TrackedDownloadState.QUEUED,
    new Map([
      [TrackedDownloadEvent.DOWNLOAD_STARTED, TrackedDownloadState.DOWNLOADING],
      [TrackedDownloadEvent.DOWNLOAD_FAILED, TrackedDownloadState.DOWNLOAD_FAILED],
      [TrackedDownloadEvent.CANCELLED, TrackedDownloadState.FAILED],
    ]),
  ],
  [
    TrackedDownloadState.DOWNLOADING,
    new Map([
      [TrackedDownloadEvent.DOWNLOAD_COMPLETED, TrackedDownloadState.IMPORT_PENDING],
      [TrackedDownloadEvent.DOWNLOAD_FAILED, TrackedDownloadState.DOWNLOAD_FAILED],
      [TrackedDownloadEvent.DOWNLOAD_PAUSED, TrackedDownloadState.DOWNLOAD_PAUSED],
      [TrackedDownloadEvent.CANCELLED, TrackedDownloadState.FAILED],
    ]),
  ],
  [
    TrackedDownloadState.DOWNLOAD_FAILED,
    new Map([
      [TrackedDownloadEvent.RETRY_STARTED, TrackedDownloadState.QUEUED],
      [TrackedDownloadEvent.RETRIES_EXHAUSTED, TrackedDownloadState.FAILED],
      [TrackedDownloadEvent.CANCELLED, TrackedDownloadState.FAILED],
    ]),
  ],
  [
    TrackedDownloadState.DOWNLOAD_PAUSED,
    new Map([
      [TrackedDownloadEvent.DOWNLOAD_RESUMED, TrackedDownloadState.DOWNLOADING],
      [TrackedDownloadEvent.CANCELLED, TrackedDownloadState.FAILED],
    ]),
  ],
  [
    TrackedDownloadState.IMPORT_PENDING,
    new Map([
      [TrackedDownloadEvent.IMPORT_STARTED, TrackedDownloadState.IMPORTING],
      [TrackedDownloadEvent.CANCELLED, TrackedDownloadState.FAILED],
    ]),
  ],
  [
    TrackedDownloadState.IMPORTING,
    new Map([
      [TrackedDownloadEvent.IMPORT_COMPLETED, TrackedDownloadState.IMPORTED],
      [TrackedDownloadEvent.IMPORT_FAILED, TrackedDownloadState.IMPORT_BLOCKED],
      [TrackedDownloadEvent.CANCELLED, TrackedDownloadState.FAILED],
    ]),
  ],
  [
    TrackedDownloadState.IMPORT_BLOCKED,
    new Map([
      [TrackedDownloadEvent.RETRY_IMPORT, TrackedDownloadState.IMPORTING],
      [TrackedDownloadEvent.MANUAL_IMPORT_COMPLETED, TrackedDownloadState.IMPORTED],
      [TrackedDownloadEvent.IGNORED_BY_USER, TrackedDownloadState.IGNORED],
      [TrackedDownloadEvent.CANCELLED, TrackedDownloadState.FAILED],
    ]),
  ],
  [
    TrackedDownloadState.FAILED,
    new Map([
      [TrackedDownloadEvent.RETRY_STARTED, TrackedDownloadState.QUEUED],
      [TrackedDownloadEvent.IGNORED_BY_USER, TrackedDownloadState.IGNORED],
    ]),
  ],
]);

// ============================================================================
// Terminal States
// ============================================================================

const TERMINAL_STATES: ReadonlySet<TrackedDownloadState> = new Set([
  TrackedDownloadState.IMPORTED,
  TrackedDownloadState.FAILED,
  TrackedDownloadState.IGNORED,
]);

// ============================================================================
// Public Functions
// ============================================================================

/**
 * Attempt a state transition.
 *
 * @param currentState - The current state of the download
 * @param event - The event triggering the transition
 * @returns TransitionResult indicating success or failure with details
 */
export function transition(
  currentState: TrackedDownloadState,
  event: TrackedDownloadEvent,
): TransitionResult {
  const stateTransitions = TRANSITION_TABLE.get(currentState);

  if (!stateTransitions) {
    return {
      success: false,
      previousState: currentState,
      newState: currentState,
      error: `No transitions defined for state: ${currentState}`,
    };
  }

  const nextState = stateTransitions.get(event);

  if (nextState === undefined) {
    return {
      success: false,
      previousState: currentState,
      newState: currentState,
      error: `Invalid transition: ${currentState} + ${event}`,
    };
  }

  return {
    success: true,
    previousState: currentState,
    newState: nextState,
  };
}

/**
 * Check whether a transition is valid without performing it.
 *
 * @param currentState - The current state
 * @param event - The event to check
 * @returns True if the transition is valid
 */
export function canTransition(
  currentState: TrackedDownloadState,
  event: TrackedDownloadEvent,
): boolean {
  const stateTransitions = TRANSITION_TABLE.get(currentState);
  if (!stateTransitions) {
    return false;
  }
  return stateTransitions.has(event);
}

/**
 * Get all valid events for a given state.
 *
 * @param currentState - The state to query
 * @returns Array of valid events for that state
 */
export function getValidEvents(
  currentState: TrackedDownloadState,
): TrackedDownloadEvent[] {
  const stateTransitions = TRANSITION_TABLE.get(currentState);
  if (!stateTransitions) {
    return [];
  }
  return [...stateTransitions.keys()];
}

/**
 * Check whether a state is terminal (no further transitions possible
 * except explicit recovery via RetryStarted or IgnoredByUser).
 *
 * @param state - The state to check
 * @returns True if the state is terminal
 */
export function isTerminalState(state: TrackedDownloadState): boolean {
  return TERMINAL_STATES.has(state);
}
