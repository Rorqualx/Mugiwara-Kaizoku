/**
 * `getMissing` query — paginated list of monitored chapters not yet
 * downloaded, one row per chapter, with manga + cover metadata for table
 * display.
 *
 * Reshaped to query `Chapter` directly instead of `Manga` with a nested
 * `Chapter` include — single predicate, single round-trip, server-side
 * pagination.
 */

import { type Prisma } from '@prisma/client';
import { TRPCError } from '@trpc/server';

import { prisma } from '@/server/db';
import { EventSource } from '@/server/services/events/eventTypes';
import { protectedProcedure } from '@/server/trpc/procedures';
import { type MissingItem, type MissingItemsResponse } from '@/types/search.types';
import {
  createSuccessResult,
  createErrorResult,
  isSuccess,
  isError,
  type AsyncResult
} from '@/utils/async-result';
import { toStringId } from '@/utils/id-converters';
import { logger } from '@/utils/logger';
import { logError } from '@/utils/system-event-logger';

import { isAdmin, membershipWhere, requireUserId } from '../_shared/library-access';

import { missingSearchSchema } from './schemas';

const MISSING_CHAPTER_WHERE = {
  monitored: true,
  downloadStatus: { not: 'COMPLETED' as const }
} satisfies Prisma.ChapterWhereInput;

/**
 * Missing-chapter predicate scoped to the caller's library. Non-admins only see
 * monitored/undownloaded chapters for titles in THEIR library (shared catalog
 * is per-user via LibraryMembership); admins see the whole instance.
 */
function scopedMissingWhere(ctx: unknown): Prisma.ChapterWhereInput {
  if (isAdmin(ctx)) return MISSING_CHAPTER_WHERE;
  return { ...MISSING_CHAPTER_WHERE, Manga: membershipWhere(requireUserId(ctx)) };
}

const MISSING_CHAPTER_INCLUDE = {
  Manga: { include: { Metadata: true } }
} satisfies Prisma.ChapterInclude;

type ChapterWithManga = Prisma.ChapterGetPayload<{ include: typeof MISSING_CHAPTER_INCLUDE }>;

function buildMissingItem(chapter: ChapterWithManga): MissingItem {
  const manga = chapter.Manga;
  return {
    id: toStringId(chapter.id),
    chapterId: toStringId(chapter.id),
    mangaId: toStringId(manga.id),
    mangaTitle: manga.title,
    chapterNumber: chapter.chapterNumber?.toString() ?? chapter.index.toString(),
    chapterTitle: chapter.title,
    volumeNumber: chapter.volume,
    releaseDate: chapter.releaseDate,
    pageCount: chapter.pageCount,
    downloadStatus: chapter.downloadStatus,
    monitored: chapter.monitored,
    missingAt: chapter.createdAt,
    coverImage: manga.Metadata?.coverLarge ?? manga.Metadata?.coverMedium ?? manga.Metadata?.cover,
    language: chapter.language
  } as MissingItem;
}

interface PageInput {
  page: number;
  pageSize: number;
}

async function fetchMissingPage(
  { page, pageSize }: PageInput,
  where: Prisma.ChapterWhereInput
): Promise<AsyncResult<MissingItemsResponse, Error>> {
  try {
    const [total, chapters, mangaCount] = await Promise.all([
      prisma.chapter.count({ where }),
      prisma.chapter.findMany({
        where,
        include: MISSING_CHAPTER_INCLUDE,
        orderBy: [
          { mangaId: 'asc' },
          { chapterNumber: 'asc' },
          { index: 'asc' }
        ],
        skip: (page - 1) * pageSize,
        take: pageSize
      }),
      prisma.chapter.findMany({
        where,
        select: { mangaId: true },
        distinct: ['mangaId']
      })
    ]);

    const items = chapters.map(buildMissingItem);
    logger.info(`[getMissing] page=${page} pageSize=${pageSize} returned ${items.length}/${total} chapters across ${mangaCount.length} manga`);

    return createSuccessResult({
      items,
      total,
      page,
      pageSize,
      totalMangaAffected: mangaCount.length,
      totalChaptersMissing: total
    } as MissingItemsResponse);
  }
  catch (error: unknown) {
    void logError('Failed to get missing items', EventSource.SYSTEM, error, {
      relatedEntityType: 'wanted',
      details: { error: error instanceof Error ? error.message : String(error) }
    });
    return createErrorResult(error instanceof Error ? error : new Error(`Failed to get missing items: ${String(error)}`));
  }
}

export const getMissing = protectedProcedure.input(missingSearchSchema).query(async ({ input, ctx }) => {
  const result = await fetchMissingPage(input, scopedMissingWhere(ctx));
  if (isSuccess(result)) return result.data;
  if (isError(result)) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: result.error instanceof Error ? result.error.message : String(result.error)
    });
  }
  throw new TRPCError({
    code: 'INTERNAL_SERVER_ERROR',
    message: 'Unknown error getting missing items'
  });
});

/**
 * Distinct manga IDs that have any monitored, undownloaded chapter.
 * Used by "Search all monitored" callers that don't need chapter detail.
 */
export const getMissingMangaIds = protectedProcedure.query(async ({ ctx }) => {
  const rows = await prisma.chapter.findMany({
    where: scopedMissingWhere(ctx),
    select: { mangaId: true },
    distinct: ['mangaId']
  });
  return { mangaIds: rows.map(r => r.mangaId) };
});
