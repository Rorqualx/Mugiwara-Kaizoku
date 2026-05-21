/**
 * Audio Player Router - Settings Module
 *
 * Procedures:
 * - getSettings: Get player settings
 * - updateSettings: Update player settings
 *
 * @module server/trpc/routers/audioPlayer/settings
 */

import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { realtimeEmitter } from '@/server/services/realtime/RealtimeEventEmitter';
import { protectedProcedure } from '@/server/trpc/procedures';
import { router } from '@/server/trpc/trpc';

import { getUserId, PLAYBACK_SPEEDS, SLEEP_TIMER_PRESETS } from './utils';

import type { AudioPlayerSettings } from '@prisma/client';

// ============================================================================
// Validation Schemas
// ============================================================================

const playbackSpeedSchema = z.number().refine(
  (val) => PLAYBACK_SPEEDS.includes(val as (typeof PLAYBACK_SPEEDS)[number]),
  { message: 'Invalid playback speed' }
);

const sleepTimerPresetSchema = z.number().refine(
  (val) => SLEEP_TIMER_PRESETS.includes(val as (typeof SLEEP_TIMER_PRESETS)[number]),
  { message: 'Invalid sleep timer preset' }
);

// ============================================================================
// Default Settings
// ============================================================================

/**
 * Settings update data shape for Prisma upsert
 */
interface SettingsUpdateData {
  defaultPlaybackSpeed?: number;
  defaultSkipForward?: number;
  defaultSkipBackward?: number;
  sleepTimerDefault?: number | null;
  rememberPosition?: boolean;
  autoPlayNext?: boolean;
  showRemainingTime?: boolean;
  hapticFeedback?: boolean;
}

const DEFAULT_SETTINGS: Required<SettingsUpdateData> = {
  defaultPlaybackSpeed: 1.0,
  defaultSkipForward: 30,
  defaultSkipBackward: 10,
  sleepTimerDefault: null,
  rememberPosition: true,
  autoPlayNext: true,
  showRemainingTime: false,
  hapticFeedback: true,
};

// ============================================================================
// Router
// ============================================================================

export const audioPlayerSettingsRouter = router({
  /**
   * Get player settings
   *
   * Retrieves the audio player settings for the authenticated user.
   * Returns default settings if none have been saved.
   */
  getSettings: protectedProcedure.query(
    async ({ ctx }): Promise<AudioPlayerSettings> => {
      const userId = getUserId(ctx);
      if (!userId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'User not authenticated',
        });
      }

      const settings = await ctx.prisma.audioPlayerSettings.findUnique({
        where: { userId },
      });

      if (settings) {
        return settings;
      }

      // Return default settings (don't create record until user modifies)
      return {
        userId,
        ...DEFAULT_SETTINGS,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }
  ),

  /**
   * Update player settings
   *
   * Updates the audio player settings for the authenticated user.
   * Creates settings record if it doesn't exist.
   */
  updateSettings: protectedProcedure
    .input(
      z.object({
        defaultPlaybackSpeed: playbackSpeedSchema.optional(),
        defaultSkipForward: z.number().min(5).max(120).optional(),
        defaultSkipBackward: z.number().min(5).max(120).optional(),
        sleepTimerDefault: sleepTimerPresetSchema.nullable().optional(),
        rememberPosition: z.boolean().optional(),
        autoPlayNext: z.boolean().optional(),
        showRemainingTime: z.boolean().optional(),
        hapticFeedback: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }): Promise<AudioPlayerSettings> => {
      const userId = getUserId(ctx);
      if (!userId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'User not authenticated',
        });
      }

      // Build update data only with defined values
      const updateData: SettingsUpdateData = {};
      if (input.defaultPlaybackSpeed !== undefined) updateData.defaultPlaybackSpeed = input.defaultPlaybackSpeed;
      if (input.defaultSkipForward !== undefined) updateData.defaultSkipForward = input.defaultSkipForward;
      if (input.defaultSkipBackward !== undefined) updateData.defaultSkipBackward = input.defaultSkipBackward;
      if (input.sleepTimerDefault !== undefined) updateData.sleepTimerDefault = input.sleepTimerDefault;
      if (input.rememberPosition !== undefined) updateData.rememberPosition = input.rememberPosition;
      if (input.autoPlayNext !== undefined) updateData.autoPlayNext = input.autoPlayNext;
      if (input.showRemainingTime !== undefined) updateData.showRemainingTime = input.showRemainingTime;
      if (input.hapticFeedback !== undefined) updateData.hapticFeedback = input.hapticFeedback;

      const settings = await ctx.prisma.audioPlayerSettings.upsert({
        where: { userId },
        create: {
          userId,
          ...DEFAULT_SETTINGS,
          ...updateData,
        },
        update: updateData,
      });

      // Emit WebSocket event for real-time sync
      void realtimeEmitter.emitSystemEvent({
        eventType: 'audioPlayer:settings:updated',
        source: 'audioPlayer-settings',
        message: 'Audio player settings updated',
        data: { userId }
      });

      return settings;
    }),

  /**
   * Reset settings to defaults
   *
   * Resets all audio player settings to their default values.
   */
  resetSettings: protectedProcedure.mutation(
    async ({ ctx }): Promise<AudioPlayerSettings> => {
      const userId = getUserId(ctx);
      if (!userId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'User not authenticated',
        });
      }

      const settings = await ctx.prisma.audioPlayerSettings.upsert({
        where: { userId },
        create: {
          userId,
          ...DEFAULT_SETTINGS,
        },
        update: {
          ...DEFAULT_SETTINGS,
        },
      });

      // Emit WebSocket event for real-time sync
      void realtimeEmitter.emitSystemEvent({
        eventType: 'audioPlayer:settings:reset',
        source: 'audioPlayer-settings',
        message: 'Audio player settings reset to defaults',
        data: { userId }
      });

      return settings;
    }
  ),
});
