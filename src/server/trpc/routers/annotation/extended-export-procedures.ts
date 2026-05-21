/**
 * Annotation Router - Extended Export & Enrichment Procedures
 *
 * Phase 3: tRPC procedures for LLM training data export with extended filters
 * and page enrichment (segments, auto quality, document labels).
 *
 * @module annotation/extended-export-procedures
 */

import {
  Prisma,
  QualityTier as PrismaQualityTier,
  DocumentCategory as PrismaDocumentCategory,
  UseCaseLabel as PrismaUseCaseLabel,
} from '@prisma/client';
import { z } from 'zod';

import { prisma } from '@/server/db';
import type { BIOTag } from '@/server/ml/features/bio-types';
import type { LinearizedToken } from '@/server/ml/features/dom-linearizer';
import { extractSegments } from '@/server/ml/features/segment-extractor';
import { inferImageLabelsForTokens } from '@/server/ml/labels/image-label-inference';
import { computeAutoQuality } from '@/server/ml/quality/auto-scorer';
import {
  inferDocumentLabels,
  type DocumentCategory,
  type QualityTier,
  type UseCaseLabel,
} from '@/server/services/training/document-labeling';
import {
  exportToFormat,
  type ExportFormat,
  type UnifiedExportResult,
} from '@/server/services/training/export';
import { settingsProcedure } from '@/server/trpc/procedures';
import type { ImageLabel } from '@/types/training/image-labels';
import { logger } from '@/utils/logger';


import { statusSchema, sourceTypeSchema } from './schemas';

// ============================================================================
// Schemas
// ============================================================================

const documentCategorySchema = z.enum([
  'SYNOPSIS', 'REVIEW', 'ANALYSIS', 'NEWS', 'REFERENCE', 'DISCUSSION', 'METADATA', 'MIXED',
]);

const qualityTierSchema = z.enum(['HIGH', 'MEDIUM', 'LOW', 'EXCLUDE']);

const useCaseLabelSchema = z.enum([
  'INSTRUCTION_TUNING', 'SUMMARIZATION', 'QA', 'CLASSIFICATION',
  'ENTITY_EXTRACTION', 'RECOMMENDATION', 'TRANSLATION',
]);

const exportFormatSchema = z.enum([
  'jsonl', 'alpaca', 'sharegpt', 'qa', 'markdown', 'ner', 'conll', 'spacy',
]);

const exportExtendedInputSchema = z.object({
  status: z.array(statusSchema).optional(),
  sourceType: z.array(sourceTypeSchema).optional(),
  categories: z.array(documentCategorySchema).optional(),
  minQualityTier: qualityTierSchema.optional(),
  useCases: z.array(useCaseLabelSchema).optional(),
  entityTypes: z.array(z.string()).optional(),
  format: exportFormatSchema.default('jsonl'),
  includeMetadata: z.boolean().default(true),
  maxInputLength: z.number().int().positive().optional(),
  limit: z.number().int().min(1).max(500).default(100),
  cursor: z.string().optional(),
});

const enrichPageInputSchema = z.object({
  id: z.string(),
  forceRecompute: z.boolean().default(false),
});

const enrichAllPagesInputSchema = z.object({
  status: z.array(statusSchema).optional(),
  sourceType: z.array(sourceTypeSchema).optional(),
  onlyMissing: z.boolean().default(true),
  batchSize: z.number().int().min(1).max(100).default(50),
});

// ============================================================================
// Types
// ============================================================================

interface ExtendedExportResult extends UnifiedExportResult {
  nextCursor: string | null;
  pageCount: number;
  filters: {
    status?: string[] | undefined;
    sourceType?: string[] | undefined;
    categories?: string[] | undefined;
    minQualityTier?: string | undefined;
    useCases?: string[] | undefined;
  };
}

interface EnrichmentResult {
  pageId: string;
  segments: { markdown: string; plainText: string; paragraphCount: number; sectionCount: number };
  autoQuality: { score: number; tier: string; recommendations: string[] };
  documentLabels: { category: DocumentCategory; qualityTier: QualityTier; useCases: UseCaseLabel[] };
  imageLabels: { total: number; relevant: number; labels: ImageLabel[] };
  updated: boolean;
}

interface BatchEnrichmentResult {
  processed: number;
  enriched: number;
  skipped: number;
  errors: number;
  results: Array<{ pageId: string; success: boolean; error?: string | undefined }>;
}

