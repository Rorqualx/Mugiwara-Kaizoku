/**
 * Annotation Router - Add From URL Procedure
 *
 * Uses FlareSolverr to fetch fully-rendered HTML from JS-heavy pages (Fandom, etc.)
 *
 * ARCHITECTURE: Deferred Tokenization
 * - HTML is stored at ingestion time (fast)
 * - Tokenization happens on-demand (annotation view) or at export time
 * - This allows configurable feature extraction and reduces ingestion latency
 */

import { Prisma } from '@prisma/client';
import { TRPCError } from '@trpc/server';

import { prisma } from '@/server/db';
import { adminProcedure } from '@/server/trpc/procedures';
import { logger } from '@/utils/logger';


import { detectSourceType, fetchHtmlWithFlareSolverr } from './helpers';
import { addFromUrlInputSchema } from './schemas';

/** Check if error is a Prisma unique constraint violation (P2002) */
function isPrismaUniqueConstraintError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return error.code === 'P2002';
  }
  return false;
}

export const addFromUrl = adminProcedure
  .input(addFromUrlInputSchema)
  .mutation(async ({ input }) => {
    // Detect source type from URL
    const sourceType = detectSourceType(input.url);
    if (!sourceType) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'URL must be from Fandom, Wikipedia, AniList, or ComicVine',
      });
    }

    // Fetch HTML from URL using FlareSolverr for JS-heavy pages
    logger.info('Fetching HTML from URL', { url: input.url, sourceType });

    const fetchResult = await fetchHtmlWithFlareSolverr(input.url, sourceType);
    const html = fetchResult.html;

    // DEFERRED TOKENIZATION: Store HTML only, tokenize on-demand or at export
    // This makes ingestion fast and allows configurable feature extraction later
    logger.info('Storing HTML snapshot (deferred tokenization)', {
      url: input.url,
      htmlLength: html.length,
    });

    // Save to database - handle race condition with atomic create
    // tokens/labels are empty arrays - will be populated on first view or export
    let page;
    try {
      page = await prisma.annotatedPage.create({
        data: {
          url: input.url,
          mangaTitle: input.mangaTitle ?? null,
          sourceType,
          htmlSnapshot: html,
          tokens: [], // Deferred: populated on-demand
          labels: [], // Deferred: populated on-demand
          entityCounts: {}, // Deferred: computed with tokens
          confidence: null, // Deferred: computed with bootstrap
          notes: input.notes ?? null,
          annotatorId: null,
          status: 'BOOTSTRAP',
        },
      });
    } catch (dbError) {
      // Handle race condition: another request created the page while we were processing
      if (isPrismaUniqueConstraintError(dbError)) {
        logger.warn('URL already exists (race condition)', { url: input.url });
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'A page with this URL already exists',
        });
      }
      logger.error('Database create failed', {
        error: dbError instanceof Error ? dbError.message : String(dbError),
        stack: dbError instanceof Error ? dbError.stack : undefined,
      });
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: `Database create failed: ${dbError instanceof Error ? dbError.message : String(dbError)}`,
      });
    }

    logger.info('Created annotated page from URL (deferred tokenization)', {
      pageId: page.id,
      url: input.url,
      sourceType,
      htmlLength: html.length,
    });

    return page;
  });
