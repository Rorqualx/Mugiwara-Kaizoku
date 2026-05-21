/**
 * Agent Review Procedures
 *
 * tRPC procedures for the agent-based label review workflow.
 */

import { Prisma, AnnotationStatus } from '@prisma/client';
import { z } from 'zod';

import { prisma } from '@/server/db';
import {
  processAgentReviewBatch,
  getReviewQueueStats,
  DEFAULT_BATCH_OPTIONS,
} from '@/server/ml/training/agent-review';
import { settingsProcedure } from '@/server/trpc/procedures';
import { logger } from '@/utils/logger';


import type { AnnotationSourceType } from '@prisma/client';

// ============================================================================
// Input Schemas
// ============================================================================

const agentReviewInputSchema = z.object({
  pageIds: z.array(z.string()).optional(),
  sourceType: z.enum(['FANDOM', 'WIKIPEDIA', 'ANILIST', 'COMICVINE']).optional(),
  batchSize: z.number().min(1).max(100).default(50),
  dryRun: z.boolean().default(false),
});

const getAgentCorrectedPagesInputSchema = z.object({
  cursor: z.string().optional(),
  limit: z.number().min(1).max(100).default(20),
  onlyWithCorrections: z.boolean().default(true),
});

// ============================================================================
// Procedures
// ============================================================================

/** Start agent review for selected pages or batch */
export const startAgentReview = settingsProcedure
  .input(agentReviewInputSchema)
  .mutation(async ({ input }) => {
    logger.info('Starting agent review', {
      pageIds: input.pageIds?.length ?? 'all',
      sourceType: input.sourceType,
      batchSize: input.batchSize,
      dryRun: input.dryRun,
    });

    const options: Parameters<typeof processAgentReviewBatch>[0] = {
      batchSize: input.batchSize,
      dryRun: input.dryRun,
    };

    if (input.sourceType) {
      options.sourceTypeFilter = input.sourceType as AnnotationSourceType;
    }

    const result = await processAgentReviewBatch(options);

    logger.info('Agent review completed', {
      totalProcessed: result.totalProcessed,
      approved: result.approved,
      corrected: result.corrected,
      flagged: result.flagged,
      failed: result.failed,
    });

    return result;
  });

/** Get agent review queue statistics */
export const getAgentReviewStats = settingsProcedure.query(async () => {
  const stats = await getReviewQueueStats();

  return {
    ...stats,
    defaultBatchSize: DEFAULT_BATCH_OPTIONS.batchSize,
    autoApplyThreshold: DEFAULT_BATCH_OPTIONS.autoApplyThreshold,
  };
});

/** Get pages that were corrected by agent for human verification */
export const getAgentCorrectedPages = settingsProcedure
  .input(getAgentCorrectedPagesInputSchema)
  .query(async ({ input }) => {
    const { limit, cursor } = input;

    const pages = await prisma.annotatedPage.findMany({
      where: { status: AnnotationStatus.AGENT_REVIEWED },
      take: limit + 1,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        url: true,
        mangaTitle: true,
        sourceType: true,
        status: true,
        confidence: true,
        updatedAt: true,
        notes: true,
      },
    });

    let nextCursor: string | null = null;
    if (pages.length > limit) {
      const lastItem = pages.pop();
      nextCursor = lastItem?.id ?? null;
    }

    return { pages, nextCursor };
  });

/** Accept agent corrections for a page */
export const acceptAgentCorrections = settingsProcedure
  .input(z.object({ pageId: z.string() }))
  .mutation(async ({ input }) => {
    const updated = await prisma.annotatedPage.update({
      where: { id: input.pageId },
      data: {
        status: 'REVIEWED',
        reviewedAt: new Date(),
      },
    });

    logger.info('Accepted agent corrections', { pageId: input.pageId });

    return updated;
  });

/** Revert agent corrections for a page */
export const revertAgentCorrections = settingsProcedure
  .input(z.object({ pageId: z.string() }))
  .mutation(async ({ input }) => {
    const page = await prisma.annotatedPage.findUnique({
      where: { id: input.pageId },
      select: { previousVersion: true },
    });

    if (!page?.previousVersion) {
      return { success: false, message: 'No previous version available' };
    }

    const prevVersion = page.previousVersion as { labels?: unknown };

    const updated = await prisma.annotatedPage.update({
      where: { id: input.pageId },
      data: {
        status: 'BOOTSTRAP',
        labels: prevVersion.labels as Prisma.InputJsonValue,
        notes: null,
      },
    });

    logger.info('Reverted agent corrections', { pageId: input.pageId });

    return { success: true, page: updated };
  });
