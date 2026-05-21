/**
 * Download Client Configuration Utilities
 *
 * Shared helper functions for download client configuration.
 * Provides reusable notification helpers and validation utilities
 * to eliminate code duplication across the download client configuration hook.
 *
 * Extracted and enhanced from: useDownloadClientConfig.ts
 */

import React from 'react';

import { notifications } from '@mantine/notifications';
import { IconCheck, IconAlertCircle } from '@tabler/icons-react';

/**
 * Parse client preference string to typed value
 *
 * @param value - The preference string value
 * @param validValues - Array of valid client types
 * @returns Typed client preference or null
 */
export function parseClientPreference<T extends string>(
  value: string | null | undefined,
  validValues: T[]
): T | null {
  if (!value) return null;
  return validValues.includes(value as T) ? (value as T) : null;
}

/**
 * Validate URL format
 *
 * @param url - The URL to validate
 * @returns Whether the URL is valid
 */
export function validateUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    return !!urlObj;
  } catch {
    return false;
  }
}

/**
 * Show success notification
 *
 * @param title - Notification title
 * @param message - Notification message
 */
export function showSuccessNotification(title: string, message: string): void {
  notifications.show({
    title,
    message,
    color: 'green',
    icon: React.createElement(IconCheck, { size: 16 })
  });
}

/**
 * Show error notification
 *
 * @param title - Notification title
 * @param message - Notification message
 */
export function showErrorNotification(title: string, message: string): void {
  notifications.show({
    title,
    message,
    color: 'red',
    icon: React.createElement(IconAlertCircle, { size: 16 })
  });
}

/**
 * Format error message from unknown error
 *
 * @param error - The error to format
 * @returns Formatted error message
 */
export function formatErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
