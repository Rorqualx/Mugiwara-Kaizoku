/**
 * Shared helpers for FlareSolverr settings cards.
 *
 * Status formatters, validators, and notification helpers used by the
 * settings page and its Card subcomponents.
 *
 * @module components/flaresolverr/settings/helpers
 */

import React from 'react';

import { showNotification } from '@mantine/notifications';
import { IconCheck, IconAlertCircle, IconPlugConnected, IconPlugConnectedX } from '@tabler/icons-react';

export interface FlareSolverrSettingsValues {
  enabled: boolean;
  autoStart: boolean;
  url: string;
  timeout: number;
  sessionTTL: number;
  disableMedia: boolean;
  defaultWaitSecs: number;
}

export interface HealthStatusLike {
  enabled: boolean;
  healthy: boolean;
}

/** Status badge color from health status */
export function getStatusColor(healthStatus: HealthStatusLike | undefined): string {
  if (!healthStatus) return 'gray';
  if (!healthStatus.enabled) return 'gray';
  if (healthStatus.healthy) return 'green';
  return 'red';
}

/** Status badge label from health status */
export function getStatusText(healthStatus: HealthStatusLike | undefined): string {
  if (!healthStatus) return 'Unknown';
  if (!healthStatus.enabled) return 'Disabled';
  if (healthStatus.healthy) return 'Connected';
  return 'Disconnected';
}

/** Connection status icon based on health */
export function getStatusIcon(healthy: boolean | undefined): React.ReactElement {
  return healthy ? <IconPlugConnected size={14} /> : <IconPlugConnectedX size={14} />;
}

export function showSuccessNotification(title: string, message: string): void {
  showNotification({
    title,
    message,
    color: 'green',
    icon: <IconCheck />,
  });
}

export function showErrorNotification(title: string, message: string): void {
  showNotification({
    title,
    message,
    color: 'red',
    icon: <IconAlertCircle />,
  });
}

export function validateUrl(value: string): string | null {
  try {
    new URL(value);
    return null;
  } catch {
    return 'Please enter a valid URL';
  }
}

export function validateTimeout(value: number): string | null {
  if (value < 1000) return 'Minimum timeout is 1000ms';
  if (value > 300000) return 'Maximum timeout is 300000ms (5 minutes)';
  return null;
}

export function validateSessionTTL(value: number): string | null {
  if (value < 60000) return 'Minimum session TTL is 60000ms (1 minute)';
  if (value > 86400000) return 'Maximum session TTL is 86400000ms (24 hours)';
  return null;
}

export function validateWaitSecs(value: number): string | null {
  if (value < 0) return 'Wait time cannot be negative';
  if (value > 60) return 'Maximum wait time is 60 seconds';
  return null;
}

export function handleTestConnectionResult(result: {
  success: boolean;
  version?: string;
  responseTime?: number;
  message: string;
}): void {
  if (result.success) {
    showSuccessNotification(
      'Connection Successful',
      `Connected to FlareSolverr v${result.version ?? 'unknown'} (${result.responseTime}ms)`
    );
  } else {
    showErrorNotification('Connection Failed', result.message);
  }
}

export function handleRestartResult(result: { success: boolean; message: string }): void {
  if (result.success) {
    showSuccessNotification('Restart Successful', result.message);
  } else {
    showErrorNotification('Restart Failed', result.message);
  }
}

/**
 * URL points at the same host as the app (loopback / docker internal /
 * IPv6 loopback). Used to label Remote Instances.
 */
export function isLocalUrl(rawUrl: string): boolean {
  let host: string;
  try {
    host = new URL(rawUrl).hostname.toLowerCase();
  } catch {
    return false;
  }
  return (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '0.0.0.0' ||
    host === '[::1]' ||
    host === '::1' ||
    host === 'host.docker.internal'
  );
}
