/**
 * Browse Router
 *
 * Provides procedures for browsing manga by author, publisher, genre,
 * and accessing related series / recommendations from MangaUpdates data.
 *
 * @module server/trpc/routers/browse
 */

import { Prisma } from '@prisma/client';
import { z } from 'zod';

import { prisma } from '@/server/db';
import { logger } from '@/utils/logger';


import { protectedProcedure } from '../procedures';
import { router } from '../trpc';

import { assertMembership, membershipWhere, requireUserId } from './_shared/library-access';

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
// Phase 4 v2-B helpers — pulled out of the router body so the procedure
// stays within the 100-line limit (lint: max-lines-per-function).
// ============================================================================

type RecommendationRow = {
  externalSource: string;
  externalToId: string;
  toMangaId: number | null;
  targetTitle: string;
  targetMedium: string | null;
  targetFormat: string | null;
  targetCoverUrl: string | null;
  rating: number | null;
};

interface RecommendationBucket {
  externalSources: string[];
  externalToIds: Record<string, string>;
  toMangaId: number | null;
  targetTitle: string;
  targetMedium: string | null;
  targetFormat: string | null;
  targetCoverUrl: string | null;
  rating: number | null;
}

/**
 * Collapse AL + MAL recommendations onto the same target (when both bind
 * to the same local manga) so the carousel can render one card with both
 * source badges. External-only entries stay distinct per source — their
 * external ids namespace independently.
 */
function bucketRecommendations(recs: RecommendationRow[]): RecommendationBucket[] {
  const buckets = new Map<string, RecommendationBucket>();
  for (const rec of recs) {
    const key = rec.toMangaId !== null
      ? `local:${rec.toMangaId}`
      : `${rec.externalSource}:${rec.externalToId}`;
    const existing = buckets.get(key);
    if (existing) {
      if (!existing.externalSources.includes(rec.externalSource)) {
        existing.externalSources.push(rec.externalSource);
        existing.externalToIds[rec.externalSource] = rec.externalToId;
      }
      if ((rec.rating ?? -1) > (existing.rating ?? -1)) existing.rating = rec.rating;
      existing.targetCoverUrl ??= rec.targetCoverUrl;
    } else {
      buckets.set(key, {
        externalSources: [rec.externalSource],
        externalToIds: { [rec.externalSource]: rec.externalToId },
        toMangaId: rec.toMangaId,
        targetTitle: rec.targetTitle,
        targetMedium: rec.targetMedium,
        targetFormat: rec.targetFormat,
        targetCoverUrl: rec.targetCoverUrl,
        rating: rec.rating,
      });
    }
  }
  return [...buckets.values()];
}

type LocalMangaCard = Prisma.MangaGetPayload<{ select: typeof mangaCardSelect }>;

interface RelatedWorksResult {
  relations: Array<{
    externalSource: string;
    externalToId: string;
    targetTitle: string;
    targetMedium: string | null;
    relationType: string;
    localManga: LocalMangaCard | null;
  }>;
  recommendations: Array<RecommendationBucket & { localManga: LocalMangaCard | null }>;
}

async function fetchRelatedWorks(mangaId: number, userId: string): Promise<RelatedWorksResult> {
  const [relations, recommendations] = await Promise.all([
    prisma.mangaRelation.findMany({
      where: { fromMangaId: mangaId },
      orderBy: [{ relationType: 'asc' }, { id: 'asc' }],
      select: {
        externalSource: true, externalToId: true, toMangaId: true,
        targetTitle: true, targetMedium: true, relationType: true,
      },
    }),
    prisma.mangaRecommendation.findMany({
      where: { fromMangaId: mangaId },
      orderBy: [{ rating: 'desc' }, { id: 'asc' }],
      select: {
        externalSource: true, externalToId: true, toMangaId: true,
        targetTitle: true, targetMedium: true, targetFormat: true,
        targetCoverUrl: true, rating: true,
      },
    }),
  ]);

  const localIds = [
    ...relations.map(r => r.toMangaId),
    ...recommendations.map(r => r.toMangaId),
  ].filter((id): id is number => id !== null);
  const localRows = localIds.length > 0
    ? await prisma.manga.findMany({ where: { id: { in: localIds }, ...membershipWhere(userId) }, select: mangaCardSelect })
    : [];
  const byId = new Map(localRows.map(m => [m.id, m]));

  return {
    relations: relations.map(r => ({
      externalSource: r.externalSource,
      externalToId: r.externalToId,
      targetTitle: r.targetTitle,
      targetMedium: r.targetMedium,
      relationType: r.relationType,
      localManga: r.toMangaId !== null ? byId.get(r.toMangaId) ?? null : null,
    })),
    recommendations: bucketRecommendations(recommendations).map(b => ({
      ...b,
      localManga: b.toMangaId !== null ? byId.get(b.toMangaId) ?? null : null,
    })),
  };
}

