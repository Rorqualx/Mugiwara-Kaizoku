/**
 * Unified server-side notification primitive.
 *
 * `notifyUser(...)` persists a bell-dropdown row, pushes a realtime payload to
 * the user's WebSocket channel, and optionally fans out to external delivery
 * channels (Discord/Email/Slack/Telegram/Webhook) via `NotificationService`.
 *
 * `notifySystem(...)` fans the same payload out to every user — used for
 * genuinely cross-user admin events (server health, etc.). Prefer `notifyUser`
 * whenever a subscriber list can be resolved.
 *
 * Server-side producers should call these helpers instead of touching
 * `prisma.notification` / `realtimeEmitter` / `NotificationService` directly,
 * so the bell, the realtime push and the external channels stay in sync.
 *
 * @module server/services/notifications/notify
 */

import { prisma } from '@/server/db';
import { realtimeEmitter } from '@/server/services/realtime';
import { getErrorMessage } from '@/utils/errors/helpers';
import { logger } from '@/utils/logger';

import { getUserChannelMatrix, type PreferenceChannel } from './notification-preferences';
import { NotificationService, type NotificationData } from './NotificationService';

import type {
  Notification,
  NotificationEventType,
  NotificationSeverity,
  Prisma,
} from '@prisma/client';

export interface NotifyUserParams {
  userId: string;
  type: NotificationEventType;
  severity?: NotificationSeverity;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
  relatedMangaId?: number | null;
  relatedChapterId?: number | null;
  relatedJobId?: bigint | null;
  actionUrl?: string | null;
  /**
   * Whether to dispatch to external channels (Discord/Email/...). Default `true`.
   * Pass `false` for bell-only notifications (e.g. UI feedback that already
   * flashed a toast and doesn't warrant a Discord ping).
   */
  externalChannels?: boolean;
}

export type NotifySystemParams = Omit<NotifyUserParams, 'userId'>;

const notificationService = new NotificationService();

/**
 * External channel routing requires a value from the legacy
 * `NotificationData.type` union. Map the broader Prisma enum onto it; unknown
 * types fall back to `SYSTEM`.
 */
function toChannelType(type: NotificationEventType): NotificationData['type'] {
  if (type === 'CHAPTER_ADDED' || type === 'CHAPTER_DOWNLOADED' || type === 'VOLUME_DOWNLOADED') {
    return 'NEW_RELEASE';
  }
  if (type.includes('FAILED') || type.includes('ERROR')) return 'ERROR';
  return 'SYSTEM';
}

function severityToLevel(severity: NotificationSeverity): 'info' | 'success' | 'warning' | 'error' {
  switch (severity) {
    case 'SUCCESS': return 'success';
    case 'ERROR': return 'error';
    case 'WARNING': return 'warning';
    case 'INFO':
    default: return 'info';
  }
}

function severityFromType(type: NotificationEventType): NotificationSeverity {
  if (type.includes('FAILED') || type.includes('ERROR')) return 'ERROR';
  if (type.includes('WARNING')) return 'WARNING';
  if (type.includes('COMPLETED') || type === 'USER_ACTION') return 'SUCCESS';
  return 'INFO';
}

async function dispatchExternalChannels(
  params: NotifyUserParams,
  severity: NotificationSeverity,
  enabledChannels: PreferenceChannel[],
): Promise<void> {
  // External-channel routing (Discord/Email/Slack/Telegram/Webhook) is still
  // gated by the system-level config table that `NotificationService.send`
  // consults internally. The `enabledChannels` allowlist here records which
  // external channels the *user* opted into; if all are off, we skip the
  // dispatch entirely. Per-channel routing through the service would need a
  // wider refactor and lands in a follow-up.
  if (enabledChannels.length === 0) return;

  const data: NotificationData = {
    type: toChannelType(params.type),
    title: params.title,
    message: params.message,
    userId: params.userId,
    severity,
  };
  if (params.metadata !== undefined) data.metadata = params.metadata;
  if (params.relatedMangaId !== undefined) data.relatedMangaId = params.relatedMangaId;
  if (params.relatedChapterId !== undefined) data.relatedChapterId = params.relatedChapterId;
  if (params.relatedJobId !== undefined) data.relatedJobId = params.relatedJobId;
  if (params.actionUrl !== undefined) data.actionUrl = params.actionUrl;

  const result = await notificationService.send(data);
  if (result.status === 'error') {
    logger.warn('notifyUser: external channel dispatch failed', {
      error: result.error.message,
      type: params.type,
    });
  }
}

/**
 * Persist a notification row scoped to `userId`, emit it to the user's realtime
 * channel, and optionally dispatch to external channels.
 *
 * Returns the created row on success, or `null` if persistence fails.
 * Persistence failures are logged but never thrown — producers should not have
 * to wrap every call in a try/catch.
 */
