/**
 * Annotation Router - Quality Procedures
 *
 * tRPC procedures for annotation quality metrics and IAA calculations.
 *
 * @module annotation/quality-procedures
 */

import { z } from 'zod';

import { prisma } from '@/server/db';
import { generateIAAReport } from '@/server/ml/quality';
import { adminProcedure } from '@/server/trpc/procedures';
import { logger } from '@/utils/logger';

// ============================================================================
// Schemas
// ============================================================================

const getQualityReportInputSchema = z.object({
  pageIds: z.array(z.string()).max(100).optional(),
  status: z.enum(['REVIEWED', 'GOLD']).optional(),
});

const compareAnnotationsInputSchema = z.object({
  pageId: z.string(),
  annotations: z.array(z.object({
    annotatorId: z.string(),
    labels: z.array(z.string()),
  })).min(2),
});

// ============================================================================
// Procedures
// ============================================================================

/** Get quality report for a set of pages */
export const getQualityReport = adminProcedure
  .input(getQualityReportInputSchema)
  .query(async ({ input }) => {
    const where: Record<string, unknown> = {};

    if (input.pageIds) {
      where['id'] = { in: input.pageIds };
    }

    if (input.status) {
      where['status'] = input.status;
    } else {
      where['status'] = { in: ['REVIEWED', 'GOLD'] };
    }

    const pages = await prisma.annotatedPage.findMany({
      where,
      select: {
        id: true,
        labels: true,
        status: true,
        confidence: true,
        entityCounts: true,
      },
    });

    const labelArrays = pages
      .map((p) => p.labels)
      .filter((labels): labels is string[] => Array.isArray(labels));

    if (labelArrays.length < 2) {
      return {
        pageCount: pages.length,
        hasEnoughData: false,
        report: null,
        averageConfidence: calculateAverageConfidence(pages),
      };
    }

    const report = generateIAAReport(labelArrays);

    logger.info('Generated quality report', {
      pageCount: pages.length,
      alpha: report.overall.alpha,
      qualityLevel: report.overall.qualityLevel,
    });

    return {
      pageCount: pages.length,
      hasEnoughData: true,
      report,
      averageConfidence: calculateAverageConfidence(pages),
    };
  });

/** Compare annotations between annotators for a specific page */
export const compareAnnotations = adminProcedure
  .input(compareAnnotationsInputSchema)
  .mutation(({ input }) => {
    const labelArrays = input.annotations.map((a) => a.labels);
    const report = generateIAAReport(labelArrays);

    logger.info('Compared annotations', {
      pageId: input.pageId,
      annotatorCount: input.annotations.length,
      alpha: report.overall.alpha,
    });

    return {
      pageId: input.pageId,
      report,
      annotatorIds: input.annotations.map((a) => a.annotatorId),
    };
  });

/** Get aggregated quality stats */
export const getQualityStats = adminProcedure.query(async () => {
  const statusCounts = await prisma.annotatedPage.groupBy({
    by: ['status'],
    _count: { id: true },
  });

  const confidenceStats = await prisma.annotatedPage.aggregate({
    _avg: { confidence: true },
    _min: { confidence: true },
    _max: { confidence: true },
  });

  const reviewedPages = await prisma.annotatedPage.findMany({
    where: { status: { in: ['REVIEWED', 'GOLD'] } },
    select: { labels: true },
  });

  const totalTokens = reviewedPages.reduce((sum, p) => {
    const labels = p.labels as string[] | null;
    return sum + (labels?.length ?? 0);
  }, 0);

  const labeledTokens = reviewedPages.reduce((sum, p) => {
    const labels = p.labels as string[] | null;
    if (!labels) return sum;
    return sum + labels.filter((l) => l !== 'O').length;
  }, 0);

  return {
    statusCounts: Object.fromEntries(statusCounts.map((s) => [s.status, s._count.id])),
    confidence: {
      average: confidenceStats._avg.confidence,
      min: confidenceStats._min.confidence,
      max: confidenceStats._max.confidence,
    },
    tokenStats: {
      total: totalTokens,
      labeled: labeledTokens,
      labeledPercent: totalTokens > 0 ? (labeledTokens / totalTokens) * 100 : 0,
    },
  };
});

// ============================================================================
// Helpers
// ============================================================================

function calculateAverageConfidence(
  pages: Array<{ confidence: number | null }>
): number | null {
  const validConfidences = pages
    .map((p) => p.confidence)
    .filter((c): c is number => c !== null);

  if (validConfidences.length === 0) return null;

  return validConfidences.reduce((a, b) => a + b, 0) / validConfidences.length;
}
