/**
 * Notification Helper Utilities
 *
 * Delegates to the unified `notify` primitive in `src/utils/notify.ts`. Every
 * call now both shows a Mantine toast AND persists a bell-dropdown row.
 *
 * @module notifications/helpers
 */

import { getErrorMessage } from '../errors/helpers';
import { notify, type NotifyType } from '../notify';

type NotificationSeverity = 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';
type NotificationType = NotifyType;

/**
 * Notification configuration options
 */
export interface NotificationOptions {
  title?: string;
  message: string;
  /** Notification type for categorization */
  type?: NotificationType;
  /** Related manga ID for linking */
  relatedMangaId?: number;
  /** Related chapter ID for linking */
  relatedChapterId?: number;
  /** Action URL for navigation */
  actionUrl?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
  /** Toast auto-close duration (forwarded to Mantine notifications). */
  autoClose?: number | false;
  /** Persist control. Defaults to `true` (durable bell row). */
  persist?: boolean;
  // Legacy options (ignored — Mantine toast handles these defaults)
  withIcon?: boolean;
  withCloseButton?: boolean;
  loading?: boolean;
}

function buildNotifyArgs(
  severity: NotificationSeverity,
  title: string,
  message: string,
  options?: Partial<NotificationOptions>
): Parameters<typeof notify>[0] {
  const args: Parameters<typeof notify>[0] = {
    severity,
    title,
    message,
  };
  if (options?.type !== undefined) args.type = options.type;
  if (options?.metadata !== undefined) args.metadata = options.metadata;
  if (options?.relatedMangaId !== undefined) args.relatedMangaId = options.relatedMangaId;
  if (options?.relatedChapterId !== undefined) args.relatedChapterId = options.relatedChapterId;
  if (options?.actionUrl !== undefined) args.actionUrl = options.actionUrl;
  if (options?.autoClose !== undefined) args.toast = { autoClose: options.autoClose };
  if (options?.persist !== undefined) args.persist = options.persist;
  return args;
}

/**
 * Show success notification (toast + bell).
 */
export function showSuccess(options: NotificationOptions | string): string {
  const config = typeof options === 'string' ? { message: options } : options;
  const title = config.title ?? 'Success';
  notify(buildNotifyArgs('SUCCESS', title, config.message, config));
  return `success-${Date.now()}`;
}

/**
 * Show error notification (toast + bell).
 */
export function showError(error: unknown, title = 'Error'): string {
  const message = getErrorMessage(error);
  notify(buildNotifyArgs('ERROR', title, message, { type: 'SYSTEM_ERROR' }));
  return `error-${Date.now()}`;
}

/**
 * Show warning notification (toast + bell).
 */
export function showWarning(options: NotificationOptions | string): string {
  const config = typeof options === 'string' ? { message: options } : options;
  const title = config.title ?? 'Warning';
  notify(buildNotifyArgs('WARNING', title, config.message, config));
  return `warning-${Date.now()}`;
}

/**
 * Show info notification (toast + bell).
 */
export function showInfo(options: NotificationOptions | string): string {
  const config = typeof options === 'string' ? { message: options } : options;
  const title = config.title ?? 'Information';
  notify(buildNotifyArgs('INFO', title, config.message, config));
  return `info-${Date.now()}`;
}

/**
 * Show loading notification that resolves to success or error.
 *
 * The initial loading state is ephemeral (toast-only); the resolve callbacks
 * persist a real bell row.
 */