export async function notifyUser(params: NotifyUserParams): Promise<Notification | null> {
  const severity = params.severity ?? severityFromType(params.type);

  try {
    // Resolve the per-user (eventType × channel) matrix once. Missing rows fall
    // back to defaults from notification-preferences.ts (bell defaults on,
    // external channels default off).
    const matrix = await getUserChannelMatrix(params.userId, params.type);

    let notification: Notification | null = null;
    if (matrix.bell) {
      const data: Prisma.NotificationCreateInput = {
        User: { connect: { id: params.userId } },
        type: params.type,
        severity,
        title: params.title,
        message: params.message,
        read: false,
      };
      if (params.metadata !== undefined) {
        data.metadata = params.metadata as Prisma.InputJsonValue;
      }
      if (params.relatedMangaId !== undefined && params.relatedMangaId !== null) {
        data.relatedMangaId = params.relatedMangaId;
      }
      if (params.relatedChapterId !== undefined && params.relatedChapterId !== null) {
        data.relatedChapterId = params.relatedChapterId;
      }
      if (params.relatedJobId !== undefined && params.relatedJobId !== null) {
        data.relatedJobId = params.relatedJobId;
      }
      if (params.actionUrl !== undefined && params.actionUrl !== null) {
        data.actionUrl = params.actionUrl;
      }

      notification = await prisma.notification.create({ data });

      void realtimeEmitter.emitUserNotification(params.userId, {
        id: String(notification.id),
        title: params.title,
        message: params.message,
        level: severityToLevel(severity),
      });
    }

    if (params.externalChannels !== false) {
      const enabledExternal = (Object.entries(matrix) as Array<[PreferenceChannel, boolean]>)
        .filter(([channel, enabled]) => channel !== 'bell' && enabled)
        .map(([channel]) => channel);
      if (enabledExternal.length > 0) {
        void dispatchExternalChannels(params, severity, enabledExternal);
      }
    }

    return notification;
  } catch (error) {
    logger.error('notifyUser failed', {
      error: getErrorMessage(error),
      userId: params.userId,
      type: params.type,
      title: params.title,
    });
    return null;
  }
}

export interface NotifyChapterProgressParams {
  userId: string;
  chapterId: number;
  type: NotificationEventType;
  severity?: NotificationSeverity;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
  relatedMangaId?: number | null;
  actionUrl?: string | null;
}

/**
 * Upsert a per-chapter rolling notification row.
 *
 * Finds the existing Notification matching (userId, type, relatedChapterId)
 * and rewrites its title/message/severity/createdAt in place — the bell + the
 * EventsPanel re-fetch on the realtime push, so the same row updates as the
 * chapter moves through its download lifecycle (Searching → Found → Downloading
 * → Completed). If no row exists yet (first transition), a new one is created.
 *
 * `read` is reset to `false` on every update so the unread badge picks up
 * state changes the user hasn't seen yet. `createdAt` bumps to NOW so the row
 * floats to the top of the dropdown each transition.
 *
 * External-channel dispatch (Discord/Email/...) is intentionally suppressed —
 * these are high-frequency intermediate updates that would spam the channels.
 * Use `notifyUser` for the terminal "Chapter Downloaded" emission instead.
 */
export async function notifyChapterProgress(
  params: NotifyChapterProgressParams,
): Promise<Notification | null> {
  const severity = params.severity ?? severityFromType(params.type);

  try {
    const matrix = await getUserChannelMatrix(params.userId, params.type);
    if (!matrix.bell) return null;

    const existing = await prisma.notification.findFirst({
      where: {
        userId: params.userId,
        type: params.type,
        relatedChapterId: params.chapterId,
      },
      select: { id: true },
    });

    const baseData = {
      title: params.title,
      message: params.message,
      severity,
      read: false,
    };

    let notification: Notification;
    if (existing) {
      const update: Prisma.NotificationUpdateInput = {
        ...baseData,
        createdAt: new Date(),
      };
      if (params.metadata !== undefined) {
        update.metadata = params.metadata as Prisma.InputJsonValue;
      }
      if (params.relatedMangaId !== undefined && params.relatedMangaId !== null) {
        update.relatedMangaId = params.relatedMangaId;
      }
      if (params.actionUrl !== undefined && params.actionUrl !== null) {
        update.actionUrl = params.actionUrl;
      }
      notification = await prisma.notification.update({
        where: { id: existing.id },
        data: update,
      });
    } else {
      const create: Prisma.NotificationCreateInput = {
        User: { connect: { id: params.userId } },
        type: params.type,
        relatedChapterId: params.chapterId,
        ...baseData,
      };
      if (params.metadata !== undefined) {
        create.metadata = params.metadata as Prisma.InputJsonValue;
      }
      if (params.relatedMangaId !== undefined && params.relatedMangaId !== null) {
        create.relatedMangaId = params.relatedMangaId;
      }
      if (params.actionUrl !== undefined && params.actionUrl !== null) {
        create.actionUrl = params.actionUrl;
      }
      notification = await prisma.notification.create({ data: create });
    }

    void realtimeEmitter.emitUserNotification(params.userId, {
      id: String(notification.id),
      title: params.title,
      message: params.message,
      level: severityToLevel(severity),
    });

    return notification;
  } catch (error) {
    logger.error('notifyChapterProgress failed', {
      error: getErrorMessage(error),
      userId: params.userId,
      chapterId: params.chapterId,
      type: params.type,
    });
    return null;
  }
}

/**
 * Fan a notification out to every user. Used for genuinely cross-user admin
 * events (server health, system errors). Prefer `notifyUser` whenever a
 * subscriber list can be resolved — `notifySystem` writes one row per user.
 *
 * Also emits to the system-wide `system:notifications` channel for any
 * unauthenticated/global listeners.
 */
export async function notifySystem(params: NotifySystemParams): Promise<void> {
  const severity = params.severity ?? severityFromType(params.type);

  void realtimeEmitter.emitNotification({
    title: params.title,
    message: params.message,
    level: severityToLevel(severity),
  });

  try {
    const users = await prisma.user.findMany({ select: { id: true } });
    await Promise.allSettled(
      users.map((user) =>
        notifyUser({ ...params, userId: user.id, severity }),
      ),
    );
  } catch (error) {
    logger.error('notifySystem failed', {
      error: getErrorMessage(error),
      type: params.type,
      title: params.title,
    });
  }
}
