/**
 * Removal toast helper.
 *
 * Wraps a destructive "removal" task in a process-then-notify toast: a Mantine
 * loading toast shows immediately and stays up until the task (which should
 * include awaiting any list refetch) resolves, then morphs in place to a success
 * or error toast. A durable bell-dropdown row is written via `notify({ toast:
 * false })` so the event is recorded without a second toast.
 *
 * Shared by the single-card remove (PosterView) and the bulk delete
 * (library/[id]) so both report success only after the UI has actually settled.
 *
 * @module utils/removalToast
 */
import { createElement } from 'react';

import { notifications } from '@mantine/notifications';
import { IconCheck, IconX } from '@tabler/icons-react';

import { notify } from '@/utils/notify';

export interface RemovalToastOptions {
  /** Stable toast id so the loading toast can be morphed in place. */
  id: string;
  /** Title shown while the task runs. */
  processingTitle: string;
  /** Message shown while the task runs. */
  processingMessage: string;
  /** Title shown on success. */
  successTitle: string;
  /** Message shown on success. */
  successMessage: string;
  /** Title shown on failure. */
  errorTitle: string;
  /** Message used when the thrown error has no usable message. */
  fallbackErrorMessage?: string;
}

/**
 * Run `task` with a loading→success/error toast and a durable bell row.
 *
 * @param options - Toast copy + id.
 * @param task - The async removal. Await the list refetch INSIDE it so success
 *   is only reported once the UI reflects the change.
 * @throws Re-throws the task's error after reporting it, so callers can react.
 */
export async function withRemovalToast(
  options: RemovalToastOptions,
  task: () => Promise<void>,
): Promise<void> {
  notifications.show({
    id: options.id,
    loading: true,
    autoClose: false,
    withCloseButton: false,
    title: options.processingTitle,
    message: options.processingMessage,
  });

  try {
    await task();
    notifications.update({
      id: options.id,
      loading: false,
      color: 'green',
      icon: createElement(IconCheck, { size: 18 }),
      autoClose: 3000,
      title: options.successTitle,
      message: options.successMessage,
    });
    notify({ severity: 'SUCCESS', title: options.successTitle, message: options.successMessage, toast: false });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : (options.fallbackErrorMessage ?? 'An error occurred');
    notifications.update({
      id: options.id,
      loading: false,
      color: 'red',
      icon: createElement(IconX, { size: 18 }),
      autoClose: 5000,
      title: options.errorTitle,
      message,
    });
    notify({ severity: 'ERROR', title: options.errorTitle, message, toast: false });
    throw error;
  }
}
