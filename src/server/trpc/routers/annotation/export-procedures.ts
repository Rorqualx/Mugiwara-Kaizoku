/**
 * Annotation Router - Export Procedures
 *
 * Training data export with deferred tokenization.
 * Pages are tokenized on-demand at export time if not already tokenized.
 */

import { Prisma } from '@prisma/client';
import { z } from 'zod';

import { prisma } from '@/server/db';
import { adminProcedure } from '@/server/trpc/procedures';
import { logger } from '@/utils/logger';


import {
  getBootstrapLabels,
  calculateEntityCountsFromLabels,
  processTokenForExport,
} from './helpers';

// ============================================================================
// Schemas
// ============================================================================

const exportInputSchema = z.object({
  status: z.array(z.enum(['BOOTSTRAP', 'AGENT_REVIEWED', 'IN_PROGRESS', 'REVIEWED', 'GOLD', 'REJECTED'])).optional(),
  sourceType: z.array(z.enum(['FANDOM', 'WIKIPEDIA', 'ANILIST', 'COMICVINE'])).optional(),
  includeContext: z.boolean().default(true),
  contextSentences: z.number().int().min(0).max(3).default(1),
  limit: z.number().int().min(1).max(1000).default(100),
  cursor: z.string().optional(),
});

// ============================================================================
// Types
// ============================================================================

interface ExportToken {
  text: string;
  label: string;
  entityType: string | null;
  context: { before: string; after: string };
  tokenIndex: number;
  pageId: string;
  mangaTitle: string | null;
  sourceType: string;
}

interface ExportResult {
  tokens: ExportToken[];
  stats: { pages: number; tokens: number; entities: Record<string, number> };
  nextCursor: string | null;
}

interface PageForExport {
  id: string;
  url: string;
  mangaTitle: string | null;
  sourceType: string;
  tokens: unknown;
  labels: unknown;
  htmlSnapshot: string | null;
  version: number;
}

// ============================================================================
// Helper Functions
// ============================================================================

/** Tokenize a page on-demand for export */
async function tokenizeForExport(
  page: PageForExport
): Promise<{ tokens: unknown[]; labels: string[] } | null> {
  if (!page.htmlSnapshot) {
    logger.warn('Page has no HTML snapshot, skipping', { pageId: page.id });
    return null;
  }

  try {
    const bootstrapLabels = await getBootstrapLabels();
    const result = bootstrapLabels(page.htmlSnapshot, page.url);

    // Cache in database
    const serializedTokens = JSON.parse(JSON.stringify(result.tokens)) as Prisma.InputJsonValue;
    const entityCounts = calculateEntityCountsFromLabels(result.labels);

    await prisma.annotatedPage.update({
      where: { id: page.id, version: page.version },
      data: {
        tokens: serializedTokens as Prisma.InputJsonArray,
        labels: result.labels,
        entityCounts,
        confidence: result.confidence,
        version: { increment: 1 },
      },
    });

    logger.info('Tokenized page during export', { pageId: page.id, tokenCount: result.tokens.length });
    return { tokens: result.tokens, labels: result.labels };
  } catch (error) {
    logger.error('Failed to tokenize during export', {
      pageId: page.id,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/** Process tokens from a page for export */
// eslint-disable-next-line max-params -- Export processing requires page, tokens, labels, options, outputs
function processPageTokens(
  page: { id: string; mangaTitle: string | null; sourceType: string },
  tokens: unknown[],
  labels: unknown[],
  includeContext: boolean,
  contextSentences: number,
  exportTokens: ExportToken[],
  entityCounts: Record<string, number>
): void {
  const typedTokens = tokens as Array<{ text: string; normalizedText?: string }>;
  const typedLabels = labels as string[];

  if (!Array.isArray(typedTokens) || !Array.isArray(typedLabels)) return;

  for (let i = 0; i < typedTokens.length; i++) {
    const token = typedTokens[i];
    if (!token) continue;

    const label = typedLabels[i] ?? 'O';
    const processed = processTokenForExport(token, label, i, typedTokens, includeContext, contextSentences);

    if (processed.entityType) {
      // eslint-disable-next-line no-param-reassign -- Output accumulator pattern: entityCounts is an output collector
      entityCounts[processed.entityType] = (entityCounts[processed.entityType] ?? 0) + 1;
    }

    exportTokens.push({
      text: processed.text,
      label: processed.label,
      entityType: processed.entityType,
      context: { before: processed.contextBefore, after: processed.contextAfter },
      tokenIndex: processed.tokenIndex,
      pageId: page.id,
      mangaTitle: page.mangaTitle,
      sourceType: page.sourceType,
    });
  }
}

// ============================================================================
// Export Procedure
// ============================================================================

/** Export training data with deferred tokenization */
export const exportTrainingData = adminProcedure
  .input(exportInputSchema)
  .query(async ({ input }): Promise<ExportResult> => {
    const statusFilter = input.status ?? ['REVIEWED', 'GOLD'];
    const { limit, cursor } = input;

    const findOptions = {
      where: {
        status: { in: statusFilter },
        ...(input.sourceType && { sourceType: { in: input.sourceType } }),
      },
      select: {
        id: true,
        url: true,
        mangaTitle: true,
        sourceType: true,
        tokens: true,
        labels: true,
        htmlSnapshot: true,
        version: true,
      },
      take: limit + 1,
      orderBy: { id: 'asc' as const },
    };

    const pages = cursor
      ? await prisma.annotatedPage.findMany({ ...findOptions, cursor: { id: cursor }, skip: 1 })
      : await prisma.annotatedPage.findMany(findOptions);

    let nextCursor: string | null = null;
    if (pages.length > limit) {
      const nextPage = pages.pop();
      nextCursor = nextPage?.id ?? null;
    }

    const exportTokens: ExportToken[] = [];
    const entityCounts: Record<string, number> = {};
    let tokenizedOnDemand = 0;

    for (const page of pages) {
      let tokens = page.tokens as unknown[];
      let labels = page.labels as unknown[];

      // Deferred tokenization: tokenize if empty
      const needsTokenization = !Array.isArray(tokens) || tokens.length === 0;
      if (needsTokenization) {
        // eslint-disable-next-line no-await-in-loop -- Sequential tokenization for memory management
        const result = await tokenizeForExport(page);
        if (result) {
          tokens = result.tokens;
          labels = result.labels;
          tokenizedOnDemand++;
        } else {
          continue;
        }
      }

      processPageTokens(page, tokens, labels, input.includeContext, input.contextSentences, exportTokens, entityCounts);
    }

    logger.info('Exported training data', {
      pages: pages.length,
      tokens: exportTokens.length,
      tokenizedOnDemand,
      hasMore: nextCursor !== null,
    });

    return {
      tokens: exportTokens,
      stats: { pages: pages.length, tokens: exportTokens.length, entities: entityCounts },
      nextCursor,
    };
  });
