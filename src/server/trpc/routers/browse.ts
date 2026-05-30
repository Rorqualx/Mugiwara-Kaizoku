/**
 * Browse Router
 *
 * Provides procedures for browsing manga by author, publisher, genre,
 * and accessing related series / recommendations from MangaUpdates data.
 *
 * @module server/trpc/routers/browse
 */

import { z } from 'zod';

import { prisma } from '@/server/db';
import { logger } from '@/utils/logger';

import { publicProcedure } from '../procedures';
import { router } from '../trpc';

const log = logger.child('BrowseRouter');

// ============================================================================
// Shared select for manga cards (lightweight)
// ============================================================================

const mangaCardSelect = {
  id: true,
  title: true,
  Metadata: {
    select: {
      cover: true,
      coverLarge: true,
      authors: true,
      artists: true,
      publishers: true,
      genres: true,
      status: true,
      averageScore: true,
      chapters: true,
      volumes: true,
      summary: true,
    },
  },
} as const;

// ============================================================================
// Browse Procedures
// ============================================================================

export const browseRouter = router({
  /**
   * Get all manga in library by a specific author.
   */
  getByAuthor: publicProcedure
    .input(z.object({
      author: z.string().min(1),
      limit: z.number().min(1).max(50).default(20),
      cursor: z.number().optional(),
    }))
    .query(async ({ input }) => {
      const { author, limit, cursor } = input;
      log.info('Browse by author', { author, limit });

      const manga = await prisma.manga.findMany({
        where: {
          Metadata: { authors: { has: author } },
        },
        select: mangaCardSelect,
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        orderBy: { title: 'asc' },
      });

      const hasMore = manga.length > limit;
      const items = hasMore ? manga.slice(0, limit) : manga;

      return {
        items,
        nextCursor: hasMore ? items[items.length - 1]?.id : undefined,
      };
    }),

  /**
   * Get all manga in library by a specific artist.
   */
  getByArtist: publicProcedure
    .input(z.object({
      artist: z.string().min(1),
      limit: z.number().min(1).max(50).default(20),
      cursor: z.number().optional(),
    }))
    .query(async ({ input }) => {
      const { artist, limit, cursor } = input;

      const manga = await prisma.manga.findMany({
        where: {
          Metadata: { artists: { has: artist } },
        },
        select: mangaCardSelect,
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        orderBy: { title: 'asc' },
      });

      const hasMore = manga.length > limit;
      const items = hasMore ? manga.slice(0, limit) : manga;

      return {
        items,
        nextCursor: hasMore ? items[items.length - 1]?.id : undefined,
      };
    }),

  /**
   * Get all manga in library by a specific publisher.
   */
  getByPublisher: publicProcedure
    .input(z.object({
      publisher: z.string().min(1),
      limit: z.number().min(1).max(50).default(20),
      cursor: z.number().optional(),
    }))
    .query(async ({ input }) => {
      const { publisher, limit, cursor } = input;

      const manga = await prisma.manga.findMany({
        where: {
          // Phase 1: Metadata.publisher → Metadata.publishers[]. Match any element.
          Metadata: { publishers: { has: publisher } },
        },
        select: mangaCardSelect,
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        orderBy: { title: 'asc' },
      });

      const hasMore = manga.length > limit;
      const items = hasMore ? manga.slice(0, limit) : manga;

      return {
        items,
        nextCursor: hasMore ? items[items.length - 1]?.id : undefined,
      };
    }),

  /**
   * Get all manga in library filtered by genre.
   */
  getByGenre: publicProcedure
    .input(z.object({
      genre: z.string().min(1),
      limit: z.number().min(1).max(50).default(20),
      cursor: z.number().optional(),
    }))
    .query(async ({ input }) => {
      const { genre, limit, cursor } = input;

      const manga = await prisma.manga.findMany({
        where: {
          Metadata: { genres: { has: genre } },
        },
        select: mangaCardSelect,
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        orderBy: { title: 'asc' },
      });

      const hasMore = manga.length > limit;
      const items = hasMore ? manga.slice(0, limit) : manga;

      return {
        items,
        nextCursor: hasMore ? items[items.length - 1]?.id : undefined,
      };
    }),

  /**
   * Get all unique authors across the library.
   */
  getAuthors: publicProcedure
    .input(z.object({
      search: z.string().optional(),
      limit: z.number().min(1).max(200).default(50),
    }))
    .query(async ({ input }) => {
      const { search, limit } = input;

      const result = search
        ? await prisma.$queryRaw<Array<{ author: string; count: bigint }>>`
            SELECT a as author, COUNT(*) as count
            FROM "Metadata", unnest(authors) as a
            WHERE array_length(authors, 1) > 0 AND a ILIKE ${'%' + search + '%'}
            GROUP BY a ORDER BY count DESC, a ASC LIMIT ${limit}`
        : await prisma.$queryRaw<Array<{ author: string; count: bigint }>>`
            SELECT a as author, COUNT(*) as count
            FROM "Metadata", unnest(authors) as a
            WHERE array_length(authors, 1) > 0
            GROUP BY a ORDER BY count DESC, a ASC LIMIT ${limit}`;

      return result.map(r => ({ name: r.author, mangaCount: Number(r.count) }));
    }),

  /**
   * Get all unique publishers across the library.
   */
  getPublishers: publicProcedure
    .input(z.object({
      search: z.string().optional(),
      limit: z.number().min(1).max(200).default(50),
    }))
    .query(async ({ input }) => {
      const { search, limit } = input;

      // Phase 1: publishers TEXT[] — unnest then group/count each distinct entry.
      const result = search
        ? await prisma.$queryRaw<Array<{ publisher: string; count: bigint }>>`
            SELECT p AS publisher, COUNT(*) as count
            FROM "Metadata", unnest(publishers) AS p
            WHERE array_length(publishers, 1) > 0 AND p ILIKE ${'%' + search + '%'}
            GROUP BY p ORDER BY count DESC, p ASC LIMIT ${limit}`
        : await prisma.$queryRaw<Array<{ publisher: string; count: bigint }>>`
            SELECT p AS publisher, COUNT(*) as count
            FROM "Metadata", unnest(publishers) AS p
            WHERE array_length(publishers, 1) > 0
            GROUP BY p ORDER BY count DESC, p ASC LIMIT ${limit}`;

      return result.map(r => ({ name: r.publisher, mangaCount: Number(r.count) }));
    }),

  /**
   * Get all unique genres across the library.
   */
  getGenres: publicProcedure
    .query(async () => {
      const result = await prisma.$queryRaw<Array<{ genre: string; count: bigint }>>`
        SELECT g as genre, COUNT(*) as count
        FROM "Metadata", unnest(genres) as g
        WHERE array_length(genres, 1) > 0
        GROUP BY g ORDER BY count DESC, g ASC`;

      return result.map(r => ({ name: r.genre, mangaCount: Number(r.count) }));
    }),

  /**
   * Get related series and recommendations for a manga.
   * Reads from providerMetadata.mangaupdates stored during enrichment.
   */
  getRelatedAndRecommendations: publicProcedure
    .input(z.object({ mangaId: z.number() }))
    .query(async ({ input }) => {
      const manga = await prisma.manga.findUnique({
        where: { id: input.mangaId },
        select: { providerMetadata: true },
      });

      if (!manga?.providerMetadata) {
        return { relatedSeries: [], recommendations: [] };
      }

      const pm = manga.providerMetadata as Record<string, unknown>;
      const mu = pm['mangaupdates'] as Record<string, unknown> | undefined;
      if (!mu) {
        return { relatedSeries: [], recommendations: [] };
      }

      const relatedSeries = (mu['relatedSeries'] ?? []) as Array<{
        name: string; type: string; seriesId: number;
      }>;
      const recommendations = (mu['recommendations'] ?? []) as Array<{
        name: string; seriesId: number; weight: number;
      }>;

      // Cross-reference with local library to add "inLibrary" flag
      const allTitles = [
        ...relatedSeries.map(r => r.name),
        ...recommendations.map(r => r.name),
      ];

      const localManga = allTitles.length > 0
        ? await prisma.manga.findMany({
            where: { title: { in: allTitles, mode: 'insensitive' } },
            select: { id: true, title: true },
          })
        : [];

      const localTitleMap = new Map(localManga.map(m => [m.title.toLowerCase(), m.id]));

      return {
        relatedSeries: relatedSeries.map(r => ({
          ...r,
          localMangaId: localTitleMap.get(r.name.toLowerCase()) ?? null,
        })),
        recommendations: recommendations.map(r => ({
          ...r,
          localMangaId: localTitleMap.get(r.name.toLowerCase()) ?? null,
        })),
        animeMapping: (mu['animeMapping'] ?? null) as { start: string; end: string } | null,
        type: (mu['type'] ?? null) as string | null,
        bayesianRating: (mu['bayesianRating'] ?? null) as number | null,
        ratingVotes: (mu['ratingVotes'] ?? null) as number | null,
      };
    }),

  /**
   * Get personalized home sections (by author, by publisher) from library data.
   * Returns featured author + publisher with their manga for home screen rows.
   */
  getPersonalizedSections: publicProcedure
    .query(async () => {
      // Pick the author with most titles in library
      const topAuthor = await prisma.$queryRaw<Array<{ author: string; count: bigint }>>`
        SELECT a as author, COUNT(*) as count
        FROM "Metadata", unnest(authors) as a
        WHERE array_length(authors, 1) > 0
        GROUP BY a ORDER BY count DESC LIMIT 1`;

      // Pick the publisher with most titles
      const topPublisher = await prisma.$queryRaw<Array<{ publisher: string; count: bigint }>>`
        SELECT publisher, COUNT(*) as count FROM "Metadata"
        WHERE publisher IS NOT NULL AND publisher != ''
        GROUP BY publisher ORDER BY count DESC LIMIT 1`;

      const authorName = topAuthor[0]?.author ?? null;
      const publisherName = topPublisher[0]?.publisher ?? null;

      const [authorManga, publisherManga] = await Promise.all([
        authorName
          ? prisma.manga.findMany({
              where: { Metadata: { authors: { has: authorName } } },
              select: mangaCardSelect, take: 20, orderBy: { title: 'asc' },
            })
          : Promise.resolve([]),
        publisherName
          ? prisma.manga.findMany({
              // Phase 1: Metadata.publisher → Metadata.publishers[]. Match any element.
              where: { Metadata: { publishers: { has: publisherName } } },
              select: mangaCardSelect, take: 20, orderBy: { title: 'asc' },
            })
          : Promise.resolve([]),
      ]);

      return {
        author: authorName ? { name: authorName, manga: authorManga } : null,
        publisher: publisherName ? { name: publisherName, manga: publisherManga } : null,
      };
    }),
});
