/**
 * Notification Helper Functions
 *
 * Utility functions for showing notifications
 */

import React from 'react';

import { notifications } from '@mantine/notifications';
import { IconCheck, } from '@tabler/icons-react';

import { notify } from '@/utils/notify';
/**
 * Show success notification
 */
export function showSuccessNotification(message: string): void {
  notifications.show({
    title: 'Success',
    message,
    color: 'green',
    icon: React.createElement(IconCheck, { size: 16 })
  });
}

/**
 * Show error notification
 */
export function showErrorNotification(message: string, error?: unknown): void {
  const errorMessage = error instanceof Error ? error.message : String(error);

  notify({ severity: 'ERROR', title: 'Error', message: `${message}: ${errorMessage}` });
}
