/**
 * Utility functions for IntegrationsStatus components
 */
import type { ConnectionStatus } from './types';

/**
 * Get the badge color for enabled/disabled state
 */
export function getEnabledColor(enabled: boolean): string {
  return enabled ? 'green' : 'gray';
}

/**
 * Get the badge color for connection status
 */
export function getStatusColor(status: ConnectionStatus): string {
  switch (status) {
    case 'active':
      return 'green';
    case 'error':
      return 'red';
    case 'inactive':
    default:
      return 'yellow';
  }
}

/**
 * Get the display text for connection status
 */
export function getStatusText(status: ConnectionStatus): string {
  switch (status) {
    case 'active':
      return 'Connected';
    case 'error':
      return 'Error';
    case 'inactive':
    default:
      return 'Inactive';
  }
}
