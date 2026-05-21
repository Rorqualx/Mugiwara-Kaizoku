/**
 * ComicVine Comicbook Tracking Router
 *
 * Endpoints for adding Western comicbooks to the library using ComicVine
 * as the data source. Comics live in the existing `Manga` table with
 * `mediaType=COMICBOOK`. ComicVine "Volume" (CV id `4050-X`) maps to a
 * Manga row; ComicVine "Issue" (CV id `4000-X`) maps to a Chapter row,
 * populated lazily on first detail-page open.
 *
 * NOTE the terminology collision: ComicVine's "Volume" is what this app
 * calls a "series". The app's own `Volume` table is for manga collected
 * editions and is unrelated.
 */

import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { comicvineService } from '@/server/services/comicvine/service';
import type { ComicVineIssue, ComicVineVolume } from '@/server/services/comicvine/service';
import { createMangaSafe } from '@/server/services/library/manga-create-guard';
import { protectedProcedure, publicProcedure } from '@/server/trpc/procedures';
import { router } from '@/server/trpc/trpc';
import { getConfigBoolean } from '@/server/utils/configReader';
import { logger } from '@/utils/logger';

import type { PrismaClient } from '@prisma/client';

const log = logger.child('ComicVineRouter');

// ============================================================================
// Schemas
// ============================================================================

const searchSeriesInput = z.object({
  query: z.string().min(1, 'Query is required'),
  limit: z.number().int().min(1).max(50).default(20),
});

const addSeriesInput = z.object({
  comicvineVolumeId: z.number().int().positive(),
  libraryId: z.number().int().positive(),
});

const populateIssuesInput = z.object({
  mangaId: z.number().int().positive(),
});

export interface ComicSeriesSearchHit {
  id: number;
  name: string;
  publisher: string | null;
  year: number | null;
  issueCount: number | null;
  coverUrl: string | null;
  description: string | null;
}

// ============================================================================
// Helpers
// ============================================================================

function parseIssueNumber(raw: string | undefined | null): number | null {
  if (!raw) return null;
  const match = /^-?\d+(\.\d+)?/.exec(raw.trim());
  if (!match) return null;
  const n = Number(match[0]);
  return Number.isFinite(n) ? n : null;
}

function parseIssueDate(coverDate: string | null | undefined, storeDate: string | null | undefined): Date | null {
  const raw = coverDate ?? storeDate;
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function buildSeriesHit(vol: ComicVineVolume): ComicSeriesSearchHit {
  return {
    id: vol.id,
    name: vol.name ?? `Volume ${vol.id}`,
    publisher: vol.publisher?.name ?? null,
    year: typeof vol.start_year === 'number' ? vol.start_year : null,
    issueCount: vol.count_of_issues ?? null,
    coverUrl: vol.image?.medium_url ?? vol.image?.thumb_url ?? null,
    description: vol.deck ?? null,
  };
}

interface ChapterInsertData {
  mangaId: number;
  fileName: string;
  index: number;
  chapterNumber: number;
  title: string;
  size: number;
  monitored: boolean;
  coverImage: string | null;
  description: string | null;
  releaseDate: Date | null;
  updatedAt: Date;
}

function buildChapterRowFromIssue(mangaId: number, issue: ComicVineIssue, ordinal: number): ChapterInsertData {
  const chapterNumber = parseIssueNumber(issue.issue_number) ?? ordinal;
  const title = issue.name?.trim() || `Issue #${issue.issue_number ?? chapterNumber}`;
  return {
    mangaId,
    fileName: `cv-issue-${issue.id}.placeholder`,
    index: ordinal,
    chapterNumber,
    title: title.slice(0, 255),
    size: 0,
    monitored: false,
    coverImage: issue.image?.medium_url ?? issue.image?.thumb_url ?? null,
    description: issue.description?.slice(0, 5000) ?? null,
    releaseDate: parseIssueDate(issue.cover_date ?? null, issue.store_date ?? null),
    updatedAt: new Date(),
  };
}

function sortIssuesByNumber(issues: ComicVineIssue[]): ComicVineIssue[] {
  return [...issues].sort((a, b) => {
    const aNum = parseIssueNumber(a.issue_number) ?? 0;
    const bNum = parseIssueNumber(b.issue_number) ?? 0;
    return aNum - bNum;
  });
}

async function persistIssuesAsChapters(prisma: PrismaClient, mangaId: number, issues: ComicVineIssue[]): Promise<number> {
  const sorted = sortIssuesByNumber(issues);
  if (sorted.length === 0) return 0;
  const rows = sorted.map((issue, idx) => buildChapterRowFromIssue(mangaId, issue, idx + 1));
  const result = await prisma.chapter.createMany({ data: rows, skipDuplicates: true });
  return result.count;
}

async function ensureComicVineConfigured(): Promise<void> {
  const initialized = await comicvineService.initialize();
  if (!initialized) {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: 'ComicVine is not configured. Set the API key in Settings → Metadata first.',
    });
  }
}

