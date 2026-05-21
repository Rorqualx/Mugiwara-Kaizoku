/**
 * Notification Helper Functions (legacy wrapper).
 *
 * Both functions now delegate to the unified `notify` primitive in
 * `src/utils/notify.ts`, so each call shows a Mantine toast AND persists a
 * bell-dropdown row. The `autoClose` field is forwarded to the toast.
 *
 * @module notificationHelpers
 */
import React from 'react';

import { notify } from './notify';

interface NotificationOptions {
  title: string;
  message: React.ReactNode;
  autoClose?: number;
}

function stringifyMessage(message: React.ReactNode): string {
  if (typeof message === 'string') return message;
  if (typeof message === 'number' || typeof message === 'bigint') return String(message);
  if (message === null || message === undefined || typeof message === 'boolean') return '';
  return String(message);
}

/**
 * Displays a success notification (toast + bell).
 */
export const showSuccessNotification = ({
  title,
  message,
  autoClose,
}: NotificationOptions): void => {
  notify({
    severity: 'SUCCESS',
    title,
    message: stringifyMessage(message),
    ...(autoClose !== undefined ? { toast: { autoClose } } : {}),
  });
};

/**
 * Displays an error notification (toast + bell).
 */
export const showErrorNotification = ({
  title,
  message,
  autoClose,
}: NotificationOptions): void => {
  notify({
    severity: 'ERROR',
    title,
    message: stringifyMessage(message),
    ...(autoClose !== undefined ? { toast: { autoClose } } : {}),
  });
};
