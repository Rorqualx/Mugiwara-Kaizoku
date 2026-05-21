/**
 * Unified Notification Primitive
 *
 * Single client surface for notifications. By default `notify(...)` shows a
 * transient Mantine toast AND persists a bell row via tRPC, so the same event
 * is both instantly visible and durable in the bell dropdown.
 *
 * Existing helpers (`src/utils/notifications.tsx`, `src/utils/notificationHelpers.ts`,
 * `src/utils/notifications/helpers.ts`, `src/hooks/useBellNotification.ts`,
 * `src/hooks/useNotification.ts`) all delegate to this module.
 *
 * @module notify
 */

import React from 'react';

import { notifications } from '@mantine/notifications';
import {
  IconAlertTriangle,
  IconCheck,
  IconInfoCircle,
  IconX,
} from '@tabler/icons-react';


import { getErrorMessage } from './errors/helpers';
import { logger } from './logger';
import { vanillaTrpcClient } from './trpc-client/vanilla';

import type { NotificationData } from '@mantine/notifications';

export type NotifySeverity = 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';

export type NotifyType =
  | 'USER_ACTION'
  | 'SYSTEM_INFO'
  | 'SYSTEM_WARNING'
  | 'SYSTEM_ERROR'
  | 'MANGA_ADDED'
  | 'MANGA_UPDATED'
  | 'CHAPTER_DOWNLOADED'
  | 'SYNC_COMPLETED'
  | 'BACKUP_COMPLETED';

export interface NotifyOptions {
  severity: NotifySeverity;
  title: string;
  message: string;
  /** Notification type for categorization. Defaults to severity-mapped USER_ACTION/SYSTEM_*. */
  type?: NotifyType;
  /**
   * Transient toast control. Defaults `true`. Pass `false` to skip the toast
   * (durable bell row only). Pass an object to override `autoClose`.
   */
  toast?: boolean | { autoClose?: number | false };
  /** Persist to bell. Defaults `true`. Pass `false` for ephemeral-only feedback. */
  persist?: boolean;
  relatedMangaId?: number;
  relatedChapterId?: number;
  actionUrl?: string;
  metadata?: Record<string, unknown>;
}

const COLOR_BY_SEVERITY: Record<NotifySeverity, string> = {
  INFO: 'blue',
  SUCCESS: 'teal',
  WARNING: 'yellow',
  ERROR: 'red',
};

const DEFAULT_AUTOCLOSE: Record<NotifySeverity, number | false> = {
  INFO: 4000,
  SUCCESS: 4000,
  WARNING: 8000,
  ERROR: false,
};

function severityIcon(severity: NotifySeverity): React.ReactElement {
  switch (severity) {
    case 'SUCCESS':
      return React.createElement(IconCheck, { size: 18 });
    case 'ERROR':
      return React.createElement(IconX, { size: 18 });
    case 'WARNING':
      return React.createElement(IconAlertTriangle, { size: 18 });
    case 'INFO':
    default:
      return React.createElement(IconInfoCircle, { size: 18 });
  }
}

function severityToType(severity: NotifySeverity): NotifyType {
  switch (severity) {
    case 'SUCCESS':
      return 'USER_ACTION';
    case 'ERROR':
      return 'SYSTEM_ERROR';
    case 'WARNING':
      return 'SYSTEM_WARNING';
    case 'INFO':
    default:
      return 'SYSTEM_INFO';
  }
}

const RECENT_TOAST_TTL_MS = 5000;
const recentToastIds = new Map<string, number>();

function trackRecentLocalToast(id: string): void {
  recentToastIds.set(id, Date.now());
  setTimeout(() => recentToastIds.delete(id), RECENT_TOAST_TTL_MS);
}

/**
 * Returns true if the given notification id was just shown locally as a toast.
 * The bell WebSocket subscriber can call this to skip re-toasting the echo of
 * a locally-initiated notification.
 */
export function isRecentLocalToast(id: string | undefined): boolean {
  if (id === undefined || id === '') return false;
  const ts = recentToastIds.get(id);
  if (ts === undefined) return false;
  return Date.now() - ts < RECENT_TOAST_TTL_MS;
}

function showToast(options: NotifyOptions): void {
  const autoCloseOverride =
    typeof options.toast === 'object' ? options.toast.autoClose : undefined;
  const props: NotificationData = {
    title: options.title,
    message: options.message,
    color: COLOR_BY_SEVERITY[options.severity],
    icon: severityIcon(options.severity),
    autoClose: autoCloseOverride ?? DEFAULT_AUTOCLOSE[options.severity],
  };
  notifications.show(props);
}

function persistBellRow(options: NotifyOptions): void {
  const type = options.type ?? severityToType(options.severity);
  const payload: Parameters<typeof vanillaTrpcClient.notifications.create.mutate>[0] = {
    type,
    title: options.title,
    message: options.message,
    severity: options.severity,
  };
  if (options.metadata !== undefined) payload.metadata = options.metadata;
  if (options.relatedMangaId !== undefined) payload.relatedMangaId = options.relatedMangaId;
  if (options.relatedChapterId !== undefined) payload.relatedChapterId = options.relatedChapterId;
  if (options.actionUrl !== undefined) payload.actionUrl = options.actionUrl;

  vanillaTrpcClient.notifications.create.mutate(payload).then(
    (created) => {
      trackRecentLocalToast(String(created.id));
    },
    (error: unknown) => {
      logger.warn('notify: bell persistence failed', {
        error: getErrorMessage(error),
        title: options.title,
      });
    }
  );
}

/**
 * Show a notification. By default both toasts and persists to the bell dropdown.
 *
 * @example
 * notify({ severity: 'SUCCESS', title: 'Saved', message: 'Settings updated.' });
 * notify({ severity: 'ERROR', title: 'Failed', message: 'Try again.', persist: false });
 * notify({ severity: 'INFO', title: 'Tip', message: 'Use ⌘K to search.', toast: { autoClose: 8000 } });
 */
export function notify(options: NotifyOptions): void {
  const showToastFlag = options.toast !== false;
  const persistFlag = options.persist !== false;

  if (showToastFlag) {
    showToast(options);
  }

  if (persistFlag && typeof window !== 'undefined') {
    persistBellRow(options);
  }
}

/**
 * Show an error notification from any thrown value. Extracts the message via
 * `getErrorMessage` and defaults severity/type to ERROR/SYSTEM_ERROR.
 */
export function notifyError(
  error: unknown,
  opts?: Partial<Omit<NotifyOptions, 'severity' | 'message'>> & { title?: string }
): void {
  notify({
    severity: 'ERROR',
    title: opts?.title ?? 'Error',
    message: getErrorMessage(error),
    type: opts?.type ?? 'SYSTEM_ERROR',
    ...(opts?.toast !== undefined ? { toast: opts.toast } : {}),
    ...(opts?.persist !== undefined ? { persist: opts.persist } : {}),
    ...(opts?.metadata !== undefined ? { metadata: opts.metadata } : {}),
    ...(opts?.relatedMangaId !== undefined ? { relatedMangaId: opts.relatedMangaId } : {}),
    ...(opts?.relatedChapterId !== undefined ? { relatedChapterId: opts.relatedChapterId } : {}),
    ...(opts?.actionUrl !== undefined ? { actionUrl: opts.actionUrl } : {}),
  });
}
