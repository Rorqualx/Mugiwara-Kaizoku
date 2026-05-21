/**
 * Stream Registry for Pino Logger
 *
 * Maintains references to log streams for shutdown handling.
 * Provides flush methods for graceful cleanup and periodic flushing.
 *
 * This module solves the issue of Pino async streams (SonicBoom) not
 * flushing to disk because buffers are never being synced.
 */

/**
 * SonicBoom stream interface for log operations
 */
interface SonicBoom {
  flush: (callback?: () => void) => void;
  flushSync: () => void;
}

/**
 * Registry state for tracking log streams
 */
interface StreamRegistry {
  logStream: SonicBoom | null;
  errorStream: SonicBoom | null;
  flushInterval: NodeJS.Timeout | null;
}

const registry: StreamRegistry = {
  logStream: null,
  errorStream: null,
  flushInterval: null,
};

/**
 * Registers log streams for shutdown handling and periodic flushing
 *
 * @param logStream - Main log stream (SonicBoom destination)
 * @param errorStream - Error log stream (SonicBoom destination)
 */
export function registerStreams(logStream: SonicBoom, errorStream: SonicBoom): void {
  registry.logStream = logStream;
  registry.errorStream = errorStream;
}

/**
 * Starts periodic flushing of log streams
 *
 * @param intervalMs - Flush interval in milliseconds (default: 5000)
 */
export function startPeriodicFlush(intervalMs: number = 5000): void {
  // Clear existing interval if any
  if (registry.flushInterval) {
    clearInterval(registry.flushInterval);
  }

  registry.flushInterval = setInterval(() => {
    flushStreamsAsync();
  }, intervalMs);

  // Prevent interval from keeping process alive
  registry.flushInterval.unref();
}

/**
 * Async flush of all streams (non-blocking)
 * Called periodically by the flush interval
 */
export function flushStreamsAsync(): void {
  if (registry.logStream) {
    registry.logStream.flush();
  }
  if (registry.errorStream) {
    registry.errorStream.flush();
  }
}

/**
 * Synchronous flush of all streams (blocking)
 * Use only at shutdown to ensure all logs are written
 */
export function flushStreamsSync(): void {
  if (registry.logStream) {
    registry.logStream.flushSync();
  }
  if (registry.errorStream) {
    registry.errorStream.flushSync();
  }
}

/**
 * Cleanup function for shutdown
 * Stops the periodic flush interval and performs final sync flush
 */
export function cleanup(): void {
  if (registry.flushInterval) {
    clearInterval(registry.flushInterval);
    registry.flushInterval = null;
  }
  flushStreamsSync();
}

/**
 * Get registered streams (for testing/debugging)
 *
 * @returns Object with current log and error streams
 */
export function getStreams(): { logStream: SonicBoom | null; errorStream: SonicBoom | null } {
  return {
    logStream: registry.logStream,
    errorStream: registry.errorStream,
  };
}
