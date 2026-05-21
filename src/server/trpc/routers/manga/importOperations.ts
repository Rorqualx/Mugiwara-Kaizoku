/**
 * Import Operations Router
 *
 * Handles manual import operations for downloaded manga files:
 * - Manual import of downloaded files to chapters
 * - Library folder scanning for untracked files
 */

import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { FileImporter } from '@/server/services/download/fileImporter';
import { scanMangaLibraryFolder, type LibraryScanResult } from '@/server/services/packImport/library-scanner';
import { realtimeEmitter } from '@/server/services/realtime/RealtimeEventEmitter';
import { protectedProcedure } from '@/server/trpc/procedures';
import { router } from '@/server/trpc/trpc';
import { isSuccess, isError } from '@/utils/async-result';

import { invalidateMangaCache } from './crud-operations/get-manga-cache';

// ===================================
// IMPORT OPERATIONS ROUTER
// ===================================

export const importRouter = router({
  /**
   * Manual import of downloaded files to chapters
   *
   * Allows users to manually map downloaded files to chapters when automatic
   * import fails or files are in unexpected locations.
   *
   * @param input Object containing jobId, mangaId, and file mappings
   * @returns Import results with success/failure details per file
   */
  manualImport: protectedProcedure
    .input(z.object({
      jobId: z.string(),
      mangaId: z.number(),
      files: z.array(z.object({
        sourcePath: z.string(),
        chapterId: z.number(),
        chapterNumber: z.number().optional(),
        fileName: z.string()
      }))
    }))
    .mutation(async ({ input, ctx }) => {
      const fileImporter = new FileImporter(ctx.prisma);

      const result = await fileImporter.manualImport(input.mangaId, input.files);

      if (isError(result)) {
        throw new Error(`Manual import failed: ${result.error.message}`);
      }

      if (!isSuccess(result)) {
        throw new Error('Manual import returned no result');
      }

      // Emit WebSocket event for manual import completion
      void realtimeEmitter.emitSystemEvent({
        eventType: 'import:manual:completed',
        source: 'importOperations',
        message: `Manual import completed for ${input.files.length} files`,
        data: {
          jobId: input.jobId,
          mangaId: input.mangaId,
          fileCount: input.files.length,
          ...result.data
        }
      });

      return {
        jobId: input.jobId,
        mangaId: input.mangaId,
        ...result.data
      };
    }),

  /**
   * Scan a manga's library folder for untracked files
   *
   * Discovers .cbz/.cbr/.pdf files on disk that aren't registered in the database,
   * then creates COMPLETED chapter records or links them to existing chapters.
   */
  scanLibraryFolder: protectedProcedure
    .input(z.object({ mangaId: z.number() }))
    .mutation(async ({ input, ctx }): Promise<LibraryScanResult> => {
      const result = await scanMangaLibraryFolder(ctx.prisma, input.mangaId);

      if (isError(result)) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: result.error.message });
      }

      if (!isSuccess(result)) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Scan returned no result' });
      }

      // Invalidate server-side manga cache so the next detail query returns fresh data
      await invalidateMangaCache(input.mangaId);

      void realtimeEmitter.emitSystemEvent({
        eventType: 'import:library-scan:completed',
        source: 'importOperations',
        message: `Library scan found ${result.data.newChaptersCreated} new files`,
        data: { mangaId: input.mangaId, ...result.data },
      });

      return result.data;
    }),
});
