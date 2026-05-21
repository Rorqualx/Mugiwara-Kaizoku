/**
 * Integration Event Logging Functions
 *
 * Logging functions for external integration events like
 * connect, disconnect, and errors with services like Komga, Kavita, etc.
 *
 * Extracted from: systemEvents.ts
 */

import { emitEvent } from '../eventEmitter';

/**
 * Logs an integration connection event
 * Emits a success event when an integration is connected
 *
 * @param {string} name - Name of the integration
 * @param {string} integrationType - Type of integration (e.g., 'Komga', 'Kavita')
 *
 * @example
 * ```ts
 * logIntegrationConnected("Komga Server", "Komga");
 * ```
 */
export function logIntegrationConnected(name: string, integrationType: string): void {
  emitEvent('success', `Connected to ${name}`, 'Integration', {
    details: { message: `Successfully connected to the ${name} integration.` },
    entityType: 'integration',
    entityName: name,
    actions: [
      { label: 'View Integration Settings', action: 'navigate', url: `/settings/${integrationType.toLowerCase()}` }
    ]
  });
}

/**
 * Logs an integration disconnection event
 * Emits an info event when an integration is disconnected
 *
 * @param {string} name - Name of the integration
 * @param {string} integrationType - Type of integration (e.g., 'Komga', 'Kavita')
 *
 * @example
 * ```ts
 * logIntegrationDisconnected("Komga Server", "Komga");
 * ```
 */
export function logIntegrationDisconnected(name: string, integrationType: string): void {
  emitEvent('info', `Disconnected from ${name}`, 'Integration', {
    details: { message: `Disconnected from the ${name} integration.` },
    entityType: 'integration',
    entityName: name,
    actions: [
      { label: 'View Integration Settings', action: 'navigate', url: `/settings/${integrationType.toLowerCase()}` }
    ]
  });
}

/**
 * Logs an integration error event
 * Emits an error event when an integration operation fails
 *
 * @param {string} name - Name of the integration
 * @param {string} integrationType - Type of integration (e.g., 'Komga', 'Kavita')
 * @param {string} error - Brief error message
 * @param {string} [errorDetails] - Detailed error information
 *
 * @example
 * ```ts
 * logIntegrationError("Komga Server", "Komga", "Authentication failed", "Invalid API key");
 * ```
 */
export function logIntegrationError(name: string, integrationType: string, error: string, errorDetails?: string): void {
  emitEvent('error', `${name} integration error: ${error}`, 'Integration', {
    details: { message: `An error occurred with the ${name} integration.` },
    entityType: 'integration',
    entityName: name,
    errorDetails: errorDetails ?? error,
    actions: [
      { label: 'View Integration Settings', action: 'navigate', url: `/settings/${integrationType.toLowerCase()}` }
    ]
  });
}