interface PageForEnrichment {
  id: string;
  tokens: unknown;
  labels: unknown;
  confidence: number | null;
  version: number;
}

// ============================================================================
// Helper Functions
// ============================================================================

const QUALITY_TIER_ORDER: Record<QualityTier, number> = { HIGH: 3, MEDIUM: 2, LOW: 1, EXCLUDE: 0 };

function getValidTiersForMinimum(minTier: QualityTier): PrismaQualityTier[] {
  return Object.entries(QUALITY_TIER_ORDER)
    .filter(([, value]) => value >= QUALITY_TIER_ORDER[minTier])
    .map(([key]) => key as PrismaQualityTier);
}

interface EnrichmentDataResult {
  segmentResult: ReturnType<typeof extractSegments>;
  qualityResult: ReturnType<typeof computeAutoQuality>;
  documentLabels: ReturnType<typeof inferDocumentLabels>;
  imageLabels: ImageLabel[];
}

async function computeEnrichmentData(
  tokens: LinearizedToken[],
  labels: BIOTag[],
  confidence: number | null,
  pageId: string
): Promise<EnrichmentDataResult | null> {
  const segmentResult = extractSegments(tokens);
  const qualityResult = computeAutoQuality(tokens, labels, confidence ?? undefined);
  const imageLabels = inferImageLabelsForTokens(tokens);

  const fullPage = await prisma.annotatedPage.findUnique({ where: { id: pageId } });
  if (!fullPage) {
    logger.warn('Page not found for enrichment', { pageId });
    return null;
  }

  const documentLabels = inferDocumentLabels(fullPage, {
    tokens,
    labels,
    confidence: confidence ?? undefined,
    autoQualityScore: qualityResult.score,
  });

  return { segmentResult, qualityResult, documentLabels, imageLabels };
}

// eslint-disable-next-line max-params -- Database save function receives enrichment data computed by computeEnrichmentData
async function saveEnrichmentToDatabase(
  pageId: string,
  version: number,
  segmentResult: ReturnType<typeof extractSegments>,
  qualityResult: ReturnType<typeof computeAutoQuality>,
  documentLabels: ReturnType<typeof inferDocumentLabels>,
  imageLabels: ImageLabel[]
): Promise<void> {
  const segmentsJson = { markdown: segmentResult.markdown, plainText: segmentResult.plainText };

  await prisma.annotatedPage.update({
    where: { id: pageId, version },
    data: {
      segments: segmentsJson,
      autoQualityScore: qualityResult.score,
      qualityTier: qualityResult.tier.toUpperCase() as PrismaQualityTier,
      documentCategory: documentLabels.category as PrismaDocumentCategory,
      useCases: documentLabels.useCases as PrismaUseCaseLabel[],
      imageLabels: imageLabels as unknown as Prisma.InputJsonValue,
      version: { increment: 1 },
    },
  });
}

// eslint-disable-next-line max-params -- Result builder receives all enrichment components to construct final response
function buildEnrichmentResult(
  pageId: string,
  segmentResult: ReturnType<typeof extractSegments>,
  qualityResult: ReturnType<typeof computeAutoQuality>,
  documentLabels: ReturnType<typeof inferDocumentLabels>,
  imageLabels: ImageLabel[],
  updated: boolean
): EnrichmentResult {
  const relevantCount = imageLabels.filter((l) => l.isRelevant).length;

  return {
    pageId,
    segments: {
      markdown: segmentResult.markdown,
      plainText: segmentResult.plainText,
      paragraphCount: segmentResult.stats.paragraphCount,
      sectionCount: segmentResult.stats.sectionCount,
    },
    autoQuality: {
      score: qualityResult.score,
      tier: qualityResult.tier,
      recommendations: qualityResult.recommendations,
    },
    documentLabels,
    imageLabels: {
      total: imageLabels.length,
      relevant: relevantCount,
      labels: imageLabels,
    },
    updated,
  };
}

async function enrichPageData(page: PageForEnrichment): Promise<EnrichmentResult | null> {
  const rawTokens = page.tokens;
  const rawLabels = page.labels;

  if (!Array.isArray(rawTokens) || !Array.isArray(rawLabels)) {
    logger.warn('Page missing tokens or labels', { pageId: page.id });
    return null;
  }

  const tokens = rawTokens as LinearizedToken[];
  const labels = rawLabels as BIOTag[];

  const enrichmentData = await computeEnrichmentData(tokens, labels, page.confidence, page.id);
  if (!enrichmentData) return null;

  const { segmentResult, qualityResult, documentLabels, imageLabels } = enrichmentData;

  await saveEnrichmentToDatabase(page.id, page.version, segmentResult, qualityResult, documentLabels, imageLabels);

  return buildEnrichmentResult(page.id, segmentResult, qualityResult, documentLabels, imageLabels, true);
}

