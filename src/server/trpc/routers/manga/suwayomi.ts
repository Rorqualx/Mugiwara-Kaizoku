/**
 * Per-manga Suwayomi plugin endpoints.
 *
 * Powers the "Suwayomi Plugin" panel on the manga index page:
 *   - read/patch the per-manga plugin config (Manga.suwayomiPluginConfig)
 *   - run the matcher to resolve a Suwayomi source/mangaId for the title
 *   - sync chapter ids from Suwayomi → existing Chapter rows
 *   - dry-run a download for a single chapter (diagnostic button)
 */
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { prisma } from '@/server/db';
import { downloadSuwayomiChapter } from '@/server/services/native-download/downloaders/suwayomi-downloader';
import { syncSuwayomiChapters } from '@/server/services/suwayomi/chapter-sync';
import {
  matchMangaOnSuwayomi,
  readSuwayomiPluginConfig,
  type SuwayomiPluginConfig,
} from '@/server/services/suwayomi/manga-matcher';
import { protectedProcedure } from '@/server/trpc/procedures';
import { router } from '@/server/trpc/trpc';

import type { Prisma } from '@prisma/client';

const SuwayomiPluginConfigPatchSchema = z.object({
  enabled: z.boolean().optional(),
  sourceId: z.string().optional(),
  mangaId: z.number().optional(),
  slug: z.string().optional(),
  matchConfidence: z.number().optional(),
  lastMatchedAt: z.string().optional(),
  lastSyncedAt: z.string().optional(),
  totalChapters: z.number().optional(),
  unmatchedChapters: z.number().optional(),
});

export const suwayomiMangaRouter = router({
  /** Read the per-manga plugin config. Returns a default `{enabled:false}` if unset. */
  suwayomiGetPluginConfig: protectedProcedure
    .input(z.object({ mangaId: z.number() }))
    .query(async ({ input }): Promise<SuwayomiPluginConfig> => {
      const manga = await prisma.manga.findUnique({
        where: { id: input.mangaId },
        select: { suwayomiPluginConfig: true },
      });
      if (!manga) {
        throw new TRPCError({ code: 'NOT_FOUND', message: `Manga ${input.mangaId} not found` });
      }
      return readSuwayomiPluginConfig(manga.suwayomiPluginConfig);
    }),

  /** Patch the per-manga plugin config (merge-on-write). */
  suwayomiUpdatePluginConfig: protectedProcedure
    .input(z.object({
      mangaId: z.number(),
      patch: SuwayomiPluginConfigPatchSchema,
    }))
    .mutation(async ({ input }): Promise<SuwayomiPluginConfig> => {
      const manga = await prisma.manga.findUnique({
        where: { id: input.mangaId },
        select: { suwayomiPluginConfig: true },
      });
      if (!manga) {
        throw new TRPCError({ code: 'NOT_FOUND', message: `Manga ${input.mangaId} not found` });
      }
      const current = readSuwayomiPluginConfig(manga.suwayomiPluginConfig);
      // Strip undefined values from the patch so spreading doesn't introduce
      // `enabled: undefined` (incompatible with exactOptionalPropertyTypes).
      const cleanedPatch = Object.fromEntries(
        Object.entries(input.patch).filter(([, v]) => v !== undefined),
      ) as Partial<SuwayomiPluginConfig>;
      const next: SuwayomiPluginConfig = { ...current, ...cleanedPatch };
      await prisma.manga.update({
        where: { id: input.mangaId },
        data: { suwayomiPluginConfig: next as unknown as Prisma.InputJsonValue },
      });
      return next;
    }),

  /** Run the matcher for one manga + source. Persists on confidence ≥ threshold. */
  suwayomiMatch: protectedProcedure
    .input(z.object({
      mangaId: z.number(),
      sourceId: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const sourceId = await resolveSourceId(input.mangaId, input.sourceId);
      return matchMangaOnSuwayomi({ mangaId: input.mangaId, sourceId, persist: true });
    }),

  /** Pull the Suwayomi chapter list and populate `Chapter.suwayomiChapterId`. */
  suwayomiSyncChapters: protectedProcedure
    .input(z.object({ mangaId: z.number() }))
    .mutation(async ({ input }) => syncSuwayomiChapters(input.mangaId)),

  /** Diagnostic: download one chapter via the Suwayomi path. */
  suwayomiTestDownload: protectedProcedure
    .input(z.object({
      chapterId: z.number(),
      destinationPath: z.string(),
    }))
    .mutation(async ({ input }) => {
      const chapter = await prisma.chapter.findUnique({
        where: { id: input.chapterId },
        select: { suwayomiChapterId: true, chapterNumber: true, title: true, language: true },
      });
      if (!chapter?.suwayomiChapterId) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Chapter has no suwayomiChapterId — run sync first.',
        });
      }
      return downloadSuwayomiChapter({
        suwayomiChapterId: parseInt(chapter.suwayomiChapterId, 10),
        outputPath: input.destinationPath,
        metadata: {
          title: chapter.title,
          number: chapter.chapterNumber?.toString(),
          language: chapter.language ?? undefined,
        },
      });
    }),
});

/** Resolve which sourceId to pass to the matcher: explicit override > persisted. */
async function resolveSourceId(mangaId: number, override?: string): Promise<string> {
  if (override) return override;
  const manga = await prisma.manga.findUnique({
    where: { id: mangaId },
    select: { suwayomiPluginConfig: true },
  });
  const config = readSuwayomiPluginConfig(manga?.suwayomiPluginConfig);
  if (!config.sourceId) {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: 'No Suwayomi sourceId configured. Pass sourceId or set it in the panel first.',
    });
  }
  return config.sourceId;
}
