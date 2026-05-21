/**
 * Per-user notification preference procedures.
 *
 * Backs the settings UI matrix where each row is a NotificationEventType and
 * each column is a delivery channel ('bell' | 'email' | 'discord' | 'slack' |
 * 'telegram' | 'webhook'). Rows in the `NotificationPreference` table are
 * upserts of explicit user choices; absence falls back to defaults from
 * `notification-preferences.ts` (bell ON, external channels OFF).
 */
import { NotificationEventType } from '@prisma/client';
import { z } from 'zod';

import {
  PREFERENCE_CHANNELS,
  type PreferenceChannel,
} from '@/server/services/notifications/notification-preferences';
import { protectedProcedure } from '@/server/trpc/procedures';
import { router } from '@/server/trpc/trpc';

const channelEnum = z.enum(PREFERENCE_CHANNELS as unknown as readonly [PreferenceChannel, ...PreferenceChannel[]]);

export const notificationPreferenceRouter = router({
  /**
   * Return every (eventType, channel) preference row for the current user.
   * UI fills in defaults for rows that aren't present.
   */
  getMatrix: protectedProcedure.query(async ({ ctx }) => {
    const rows = await ctx.prisma.notificationPreference.findMany({
      where: { userId: ctx.user.id },
      select: { eventType: true, channel: true, enabled: true },
    });
    return rows;
  }),

  /** Upsert one cell of the matrix. */
  setPreference: protectedProcedure
    .input(
      z.object({
        eventType: z.nativeEnum(NotificationEventType),
        channel: channelEnum,
        enabled: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const row = await ctx.prisma.notificationPreference.upsert({
        where: {
          userId_eventType_channel: {
            userId: ctx.user.id,
            eventType: input.eventType,
            channel: input.channel,
          },
        },
        create: {
          userId: ctx.user.id,
          eventType: input.eventType,
          channel: input.channel,
          enabled: input.enabled,
        },
        update: { enabled: input.enabled },
      });
      return { id: row.id, enabled: row.enabled };
    }),

  /**
   * Reset every preference for the current user back to defaults by deleting
   * the rows. The default-fallback in `notification-preferences.ts` takes over.
   */
  resetAll: protectedProcedure.mutation(async ({ ctx }) => {
    const result = await ctx.prisma.notificationPreference.deleteMany({
      where: { userId: ctx.user.id },
    });
    return { deleted: result.count };
  }),
});