function buildExportWhereClause(input: z.infer<typeof exportExtendedInputSchema>): Prisma.AnnotatedPageWhereInput {
  const where: Prisma.AnnotatedPageWhereInput = {};

  if (input.status && input.status.length > 0) {
    where.status = { in: input.status };
  }
  if (input.sourceType && input.sourceType.length > 0) {
    where.sourceType = { in: input.sourceType };
  }
  if (input.categories && input.categories.length > 0) {
    where.documentCategory = { in: input.categories };
  }
  if (input.minQualityTier) {
    where.qualityTier = { in: getValidTiersForMinimum(input.minQualityTier) };
  }
  if (input.useCases && input.useCases.length > 0) {
    where.useCases = { hasSome: input.useCases };
  }

  return where;
}

async function processEnrichmentBatch(
  pages: PageForEnrichment[],
  results: BatchEnrichmentResult['results']
): Promise<{ enriched: number; skipped: number; errors: number }> {
  let enriched = 0;
  let skipped = 0;
  let errors = 0;

  const batchResults = await Promise.all(
    pages.map(async (page) => {
      try {
        const result = await enrichPageData(page);
        if (result) {
          return { pageId: page.id, success: true as const, enriched: true };
        } else {
          return { pageId: page.id, success: false as const, enriched: false, error: 'Missing data' };
        }
      } catch (error) {
        return {
          pageId: page.id,
          success: false as const,
          enriched: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    })
  );

  for (const res of batchResults) {
    results.push({ pageId: res.pageId, success: res.success, error: res.success ? undefined : res.error });
    if (res.success && res.enriched) {
      enriched++;
    } else if (!res.success && res.error === 'Missing data') {
      skipped++;
    } else if (!res.success) {
      errors++;
    }
  }

  return { enriched, skipped, errors };
}

// ============================================================================
// Procedures
// ============================================================================

/**
 * Export training data with extended filters
 */
export const exportExtended = settingsProcedure
  .input(exportExtendedInputSchema)
  .query(async ({ input }): Promise<ExtendedExportResult> => {
    const where = buildExportWhereClause(input);

    const pages = await prisma.annotatedPage.findMany({
      where,
      take: input.limit + 1,
      orderBy: { id: 'asc' },
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
    });

    let nextCursor: string | null = null;
    if (pages.length > input.limit) {
      const nextPage = pages.pop();
      nextCursor = nextPage?.id ?? null;
    }

    const exportResult = exportToFormat(pages, {
      format: input.format as ExportFormat,
      includeMetadata: input.includeMetadata,
      entityTypes: input.entityTypes,
      maxInputLength: input.maxInputLength,
    });

    logger.info('Extended export completed', {
      format: input.format,
      pageCount: pages.length,
      recordCount: exportResult.recordCount,
      hasMore: nextCursor !== null,
    });

    return {
      ...exportResult,
      nextCursor,
      pageCount: pages.length,
      filters: {
        status: input.status,
        sourceType: input.sourceType,
        categories: input.categories,
        minQualityTier: input.minQualityTier,
        useCases: input.useCases,
      },
    };
  });

/**
 * Enrich a single page with segments, auto quality, and document labels
 */
export const enrichPage = settingsProcedure
  .input(enrichPageInputSchema)
  .mutation(async ({ input }): Promise<EnrichmentResult> => {
    const { id, forceRecompute } = input;

    const page = await prisma.annotatedPage.findUnique({
      where: { id },
      select: { id: true, tokens: true, labels: true, confidence: true, version: true, segments: true, autoQualityScore: true, imageLabels: true },
    });

    if (!page) {
      throw new Error(`Page not found: ${id}`);
    }

    const hasSegments = page.segments !== null;
    const hasQuality = page.autoQualityScore !== null;

    if (hasSegments && hasQuality && !forceRecompute) {
      return buildCachedEnrichmentResult(page);
    }

    const result = await enrichPageData(page);
    if (!result) {
      throw new Error(`Failed to enrich page: ${id}`);
    }

    logger.info('Page enriched', {
      pageId: id,
      qualityScore: result.autoQuality.score,
      qualityTier: result.autoQuality.tier,
      category: result.documentLabels.category,
    });

    return result;
  });

async function buildCachedEnrichmentResult(page: {
  id: string;
  tokens: unknown;
  labels: unknown;
  segments: Prisma.JsonValue;
  autoQualityScore: number | null;
  imageLabels: Prisma.JsonValue;
}): Promise<EnrichmentResult> {
  const tokens = page.tokens as LinearizedToken[];
  const labels = page.labels as BIOTag[];
  const segments = page.segments as { markdown?: string; plainText?: string } | null;
  const storedImageLabels = (page.imageLabels ?? []) as unknown as ImageLabel[];

  const fullPage = await prisma.annotatedPage.findUnique({ where: { id: page.id } });
  const documentLabels = fullPage
    ? inferDocumentLabels(fullPage, { tokens, labels })
    : { category: 'MIXED' as DocumentCategory, qualityTier: 'MEDIUM' as QualityTier, useCases: [] as UseCaseLabel[] };

  // Use stored labels or compute fresh ones
  const imageLabels = storedImageLabels.length > 0 ? storedImageLabels : inferImageLabelsForTokens(tokens);
  const relevantCount = imageLabels.filter((l) => l.isRelevant).length;

  return {
    pageId: page.id,
    segments: {
      markdown: segments?.markdown ?? '',
      plainText: segments?.plainText ?? '',
      paragraphCount: 0,
      sectionCount: 0,
    },
    autoQuality: { score: page.autoQualityScore ?? 0, tier: 'medium', recommendations: [] },
    documentLabels,
    imageLabels: {
      total: imageLabels.length,
      relevant: relevantCount,
      labels: imageLabels,
    },
    updated: false,
  };
}

/**
 * Batch enrich all pages matching filters
 */
export const enrichAllPages = settingsProcedure
  .input(enrichAllPagesInputSchema)
  .mutation(async ({ input }): Promise<BatchEnrichmentResult> => {
    const where = buildEnrichmentWhereClause(input);

    const totalCount = await prisma.annotatedPage.count({ where });
    if (totalCount === 0) {
      return { processed: 0, enriched: 0, skipped: 0, errors: 0, results: [] };
    }

    logger.info('Starting batch enrichment', { totalPages: totalCount, batchSize: input.batchSize, onlyMissing: input.onlyMissing });

    return processBatchEnrichment(where, totalCount, input.batchSize);
  });

function buildEnrichmentWhereClause(input: z.infer<typeof enrichAllPagesInputSchema>): Prisma.AnnotatedPageWhereInput {
  const where: Prisma.AnnotatedPageWhereInput = {};

  if (input.status && input.status.length > 0) {
    where.status = { in: input.status };
  }
  if (input.sourceType && input.sourceType.length > 0) {
    where.sourceType = { in: input.sourceType };
  }
  if (input.onlyMissing) {
    where.OR = [{ segments: { equals: Prisma.JsonNull } }, { autoQualityScore: null }];
  }

  return where;
}

async function processBatchEnrichment(
  where: Prisma.AnnotatedPageWhereInput,
  totalCount: number,
  batchSize: number
): Promise<BatchEnrichmentResult> {
  let processed = 0;
  let enriched = 0;
  let skipped = 0;
  let errors = 0;
  const results: BatchEnrichmentResult['results'] = [];
  let cursor: string | undefined;

  while (processed < totalCount) {
    // eslint-disable-next-line no-await-in-loop -- Paginated batch processing requires sequential fetches
    const pages = await prisma.annotatedPage.findMany({
      where,
      take: batchSize,
      orderBy: { id: 'asc' },
      select: { id: true, tokens: true, labels: true, confidence: true, version: true },
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    if (pages.length === 0) break;

    // eslint-disable-next-line no-await-in-loop -- Batch processing within pagination loop
    const batchResults = await processEnrichmentBatch(pages, results);
    processed += pages.length;
    enriched += batchResults.enriched;
    skipped += batchResults.skipped;
    errors += batchResults.errors;

    cursor = pages.at(-1)?.id;

    logger.info('Batch enrichment progress', { processed, enriched, errors, remaining: totalCount - processed });
  }

  logger.info('Batch enrichment completed', { processed, enriched, skipped, errors });

  return { processed, enriched, skipped, errors, results };
}
