/**
 * User Settings Router
 *
 * Per-user preference overrides (download mode, preferred language, content
 * filters). Every procedure is scoped to the caller via `requireUserId(ctx)`
 * and constrained to the allow-list in user-config-service — a user can only
 * read/write their OWN overrides, and only for overridable keys. The admin's
 * global value is the fallback.
 *
 * @module server/trpc/routers/userSettings
 */
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import {
  USER_OVERRIDABLE_KEYS,
  getUserConfigValue,
  getUserEffectiveConfig,
  isUserOverridableKey,
  resetUserConfig,
  setUserConfig,
} from '@/server/services/config/user-config-service';
import { logger } from '@/utils/logger';

import { protectedProcedure } from '../procedures';
import { router } from '../trpc';

import { requireUserId } from './_shared/library-access';

const overridableKeySchema = z.enum(
  USER_OVERRIDABLE_KEYS as unknown as [string, ...string[]],
);

export const userSettingsRouter = router({
  /** Which keys the user may override (for building the preferences UI). */
  overridableKeys: protectedProcedure.query((): readonly string[] => USER_OVERRIDABLE_KEYS),

  /**
   * Effective + global values for every overridable key (or a requested
   * subset). Each entry says whether it's the user's own override or the
   * inherited global default.
   */
  getEffective: protectedProcedure
    .input(z.object({ keys: z.array(z.string()).optional() }).optional())
    .query(async ({ input, ctx }) => {
      const userId = requireUserId(ctx);
      const keys = input?.keys ?? USER_OVERRIDABLE_KEYS;
      return getUserEffectiveConfig(userId, keys);
    }),

  /** Resolved effective value for a single overridable key. */
  get: protectedProcedure
    .input(z.object({ key: overridableKeySchema }))
    .query(async ({ input, ctx }) => {
      const userId = requireUserId(ctx);
      return { key: input.key, value: await getUserConfigValue(userId, input.key, undefined) };
    }),

  /** Set the caller's override for an allow-listed key (validated + typed). */
  set: protectedProcedure
    .input(z.object({ key: overridableKeySchema, value: z.unknown() }))
    .mutation(async ({ input, ctx }) => {
      const userId = requireUserId(ctx);
      if (!isUserOverridableKey(input.key)) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: `"${input.key}" is not user-overridable` });
      }
      try {
        await setUserConfig(userId, input.key, input.value);
      } catch (error: unknown) {
        // Zod validation failures from validateConfigKey land here.
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error instanceof Error ? error.message : 'Invalid value for setting',
        });
      }
      logger.info(`[userSettings] ${userId} set ${input.key}`);
      return { success: true };
    }),

  /** Clear the caller's override for a key → reverts to the global value. */
  reset: protectedProcedure
    .input(z.object({ key: overridableKeySchema }))
    .mutation(async ({ input, ctx }) => {
      const userId = requireUserId(ctx);
      await resetUserConfig(userId, input.key);
      return { success: true };
    }),
});