// ============================================================================
// Browse Procedures
// ============================================================================

export const browseRouter = router({
  /**
   * Get all manga in library by a specific author.
   */
  getByAuthor: protectedProcedure
    .input(z.object({
      author: z.string().min(1),
      limit: z.number().min(1).max(50).default(20),
      cursor: z.number().optional(),
    }))
    .query(async ({ input, ctx }) => {
      const { author, limit, cursor } = input;
      const userId = requireUserId(ctx);
      log.info('Browse by author', { author, limit });

      const manga = await prisma.manga.findMany({
        where: {
          Metadata: { authors: { has: author } },
          ...membershipWhere(userId),
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
  getByArtist: protectedProcedure
    .input(z.object({
      artist: z.string().min(1),
      limit: z.number().min(1).max(50).default(20),
      cursor: z.number().optional(),
    }))
    .query(async ({ input, ctx }) => {
      const { artist, limit, cursor } = input;
      const userId = requireUserId(ctx);

      const manga = await prisma.manga.findMany({
        where: {
          Metadata: { artists: { has: artist } },
          ...membershipWhere(userId),
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
  getByPublisher: protectedProcedure
    .input(z.object({
      publisher: z.string().min(1),
      limit: z.number().min(1).max(50).default(20),
      cursor: z.number().optional(),
    }))
    .query(async ({ input, ctx }) => {
      const { publisher, limit, cursor } = input;
      const userId = requireUserId(ctx);

      const manga = await prisma.manga.findMany({
        where: {
          // Phase 1: Metadata.publisher → Metadata.publishers[]. Match any element.
          Metadata: { publishers: { has: publisher } },
          ...membershipWhere(userId),
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
  getByGenre: protectedProcedure
    .input(z.object({
      genre: z.string().min(1),
      limit: z.number().min(1).max(50).default(20),
      cursor: z.number().optional(),
    }))
    .query(async ({ input, ctx }) => {
      const { genre, limit, cursor } = input;
      const userId = requireUserId(ctx);

      const manga = await prisma.manga.findMany({
        where: {
          Metadata: { genres: { has: genre } },
          ...membershipWhere(userId),
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
  getAuthors: protectedProcedure
    .input(z.object({
      search: z.string().optional(),
      limit: z.number().min(1).max(200).default(50),
    }))
    .query(async ({ input, ctx }) => {
      const { search, limit } = input;
      const userId = requireUserId(ctx);

      // Joined through LibraryMembership so counts reflect only the caller's library.
      const result = search
        ? await prisma.$queryRaw<Array<{ author: string; count: bigint }>>`
            SELECT a as author, COUNT(*) as count
            FROM "Metadata" md
            JOIN "Manga" m ON m."metadataId" = md.id
            JOIN "LibraryMembership" lm ON lm."mangaId" = m.id
            , unnest(md.authors) as a
            WHERE lm."userId" = ${userId} AND array_length(md.authors, 1) > 0 AND a ILIKE ${'%' + search + '%'}
            GROUP BY a ORDER BY count DESC, a ASC LIMIT ${limit}`
        : await prisma.$queryRaw<Array<{ author: string; count: bigint }>>`
            SELECT a as author, COUNT(*) as count
            FROM "Metadata" md
            JOIN "Manga" m ON m."metadataId" = md.id
            JOIN "LibraryMembership" lm ON lm."mangaId" = m.id
            , unnest(md.authors) as a
            WHERE lm."userId" = ${userId} AND array_length(md.authors, 1) > 0
            GROUP BY a ORDER BY count DESC, a ASC LIMIT ${limit}`;

      return result.map(r => ({ name: r.author, mangaCount: Number(r.count) }));
    }),

  /**
   * Get all unique publishers across the library.
   */
  getPublishers: protectedProcedure
    .input(z.object({
      search: z.string().optional(),
      limit: z.number().min(1).max(200).default(50),
    }))
    .query(async ({ input, ctx }) => {
      const { search, limit } = input;
      const userId = requireUserId(ctx);

      // Phase 1: publishers TEXT[] — unnest then group/count each distinct entry.
      // Joined through LibraryMembership so counts reflect only the caller's library.
      const result = search
        ? await prisma.$queryRaw<Array<{ publisher: string; count: bigint }>>`
            SELECT p AS publisher, COUNT(*) as count
            FROM "Metadata" md
            JOIN "Manga" m ON m."metadataId" = md.id
            JOIN "LibraryMembership" lm ON lm."mangaId" = m.id
            , unnest(md.publishers) AS p
            WHERE lm."userId" = ${userId} AND array_length(md.publishers, 1) > 0 AND p ILIKE ${'%' + search + '%'}
            GROUP BY p ORDER BY count DESC, p ASC LIMIT ${limit}`
        : await prisma.$queryRaw<Array<{ publisher: string; count: bigint }>>`
            SELECT p AS publisher, COUNT(*) as count
            FROM "Metadata" md
            JOIN "Manga" m ON m."metadataId" = md.id
            JOIN "LibraryMembership" lm ON lm."mangaId" = m.id
            , unnest(md.publishers) AS p
            WHERE lm."userId" = ${userId} AND array_length(md.publishers, 1) > 0
            GROUP BY p ORDER BY count DESC, p ASC LIMIT ${limit}`;

      return result.map(r => ({ name: r.publisher, mangaCount: Number(r.count) }));
    }),

  /**
   * Get all unique genres across the library.
   */
  getGenres: protectedProcedure
    .query(async ({ ctx }) => {
      const userId = requireUserId(ctx);
      const result = await prisma.$queryRaw<Array<{ genre: string; count: bigint }>>`
        SELECT g as genre, COUNT(*) as count
        FROM "Metadata" md
        JOIN "Manga" m ON m."metadataId" = md.id
        JOIN "LibraryMembership" lm ON lm."mangaId" = m.id
        , unnest(md.genres) as g
        WHERE lm."userId" = ${userId} AND array_length(md.genres, 1) > 0
        GROUP BY g ORDER BY count DESC, g ASC`;

      return result.map(r => ({ name: r.genre, mangaCount: Number(r.count) }));
    }),

  /**
   * Phase 4 v2-B: rich related-works carousel feed.
   *
   * Pulls from the structural `MangaRelation` table (sequel/prequel/spin-off)
   * and the taste-similarity `MangaRecommendation` table (AL + MAL pass)
   * — both populated by the modern enrichment pipeline — and joins to local
   * Manga/Metadata for cover art + status. Returns a single feed-friendly
   * shape so the carousel can render in-library and external-only targets
   * uniformly.
   *
   * Distinct from `getRelatedAndRecommendations` which reads the legacy
   * `providerMetadata.mangaupdates` JSON blob — kept for the MU text card.
   */
  getRelatedWorks: protectedProcedure
    .input(z.object({ mangaId: z.number() }))
    .query(async ({ input, ctx }) => {
      const userId = requireUserId(ctx);
      await assertMembership(prisma, userId, input.mangaId);
      return fetchRelatedWorks(input.mangaId, userId);
    }),

  /**
   * Get related series and recommendations for a manga.
   * Reads from providerMetadata.mangaupdates stored during enrichment.
   */
  getRelatedAndRecommendations: protectedProcedure
    .input(z.object({ mangaId: z.number() }))
    .query(async ({ input, ctx }) => {
      const userId = requireUserId(ctx);
      await assertMembership(prisma, userId, input.mangaId);
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
            where: { title: { in: allTitles, mode: 'insensitive' }, ...membershipWhere(userId) },
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
  getPersonalizedSections: protectedProcedure
    .query(async ({ ctx }) => {
      const userId = requireUserId(ctx);
      const memberOnly = membershipWhere(userId);

      // Pick the author with most titles in the caller's library
      const topAuthor = await prisma.$queryRaw<Array<{ author: string; count: bigint }>>`
        SELECT a as author, COUNT(*) as count
        FROM "Metadata" md
        JOIN "Manga" m ON m."metadataId" = md.id
        JOIN "LibraryMembership" lm ON lm."mangaId" = m.id
        , unnest(md.authors) as a
        WHERE lm."userId" = ${userId} AND array_length(md.authors, 1) > 0
        GROUP BY a ORDER BY count DESC LIMIT 1`;

      // Pick the publisher with most titles in the caller's library
      const topPublisher = await prisma.$queryRaw<Array<{ publisher: string; count: bigint }>>`
        SELECT md.publisher, COUNT(*) as count
        FROM "Metadata" md
        JOIN "Manga" m ON m."metadataId" = md.id
        JOIN "LibraryMembership" lm ON lm."mangaId" = m.id
        WHERE lm."userId" = ${userId} AND md.publisher IS NOT NULL AND md.publisher != ''
        GROUP BY md.publisher ORDER BY count DESC LIMIT 1`;

      const authorName = topAuthor[0]?.author ?? null;
      const publisherName = topPublisher[0]?.publisher ?? null;

      const [authorManga, publisherManga] = await Promise.all([
        authorName
          ? prisma.manga.findMany({
              where: { Metadata: { authors: { has: authorName } }, ...memberOnly },
              select: mangaCardSelect, take: 20, orderBy: { title: 'asc' },
            })
          : Promise.resolve([]),
        publisherName
          ? prisma.manga.findMany({
              // Phase 1: Metadata.publisher → Metadata.publishers[]. Match any element.
              where: { Metadata: { publishers: { has: publisherName } }, ...memberOnly },
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
