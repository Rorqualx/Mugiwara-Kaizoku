/**
 * Library grid support procedures.
 *
 * The grid pages through manga.query with a `view`; these answer the questions
 * a page of rows cannot:
 * - libraryGridSummary: how many titles the view matches, and (for the
 *   alphabet bar) the position of the first title under a letter, so the grid
 *   can load up to it instead of loading the whole library.
 * - libraryGridFacets: the genres and tags in the library, for the filter panel.
 *
 * @module server/trpc/routers/manga/libraryGridOperations
 */
import { z } from 'zod';

import { protectedProcedure } from '@/server/trpc/procedures';
import { requireUserId } from '@/server/trpc/routers/_shared/library-access';
import { router } from '@/server/trpc/trpc';
import { findLetterIndex, type LibraryGridView } from '@/utils/library/grid-view';

import { libraryScopeWhere, loadLibraryFacets, loadOrderedGrid } from './library-grid/grid-query';
import { gridViewSchema } from './library-grid/grid-view-schema';

export const libraryGridRouter = router({
  libraryGridSummary: protectedProcedure
    .input(z.object({
      libraryId: z.number(),
      view: gridViewSchema,
      letter: z.string().regex(/^[A-Z#]$/).optional(),
    }))
    .query(async ({ input, ctx }): Promise<{ total: number; letterIndex: number | null }> => {
      const userId = requireUserId(ctx);
      const where = await libraryScopeWhere(ctx.prisma, userId, input.libraryId);
      const ordered = await loadOrderedGrid(ctx.prisma, where, userId, input.view as LibraryGridView);
      return {
        total: ordered.length,
        letterIndex: input.letter !== undefined ? findLetterIndex(ordered, input.letter) : null,
      };
    }),

  libraryGridFacets: protectedProcedure
    .input(z.object({ libraryId: z.number() }))
    .query(async ({ input, ctx }): Promise<{ genres: string[]; tags: string[] }> => {
      const userId = requireUserId(ctx);
      const where = await libraryScopeWhere(ctx.prisma, userId, input.libraryId);
      return loadLibraryFacets(ctx.prisma, where);
    }),
});