async function ensureComicbookTrackingEnabled(): Promise<void> {
  const enabled = await getConfigBoolean('comicvine.comicbookTrackingEnabled', false);
  if (!enabled) {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: 'Comicbook tracking is disabled. Enable it in Settings → Metadata → ComicVine.',
    });
  }
}

// ============================================================================
// Router
// ============================================================================

export const comicvineRouter = router({
  /**
   * Search ComicVine for a series by name. Returns a slim shape suitable
   * for the add-comic UI grid.
   */
  searchSeries: publicProcedure
    .input(searchSeriesInput)
    .query(async ({ input }): Promise<ComicSeriesSearchHit[]> => {
      await ensureComicbookTrackingEnabled();
      await ensureComicVineConfigured();
      const volumes = await comicvineService.searchBasicVolumes(input.query, 0, input.limit);
      return volumes.map((v) => buildSeriesHit(v));
    }),

  /**
   * Persist a ComicVine series as a new Manga row with `mediaType=COMICBOOK`.
   * Issues are NOT fetched here — that happens lazily via `populateIssues`.
   */
  addSeries: protectedProcedure
    .input(addSeriesInput)
    .mutation(async ({ input, ctx }) => {
      await ensureComicbookTrackingEnabled();
      await ensureComicVineConfigured();

      const library = await ctx.prisma.library.findUnique({ where: { id: input.libraryId } });
      if (!library) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Library not found' });
      }

      const sourceId = String(input.comicvineVolumeId);
      const existing = await ctx.prisma.manga.findFirst({
        where: { source: 'comicvine', sourceId },
        select: { id: true, title: true },
      });
      if (existing) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: `Series "${existing.title}" is already in your library.`,
        });
      }

      const detail = await comicvineService.getDetailedVolumeInfo(input.comicvineVolumeId);
      if (!detail) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Series not found on ComicVine' });
      }

      const title = detail.name ?? `ComicVine #${detail.id}`;
      const cover = detail.image?.medium_url ?? detail.image?.thumb_url ?? null;
      const description = detail.description ?? detail.deck ?? null;
      const publisher = detail.publisher?.name ?? null;
      const issueCount = detail.count_of_issues ?? null;

      const metadata = await ctx.prisma.metadata.create({
        data: {
          cover: cover ?? '/cover-not-found.jpg',
          coverUrl: cover,
          summary: description,
          source: 'comicvine',
          sourceId,
          chapters: issueCount,
          publisher,
        },
      });

      const manga = await createMangaSafe(ctx.prisma, {
        data: {
          title,
          source: 'comicvine',
          sourceId,
          searchProvider: 'comicvine',
          mediaType: 'COMICBOOK',
          libraryId: input.libraryId,
          metadataId: metadata.id,
          summary: description,
          updatedAt: new Date(),
          libraryPath: `${library.path.replace(/\/+$/, '')}/${title}`,
        },
      });

      log.info('Added ComicVine series', { mangaId: manga.id, cvId: input.comicvineVolumeId, title });
      return { id: manga.id, title: manga.title };
    }),

  /**
   * Lazily fetch all issues for a comicbook series and persist as Chapter
   * rows. Idempotent — early-returns if chapters already exist.
   */
  populateIssues: protectedProcedure
    .input(populateIssuesInput)
    .mutation(async ({ input, ctx }) => {
      const manga = await ctx.prisma.manga.findUnique({
        where: { id: input.mangaId },
        select: { id: true, title: true, source: true, sourceId: true, mediaType: true },
      });
      if (!manga) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Manga not found' });
      }
      if (manga.mediaType !== 'COMICBOOK' || manga.source !== 'comicvine' || !manga.sourceId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Not a ComicVine comicbook series' });
      }

      const existing = await ctx.prisma.chapter.count({ where: { mangaId: manga.id } });
      if (existing > 0) {
        return { populated: 0, skipped: existing, status: 'already_populated' as const };
      }

      await ensureComicVineConfigured();

      const cvId = Number(manga.sourceId);
      const issues = await comicvineService.getAllVolumeIssues(cvId);
      log.info('Fetched issues for series', { mangaId: manga.id, cvId, count: issues.length });

      const populated = await persistIssuesAsChapters(ctx.prisma, manga.id, issues);
      return { populated, skipped: 0, status: 'populated' as const };
    }),
});
