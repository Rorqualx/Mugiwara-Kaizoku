/**
 * System Constants Module
 *
 * Centralizes all magic numbers and configuration values used in system operations.
 * This improves maintainability and makes it easier to tune system behavior.
 *
 * @module server/constants/system
 */

/**
 * Delay constants for restart and shutdown operations
 * All values are in milliseconds
 */
export const RESTART_DELAYS = {
  /** Buffer time to ensure HTTP response is sent before process exit */
  RESPONSE_BUFFER_MS: 500,

  /** Delay before Docker container restart */
  DOCKER_RESTART_MS: 2000,

  /** Delay before production restart */
  PRODUCTION_RESTART_MS: 2000,

  /** Maximum time to wait for graceful cleanup */
  CLEANUP_TIMEOUT_MS: 5000,

  /** Delay for shutdown operations */
  SHUTDOWN_DELAY_MS: 2000,
} as const;

/**
 * Notification constants for restart/shutdown UI
 */
export const NOTIFICATION_DURATIONS = {
  /** Auto-close duration for success messages */
  SUCCESS_MS: 3000,

  /** Auto-close duration for warning messages */
  WARNING_MS: 5000,

  /** Auto-close duration for error messages */
  ERROR_MS: 7000,

  /** Countdown interval for restart notifications */
  COUNTDOWN_INTERVAL_MS: 1000,
} as const;

/**
 * Job status polling constants
 */
export const JOB_POLLING = {
  /** Interval for polling when jobs are active */
  ACTIVE_INTERVAL_MS: 5000,

  /** Interval for polling when jobs are inactive */
  IDLE_INTERVAL_MS: 30000,
} as const;

/**
 * System operation timeouts
 */
export const TIMEOUTS = {
  /** Timeout for database operations during shutdown */
  DB_DISCONNECT_MS: 3000,

  /** Timeout for HTTP server shutdown */
  SERVER_CLOSE_MS: 5000,

  /** Timeout for WebSocket connections closure */
  WEBSOCKET_CLOSE_MS: 2000,
} as const;