export function showLoading(message: string, title = 'Loading'): {
  id: string;
  update: (options: Partial<NotificationOptions>) => void;
  success: (message: string, autoClose?: number | false) => void;
  error: (error: unknown) => void;
  hide: () => void;
} {
  const id = `loading-${Date.now()}`;
  // Ephemeral preview toast — does not persist.
  notify({
    severity: 'INFO',
    title,
    message,
    persist: false,
    toast: { autoClose: 30000 },
  });

  return {
    id,
    update: (_options: Partial<NotificationOptions>): void => {
      // No-op: Mantine's id-based update is intentionally not threaded through.
    },
    success: (successMessage: string, autoClose?: number | false): void => {
      notify({
        severity: 'SUCCESS',
        title: 'Success',
        message: successMessage,
        ...(autoClose !== undefined ? { toast: { autoClose } } : {}),
      });
    },
    error: (error: unknown): void => {
      notify({
        severity: 'ERROR',
        title: 'Error',
        message: getErrorMessage(error),
        type: 'SYSTEM_ERROR',
      });
    },
    hide: (): void => {
      // No-op: bell rows are durable; toast auto-closes on its own.
    },
  };
}

/**
 * Show custom notification (toast + bell, INFO severity).
 */
export function showNotification(props: { title?: string; message: string }): string {
  const title = props.title ?? 'Notification';
  notify({ severity: 'INFO', title, message: props.message });
  return `notification-${Date.now()}`;
}

/**
 * Hide a specific notification (no-op for bell notifications)
 *
 * @deprecated Bell notifications cannot be hidden from client
 */
export function hideNotification(_id: string): void {
  // No-op
}

/**
 * Hide all notifications (no-op for bell notifications)
 *
 * @deprecated Bell notifications cannot be hidden from client
 */
export function hideAllNotifications(): void {
  // No-op
}

/**
 * Update an existing notification (no-op for bell notifications)
 *
 * @deprecated Bell notifications cannot be updated from client
 */
export function updateNotification(_props: { id: string; message?: string }): void {
  // No-op
}

/**
 * Helper to create notification handlers for async operations.
 */
export function createNotificationHandlers(options: {
  successMessage?: string;
  successTitle?: string;
  errorTitle?: string;
  warningMessage?: string;
  infoMessage?: string;
} = {}): {
  success: (message?: string) => void;
  error: (error: unknown) => void;
  warning: (message?: string) => void;
  info: (message?: string) => void;
} {
  return {
    success: (message?: string): void => {
      const notifOptions: NotificationOptions = {
        message: message ?? options.successMessage ?? 'Operation completed successfully',
      };
      if (options.successTitle !== undefined) {
        notifOptions.title = options.successTitle;
      }
      showSuccess(notifOptions);
    },
    error: (error: unknown): void => {
      showError(error, options.errorTitle);
    },
    warning: (message?: string): void => {
      showWarning(message ?? options.warningMessage ?? 'Warning');
    },
    info: (message?: string): void => {
      showInfo(message ?? options.infoMessage ?? 'Information');
    },
  };
}

/**
 * Batch notification helper for multiple operations.
 */
export async function withBatchNotifications<T = unknown>(
  operations: Array<{
    fn: () => Promise<T>;
    success?: string;
    error?: string;
  }>
): Promise<Array<{ success: boolean; result?: T; error?: unknown }>> {
  const operationResults = await Promise.allSettled(
    operations.map(async (operation) => {
      const result = await operation.fn();
      return { result, operation };
    })
  );

  const results: Array<{ success: boolean; result?: T; error?: unknown }> = [];
  let successCount = 0;
  let errorCount = 0;

  for (const operationResult of operationResults) {
    if (operationResult.status === 'fulfilled') {
      results.push({ success: true, result: operationResult.value.result });
      successCount++;

      if (operationResult.value.operation.success !== undefined) {
        showSuccess(operationResult.value.operation.success);
      }
    } else {
      const error: unknown = operationResult.reason;
      const matchingOperation = operations[operationResults.indexOf(operationResult)];
      results.push({ success: false, error });
      errorCount++;

      if (matchingOperation?.error !== undefined) {
        showError(error, matchingOperation.error);
      }
    }
  }

  if (operations.length > 1) {
    if (errorCount === 0) {
      showSuccess(`All ${successCount} operations completed successfully`);
    } else if (successCount === 0) {
      showError(`All ${errorCount} operations failed`);
    } else {
      showWarning(`${successCount} succeeded, ${errorCount} failed`);
    }
  }

  return results;
}
