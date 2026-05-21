/**
 * Scanlation Group Router
 *
 * tRPC router for scanlation group management endpoints.
 *
 * @module server/trpc/routers/scanlationGroup
 */

import { z } from 'zod';

import { scanlationGroupService } from '@/server/services/scanlation/ScanlationGroupService';
import { publicProcedure, protectedProcedure } from '@/server/trpc/procedures';
import { router } from '@/server/trpc/trpc';
import { logger } from '@/utils/logger';

const log = logger.child('scanlationGroupRouter');

/**
 * Scanlation Group Router
 */
export const scanlationGroupRouter = router({
  /**
   * Get a scanlation group by ID
   */
  getGroup: publicProcedure
    .input(z.object({
      groupId: z.string(),
      fetchIfMissing: z.boolean().default(true)
    }))
    .query(async ({ input }) => {
      const group = await scanlationGroupService.getGroup(
        input.groupId,
        input.fetchIfMissing
      );
      return group;
    }),

  /**
   * Get all groups for a manga
   */
  getMangaGroups: publicProcedure
    .input(z.object({
      mangaId: z.number(),
      language: z.string().optional()
    }))
    .query(async ({ input }) => {
      const groups = await scanlationGroupService.getMangaGroups(
        input.mangaId,
        input.language
      );
      return groups;
    }),

  /**
   * Search for scanlation groups
   */
  searchGroups: publicProcedure
    .input(z.object({
      query: z.string().min(1),
      limit: z.number().min(1).max(100).default(20)
    }))
    .query(async ({ input }) => {
      const groups = await scanlationGroupService.searchGroups(
        input.query,
        input.limit
      );
      return groups;
    }),

  /**
   * Set preference for a group on a manga
   */
  setGroupPreference: protectedProcedure
    .input(z.object({
      mangaId: z.number(),
      groupId: z.string(),
      preference: z.enum(['preferred', 'excluded', 'neutral']),
      language: z.string().default('en')
    }))
    .mutation(async ({ input }) => {
      log.info('Setting group preference', input);

      const result = await scanlationGroupService.setGroupPreference(
        input.mangaId,
        input.groupId,
        input.preference,
        input.language
      );

      return result;
    }),

  /**
   * Get preferred groups for a manga
   */
  getPreferredGroups: publicProcedure
    .input(z.object({
      mangaId: z.number(),
      language: z.string().optional()
    }))
    .query(async ({ input }) => {
      const groupIds = await scanlationGroupService.getPreferredGroups(
        input.mangaId,
        input.language
      );
      return groupIds;
    }),

  /**
   * Get excluded groups for a manga
   */
  getExcludedGroups: publicProcedure
    .input(z.object({
      mangaId: z.number(),
      language: z.string().optional()
    }))
    .query(async ({ input }) => {
      const groupIds = await scanlationGroupService.getExcludedGroups(
        input.mangaId,
        input.language
      );
      return groupIds;
    })
});
