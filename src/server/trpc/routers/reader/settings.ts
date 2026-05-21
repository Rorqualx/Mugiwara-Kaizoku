/**
 * Reader Router - Settings Module
 *
 * Procedures:
 * - getSettings: Get reader settings with defaults
 * - updateSettings: Update reader settings with exactOptionalPropertyTypes pattern
 *
 * Extracted from: reader.ts (lines 386-487)
 */

import { TRPCError } from '@trpc/server';
import { z } from 'zod';


import { protectedProcedure } from '@/server/trpc/procedures';
import { router } from '@/server/trpc/trpc';

import { getUserId } from './utils';

import type { ReaderSettings } from '@prisma/client';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Build settings data object with exactOptionalPropertyTypes pattern
 */
function buildSettingsData(
  input: {
    readingMode?: 'single' | 'double' | 'continuous_vertical' | 'continuous_horizontal' | 'webtoon' | undefined;
    readingDirection?: 'ltr' | 'rtl' | undefined;
    backgroundColor?: string | undefined;
    fitMode?: 'fit-width' | 'fit-height' | 'fit-both' | 'original' | 'stretch' | undefined;
    showToolbar?: boolean | undefined;
    preloadPages?: number | undefined;
    doublePageOffset?: boolean | undefined;
    brightness?: number | undefined;
    contrast?: number | undefined;
    enableGestures?: boolean | undefined;
    enableKeyboard?: boolean | undefined;
    clickNavigation?: boolean | undefined;
    smoothScrolling?: boolean | undefined;
    panelDetection?: boolean | undefined;
    ocrEnabled?: boolean | undefined;
  }
): Partial<Omit<ReaderSettings, 'userId' | 'createdAt' | 'updatedAt' | 'user'>> {
  const data: Partial<Omit<ReaderSettings, 'userId' | 'createdAt' | 'updatedAt' | 'user'>> = {};

  if (input.readingMode !== undefined) data.readingMode = input.readingMode;
  if (input.readingDirection !== undefined) data.readingDirection = input.readingDirection;
  if (input.backgroundColor !== undefined) data.backgroundColor = input.backgroundColor;
  if (input.fitMode !== undefined) data.fitMode = input.fitMode;
  if (input.showToolbar !== undefined) data.showToolbar = input.showToolbar;
  if (input.preloadPages !== undefined) data.preloadPages = input.preloadPages;
  if (input.doublePageOffset !== undefined) data.doublePageOffset = input.doublePageOffset;
  if (input.brightness !== undefined) data.brightness = input.brightness;
  if (input.contrast !== undefined) data.contrast = input.contrast;
  if (input.enableGestures !== undefined) data.enableGestures = input.enableGestures;
  if (input.enableKeyboard !== undefined) data.enableKeyboard = input.enableKeyboard;
  if (input.clickNavigation !== undefined) data.clickNavigation = input.clickNavigation;
  if (input.smoothScrolling !== undefined) data.smoothScrolling = input.smoothScrolling;
  if (input.panelDetection !== undefined) data.panelDetection = input.panelDetection;
  if (input.ocrEnabled !== undefined) data.ocrEnabled = input.ocrEnabled;

  return data;
}

// ============================================================================
// Default Settings
// ============================================================================

/**
 * Default reader settings applied when no user settings exist
 */
const DEFAULT_READER_SETTINGS = {
  readingMode: 'single',
  readingDirection: 'rtl',
  backgroundColor: '#000000',
  fitMode: 'fit-width',
  showToolbar: true,
  preloadPages: 3,
  doublePageOffset: false,
  brightness: 1.0,
  contrast: 1.0,
  enableGestures: true,
  enableKeyboard: true,
  clickNavigation: true,
  smoothScrolling: true,
  panelDetection: false,
  ocrEnabled: false,
} as const;

// ============================================================================
// Input Schemas
// ============================================================================

/**
 * Input schema for updateSettings mutation
 * All fields are optional to support partial updates
 */
const updateSettingsInputSchema = z.object({
  readingMode: z
    .enum(['single', 'double', 'continuous_vertical', 'continuous_horizontal', 'webtoon'])
    .optional(),
  readingDirection: z.enum(['ltr', 'rtl']).optional(),
  backgroundColor: z.string().optional(),
  fitMode: z.enum(['fit-width', 'fit-height', 'fit-both', 'original', 'stretch']).optional(),
  showToolbar: z.boolean().optional(),
  preloadPages: z.number().min(1).max(10).optional(),
  doublePageOffset: z.boolean().optional(),
  brightness: z.number().min(0).max(2).optional(),
  contrast: z.number().min(0).max(2).optional(),
  enableGestures: z.boolean().optional(),
  enableKeyboard: z.boolean().optional(),
  clickNavigation: z.boolean().optional(),
  smoothScrolling: z.boolean().optional(),
  panelDetection: z.boolean().optional(),
  ocrEnabled: z.boolean().optional(),
});

// ============================================================================
// Router Definition
// ============================================================================

export const readerSettingsRouter = router({
  /**
   * Get reader settings for the current user
   *
   * Returns user's saved settings or defaults if none exist
   *
   * @returns ReaderSettings object or default settings
   */
  getSettings: protectedProcedure.query(
    async ({ ctx }): Promise<ReaderSettings | typeof DEFAULT_READER_SETTINGS | null> => {
      const userId = getUserId(ctx);
      if (!userId) return null;

      const settings = await ctx.prisma.readerSettings.findUnique({
        where: { userId },
      });

      // Return default settings if none exist
      if (!settings) {
        return DEFAULT_READER_SETTINGS;
      }

      return settings;
    },
  ),

  /**
   * Update reader settings for the current user
   *
   * Uses upsert to create or update settings atomically.
   * Implements exactOptionalPropertyTypes pattern to avoid TypeScript errors
   * when spreading optional properties.
   *
   * @param input - Partial settings object with optional fields
   * @returns Updated ReaderSettings object
   * @throws TRPCError with UNAUTHORIZED if user not authenticated
   */
  updateSettings: protectedProcedure
    .input(updateSettingsInputSchema)
    .mutation(async ({ ctx, input }): Promise<ReaderSettings> => {
      const userId = getUserId(ctx);
      if (!userId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'User not authenticated',
        });
      }

      const settingsData = buildSettingsData(input);
      const createData = { userId, ...settingsData };

      return ctx.prisma.readerSettings.upsert({
        where: { userId },
        create: createData,
        update: settingsData,
      });
    }),
});
