import { prisma } from '@/server/db';

import { protectedProcedure } from '../procedures';
import { router } from '../trpc';

import { isAdmin, membershipWhere, requireUserId } from './_shared/library-access';
import type {} from '@prisma/client';
/**
 * History Router - Manages access to download history
 * 
 * This router provides endpoints for retrieving historical information about
 * completed chapter downloads in the system.
 */
export const historyRouter = router({
  /**
   * Retrieves the most recently completed chapter downloads
   * 
   * This endpoint queries the database for chapters that have been successfully
   * downloaded, ordered by creation date. It includes related manga and metadata
   * information to provide a complete view of the download history.
   * 
   * @returns {Array<Object>} Array of recently completed chapter downloads with related manga data
   */
  query: protectedProcedure.query(async ({ ctx }) => {
    // Scope recently-completed chapters to the caller's library (shared catalog
    // is per-user via LibraryMembership); admins see the whole catalog.
    const recentChapters = await prisma.chapter.findMany({
      where: {
        downloadStatus: "COMPLETED",
        ...(isAdmin(ctx) ? {} : { Manga: membershipWhere(requireUserId(ctx)) })
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 10, include: {
        Manga: {
          include: {
            Metadata: true
          }
        }
      }
    });
    return recentChapters;
  })
});