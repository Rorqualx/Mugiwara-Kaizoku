/**
 * Bell Notification Hook
 *
 * Thin wrapper over the unified `notify` primitive (`src/utils/notify.ts`).
 * Each call shows a Mantine toast AND persists a bell-dropdown row.
 * `isPending` is preserved for backwards compatibility; the unified helper
 * fires fire-and-forget so it's always `false`.
 *
 * @module useBellNotification
 */

import { notify, notifyError, type NotifyType } from '@/utils/notify';

type NotificationSeverity = 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';
type NotificationType = NotifyType;

export interface BellNotificationOptions {
  /** Notification title */
  title: string;
  /** Notification message */
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
}

export interface UseBellNotificationResult {
  /** Show a success notification */
  showSuccess: (options: BellNotificationOptions | string) => void;
  /** Show an error notification */
  showError: (error: unknown, title?: string) => void;
  /** Show a warning notification */
  showWarning: (options: BellNotificationOptions | string) => void;
  /** Show an info notification */
  showInfo: (options: BellNotificationOptions | string) => void;
  /** Whether a notification is being created. Always false — kept for API parity. */
  isPending: boolean;
}

function normalizeOptions(
  options: BellNotificationOptions | string,
  defaultTitle: string
): BellNotificationOptions {
  if (typeof options === 'string') {
    return { title: defaultTitle, message: options };
  }
  return options;
}

function dispatch(severity: NotificationSeverity, options: BellNotificationOptions): void {
  notify({
    severity,
    title: options.title,
    message: options.message,
    ...(options.type !== undefined ? { type: options.type } : {}),
    ...(options.metadata !== undefined ? { metadata: options.metadata } : {}),
    ...(options.relatedMangaId !== undefined ? { relatedMangaId: options.relatedMangaId } : {}),
    ...(options.relatedChapterId !== undefined ? { relatedChapterId: options.relatedChapterId } : {}),
    ...(options.actionUrl !== undefined ? { actionUrl: options.actionUrl } : {}),
  });
}

/**
 * Hook for creating bell-icon notifications (toast + database-persisted).
 */
export function useBellNotification(): UseBellNotificationResult {
  const showSuccess = (options: BellNotificationOptions | string): void => {
    dispatch('SUCCESS', normalizeOptions(options, 'Success'));
  };

  const showError = (error: unknown, title = 'Error'): void => {
    notifyError(error, { title });
  };

  const showWarning = (options: BellNotificationOptions | string): void => {
    dispatch('WARNING', normalizeOptions(options, 'Warning'));
  };

  const showInfo = (options: BellNotificationOptions | string): void => {
    dispatch('INFO', normalizeOptions(options, 'Information'));
  };

  return {
    showSuccess,
    showError,
    showWarning,
    showInfo,
    isPending: false,
  };
}
