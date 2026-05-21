/**
 * Simple Notification Functions (legacy wrapper).
 *
 * Both functions now delegate to the unified `notify` primitive in
 * `src/utils/notify.ts`, so each call shows a Mantine toast AND persists a
 * bell-dropdown row. Kept as a stable import surface for ~existing call
 * sites; new code should call `notify` directly.
 *
 * @module notifications
 */

import { type ReactNode } from 'react';

import { notify } from './notify';

function stringifyMessage(message: ReactNode): string {
  if (typeof message === 'string') return message;
  if (typeof message === 'number' || typeof message === 'bigint') return String(message);
  if (message === null || message === undefined || typeof message === 'boolean') return '';
  return String(message);
}

/**
 * Displays a success notification (toast + bell).
 *
 * @param title - Notification title text
 * @param message - Notification content (text or React node — non-text is stringified for the bell row)
 */
export function showSuccessNotification(title: string, message: ReactNode): void {
  notify({ severity: 'SUCCESS', title, message: stringifyMessage(message) });
}

/**
 * Displays an error notification (toast + bell).
 *
 * @param title - Notification title text
 * @param message - Notification content (text or React node — non-text is stringified for the bell row)
 */
export function showErrorNotification(title: string, message: ReactNode): void {
  notify({ severity: 'ERROR', title, message: stringifyMessage(message) });
}
