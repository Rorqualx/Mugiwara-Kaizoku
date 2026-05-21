/**
 * Notification Hook
 *
 * Thin wrapper over the unified `notify` primitive (`src/utils/notify.ts`).
 * Each call shows a Mantine toast AND persists a bell-dropdown row.
 *
 * @module useNotification
 */

import { notify, notifyError, type NotifyType } from '@/utils/notify';

type NotificationSeverity = 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';
type NotificationType = NotifyType;

/**
 * Options for displaying a notification
 */
export interface NotificationOptions {
  /** Title of the notification */
  title: string;
  /** Main content of the notification */
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
  // Legacy options (ignored — Mantine toast handles defaults)
  autoClose?: number;
  icon?: React.ReactNode;
  color?: string;
  position?: string;
  id?: string;
}

/**
 * Extended notification options for showing errors
 */
export interface ErrorNotificationOptions extends NotificationOptions {
  /** Optional error object to extract more details from */
  error?: Error | unknown;
  /** Whether to log the error to the console @default true */
  logToConsole?: boolean;
}

/** @deprecated Use NotificationOptions instead */
export interface NotificationProps {
  id?: string;
  title?: React.ReactNode;
  message: React.ReactNode;
  [key: string]: unknown;
}

/**
 * Result of the useNotification hook
 */
export interface UseNotificationResult {
  /** Shows a success notification */
  showSuccess: (options: NotificationOptions) => string;
  /** Shows an error notification */
  showError: (options: ErrorNotificationOptions) => string;
  /** Shows an info notification */
  showInfo: (options: NotificationOptions) => string;
  /** Shows a custom notification */
  showCustom: (options: NotificationProps) => string;
  /** @deprecated No-op for bell notifications */
  updateNotification: (id: string, options: Partial<NotificationProps>) => void;
  /** @deprecated No-op for bell notifications */
  closeNotification: (id: string) => void;
}

function dispatch(severity: NotificationSeverity, options: NotificationOptions): string {
  const id = `notification-${Date.now()}`;
  notify({
    severity,
    title: options.title,
    message: options.message,
    ...(options.type !== undefined ? { type: options.type } : {}),
    ...(options.metadata !== undefined ? { metadata: options.metadata } : {}),
    ...(options.relatedMangaId !== undefined ? { relatedMangaId: options.relatedMangaId } : {}),
    ...(options.relatedChapterId !== undefined ? { relatedChapterId: options.relatedChapterId } : {}),
    ...(options.actionUrl !== undefined ? { actionUrl: options.actionUrl } : {}),
    ...(options.autoClose !== undefined ? { toast: { autoClose: options.autoClose } } : {}),
  });
  return id;
}

/**
 * Hook for creating bell-icon notifications (toast + database-persisted).
 */
export function useNotification(): UseNotificationResult {
  const showSuccess = (options: NotificationOptions): string => {
    return dispatch('SUCCESS', options);
  };

  const showError = (options: ErrorNotificationOptions): string => {
    const id = `notification-${Date.now()}`;
    if (options.error !== undefined) {
      notifyError(options.error, { title: options.title });
    } else {
      dispatch('ERROR', { ...options, type: options.type ?? 'SYSTEM_ERROR' });
    }
    return id;
  };

  const showInfo = (options: NotificationOptions): string => {
    return dispatch('INFO', options);
  };

  const showCustom = (options: NotificationProps): string => {
    const title = typeof options.title === 'string' ? options.title : 'Notification';
    const message =
      typeof options.message === 'string' ? options.message : String(options.message);
    return dispatch('INFO', { title, message });
  };

  const updateNotification = (_id: string, _options: Partial<NotificationProps>): void => {
    // No-op: Bell notifications are database-persisted and cannot be updated from client
  };

  const closeNotification = (_id: string): void => {
    // No-op: Bell notifications are database-persisted and cannot be closed from client
  };

  return {
    showSuccess,
    showError,
    showInfo,
    showCustom,
    updateNotification,
    closeNotification,
  };
}
