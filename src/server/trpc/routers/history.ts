import { prisma } from '@/server/db';

import { publicProcedure } from '../procedures';
import { router } from '../trpc';
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
  query: publicProcedure.query(async () => {
    const recentChapters = await prisma.chapter.findMany({
      where: {
        downloadStatus: "COMPLETED"
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