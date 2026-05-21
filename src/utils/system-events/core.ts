/**
 * Core System Event Logging Functions
 *
 * Logging functions for system-level events like startup, shutdown,
 * errors, warnings, health status, and configuration changes.
 *
 * Extracted from: systemEvents.ts
 */

import { emitEvent } from '../eventEmitter';

/**
 * Logs a system startup event
 * Emits an info event when the application starts successfully
 *
 * @example
 * ```ts
 * logSystemStartup();
 * // Emits: "System started successfully" with link to system status
 * ```
 */
export function logSystemStartup(): void {
  emitEvent('info', 'System started successfully', 'System', {
    details: { message: 'The application has started and is ready to use.' },
    actions: [{ label: 'View System Status', action: 'navigate', url: '/system/status' }],
  });
}

/**
 * Logs a system shutdown event
 * Emits an info event when the application begins shutting down
 *
 * @example
 * ```ts
 * logSystemShutdown();
 * // Emits: "System shutting down"
 * ```
 */
export function logSystemShutdown(): void {
  emitEvent('info', 'System shutting down', 'System', {
    details: { message: 'The application is shutting down gracefully.' },
  });
}

/**
 * Logs a system error event
 * Emits an error event when a critical system error occurs
 *
 * @param {string} error - Brief error message
 * @param {string} [errorDetails] - Detailed error information
 *
 * @example
 * ```ts
 * logSystemError("Database connection failed", "Connection timeout after 30s");
 * ```
 */
export function logSystemError(error: string, errorDetails?: string): void {
  emitEvent('error', `System error: ${error}`, 'System', {
    details: { message: 'A system error has occurred that may affect application functionality.' },
    errorDetails: errorDetails ?? error,
  });
}

/**
 * Logs a system warning event
 * Emits a warning event for non-critical system issues
 *
 * @param {string} warning - Warning message
 * @param {string} [details] - Additional warning details
 *
 * @example
 * ```ts
 * logSystemWarning("High memory usage", "Memory usage above 80%");
 * ```
 */
export function logSystemWarning(warning: string, details?: string): void {
  emitEvent('warning', warning, 'System', {
    details: { message: details ?? 'A system warning has been detected.' },
  });
}

/**
 * Logs a system update event
 * Emits an info event when the system is updated to a new version
 *
 * @param {string} version - New version number
 * @param {string} [details] - Update details or changelog
 *
 * @example
 * ```ts
 * logSystemUpdate("1.2.0", "Added new manga source providers");
 * ```
 */
export function logSystemUpdate(version: string, details?: string): void {
  emitEvent('info', `System updated to version ${version}`, 'System', {
    details: { message: details ?? `The system has been updated to version ${version}.` },
    actions: [{ label: 'View Release Notes', action: 'navigate', url: '/system/updates' }],
  });
}

/**
 * Logs system health status change
 *
 * @param {string} oldStatus - Previous health status
 * @param {string} newStatus - New health status
 * @param {string} [details] - Additional details
 */
export function logHealthChanged(oldStatus: string, newStatus: string, details?: string): void {
  const level = newStatus === 'healthy' ? 'success' : newStatus === 'degraded' ? 'warning' : 'error';
  emitEvent(level, `System health changed: ${oldStatus} → ${newStatus}`, 'System', {
    details: {
      type: 'health_changed',
      oldStatus,
      newStatus,
      details,
    },
  });
}

/**
 * Logs system update availability
 *
 * @param {string} currentVersion - Current version
 * @param {string} newVersion - Available version
 * @param {string} [releaseNotes] - Release notes URL
 */
export function logUpdateAvailable(
  currentVersion: string,
  newVersion: string,
  releaseNotes?: string
): void {
  emitEvent('info', `Update available: v${currentVersion} → v${newVersion}`, 'System', {
    details: {
      type: 'update_available',
      currentVersion,
      newVersion,
      releaseNotes,
    },
  });
}

/**
 * Logs configuration change
 *
 * @param {string} section - Configuration section
 * @param {string} setting - Setting that changed
 * @param {string} [details] - Change details
 */
export function logConfigurationChanged(section: string, setting: string, details?: string): void {
  emitEvent('info', `Configuration changed: ${section}.${setting}`, 'System', {
    details: {
      type: 'configuration_changed',
      section,
      setting,
      details,
    },
  });
}

/**
 * Logs resource warning
 *
 * @param {string} resource - Resource type (disk, memory, cpu)
 * @param {number} usage - Usage percentage
 * @param {string} threshold - Warning threshold
 */
export function logResourceWarning(resource: string, usage: number, threshold: string): void {
  emitEvent(
    'warning',
    `Resource warning: ${resource} usage at ${usage}% (threshold: ${threshold})`,
    'System',
    {
      details: {
        type: 'resource_warning',
        resource,
        usage,
        threshold,
      },
    }
  );
}
