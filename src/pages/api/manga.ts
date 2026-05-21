/**
 * API endpoint for manga data
 *
 * Fetches manga data from the database with proper authorization.
 * Each manga entry includes metadata like title, status, chapters count, etc.
 *
 * Security:
 * - Requires authentication (OWASP A01:2021)
 * - Returns only manga from user's libraries
 *
 * @module pages/api/manga
 */

import { getServerSession } from 'next-auth/next';

import { authOptions } from '@/pages/api/auth/[...nextauth]';
import { prisma } from '@/server/db';
import { createApiRoute, successResponse } from '@/utils/api-route-factory';
import { logger } from '@/utils/logger';

/**
 * Manga API handler
 *
 * GET: Returns an array of manga entries from user's libraries
 */
export default createApiRoute({
  requireAuth: true, // SECURITY: Require authentication (OWASP A01:2021)
  handlers: {
    GET: async (req, res): Promise<void> => {
      // SECURITY: Verify authentication (OWASP A01:2021)
      const session = await getServerSession(req, res, authOptions);
      if (!session?.user) {
        logger.warn('Unauthorized manga access attempt', {
          ip: req.headers['x-forwarded-for'] ?? req.socket.remoteAddress
        });
        return res.status(401).json({
          error: 'Authentication required',
          code: 'UNAUTHORIZED'
        });
      }

      try {
        // SECURITY: Authentication required at route level (OWASP A01:2021)
        // Note: Libraries are public/shared resources (no userId field in schema)
        const manga = await prisma.manga.findMany({
          select: {
            id: true,
            title: true,
            summary: true,
            publicationStatus: true,
            providerMetadata: true
          },
          orderBy: {
            updatedAt: 'desc'
          },
          take: 50 // Limit to 50 most recent entries
        });

        // Transform the data to match expected format
        const transformedManga = manga.map(item => {
          const metadata = item.providerMetadata as unknown as { coverImage?: string; coverUrl?: string; chapters?: number; volumes?: number } | null;
          return {
            id: String(item.id),
            title: String(item.title),
            coverUrl: metadata?.coverImage ?? metadata?.coverUrl ?? '/cover-not-found.jpg',
            status: item.publicationStatus,
            chapters: metadata?.chapters ?? 0,
            volumes: metadata?.volumes ?? 0,
            description: item.summary ?? ''
          };
        });

        res.status(200).json(successResponse(transformedManga));
      } catch (error) {
        logger.error('Error fetching manga:', {
          error: error instanceof Error ? error.message : String(error),
          userId: session.user.id
        });
        res.status(500).json({ error: 'Failed to fetch manga data' });
      }
    }
  }
});