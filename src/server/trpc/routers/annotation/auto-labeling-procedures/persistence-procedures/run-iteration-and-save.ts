/**
 * Run Iteration and Save Procedure
 *
 * Runs auto-labeling iterations and saves results to the database.
 *
 * @module annotation/auto-labeling-procedures/persistence/run-iteration-and-save
 */

import { z } from 'zod';

import { prisma } from '@/server/db';
import { runSingleIteration } from '@/server/services/auto-labeling';
import type { SamplingFilters, DiscoveredUrlType } from '@/server/services/auto-labeling';
import { settingsProcedure } from '@/server/trpc/procedures';
import {
  fetchHtmlWithFlareSolverr,
  getExistingUrls,
} from '@/server/trpc/routers/annotation/helpers';
import { logger } from '@/utils/logger';

// ============================================================================
// Schema
// ============================================================================

const runIterationAndSaveInputSchema = z.object({
  sampleSize: z.number().min(1).max(50).default(10),
  minF1Threshold: z.number().min(0).max(1).default(0.3),
  source: z.enum(['fandom', 'wikipedia', 'comicvine']).optional(),
  pageTypes: z.array(z.enum(['MANGA_PAGE', 'VOLUMES', 'CHAPTERS', 'CHAPTERS_VOLUMES'])).optional(),
  skipExisting: z.boolean().default(true),
  dryRun: z.boolean().default(false),
});

// ============================================================================
// Types
// ============================================================================

type AnnotationStatus = 'created' | 'updated' | 'skipped' | 'failed';

interface SavedAnnotation {
  pageId: string;
  url: string;
  mangaTitle: string;
  entityCount: number;
  tokenCount: number;
  confidence: number;
  status: AnnotationStatus;
  error?: string | undefined;
}

interface BootstrapTokens {
  tokens: Array<{ text: string; tagName?: string; xpath?: string }>;
  labels: string[];
  confidence: number;
  stats: { entityCounts: Record<string, number> };
}

interface PageInfo {
  url: string;
  title: string;
  source: string;
  anilistId: number | null;
  urlType?: string;
}

interface LabelingAttemptData {
  page: PageInfo;
  bootstrapResult?: BootstrapTokens;
  extractedEntities: Array<{ type: string; value: string }>;
  metrics?: { f1: number } | null;
}

interface StatusCounts {
  created: number;
  updated: number;
  skipped: number;
  failed: number;
}

// ============================================================================
// Helper Functions
// ============================================================================

function mapSourceType(source: string): 'FANDOM' | 'WIKIPEDIA' | 'COMICVINE' | 'ANILIST' {
  const map: Record<string, 'FANDOM' | 'WIKIPEDIA' | 'COMICVINE' | 'ANILIST'> = {
    fandom: 'FANDOM',
    wikipedia: 'WIKIPEDIA',
    comicvine: 'COMICVINE',
  };
  return map[source] ?? 'FANDOM';
}

function buildNotes(page: PageInfo, entityCount: number, f1: number): string {
  return [
    page.anilistId ? `AniList ID: ${page.anilistId}` : null,
    page.urlType ? `Page Type: ${page.urlType}` : null,
    `Entities: ${entityCount}`,
    `F1: ${f1.toFixed(2)}`,
  ].filter(Boolean).join(' | ');
}

function prepareTokens(
  bootstrap: BootstrapTokens
): Array<{ id: number; text: string; tagName: string; xpath: string }> {
  return bootstrap.tokens.map((t, i) => ({
    id: i,
    text: t.text,
    tagName: t.tagName ?? 'span',
    xpath: t.xpath ?? '',
  }));
}

async function updateExistingPage(
  id: string,
  bootstrap: BootstrapTokens,
  notes: string
): Promise<void> {
  await prisma.annotatedPage.update({
    where: { id },
    data: {
      tokens: prepareTokens(bootstrap),
      labels: bootstrap.labels,
      entityCounts: bootstrap.stats.entityCounts,
      confidence: bootstrap.confidence,
      status: 'BOOTSTRAP',
      notes,
      updatedAt: new Date(),
    },
  });
}

async function createNewPage(
  page: PageInfo,
  bootstrap: BootstrapTokens,
  notes: string
): Promise<string> {
  const sourceType = mapSourceType(page.source);
  const fetchResult = await fetchHtmlWithFlareSolverr(page.url, sourceType);

  const newPage = await prisma.annotatedPage.create({
    data: {
      url: page.url,
      mangaTitle: page.title,
      sourceType,
      htmlSnapshot: fetchResult.html,
      tokens: prepareTokens(bootstrap),
      labels: bootstrap.labels,
      entityCounts: bootstrap.stats.entityCounts,
      confidence: bootstrap.confidence,
      status: 'BOOTSTRAP',
      notes,
      annotatorId: null,
    },
  });

  return newPage.id;
}

async function saveAnnotation(
  attempt: LabelingAttemptData
): Promise<{ id: string; isNew: boolean }> {
  const { page, bootstrapResult, extractedEntities, metrics } = attempt;
  if (!bootstrapResult) throw new Error('No bootstrap result');

  const notes = buildNotes(page, extractedEntities.length, metrics?.f1 ?? 0);
  const existing = await prisma.annotatedPage.findUnique({
    where: { url: page.url },
    select: { id: true },
  });

  if (existing) {
    await updateExistingPage(existing.id, bootstrapResult, notes);
    return { id: existing.id, isNew: false };
  }

  const id = await createNewPage(page, bootstrapResult, notes);
  return { id, isNew: true };
}

function createAnnotationResult(
  attempt: LabelingAttemptData,
  status: AnnotationStatus,
  pageId: string,
  error?: string
): SavedAnnotation {
  const bootstrap = attempt.bootstrapResult;
  const base = {
    pageId,
    url: attempt.page.url,
    mangaTitle: attempt.page.title,
    entityCount: bootstrap ? attempt.extractedEntities.length : 0,
    tokenCount: bootstrap ? bootstrap.tokens.length : 0,
    confidence: bootstrap ? bootstrap.confidence : 0,
    status,
  };
  if (error !== undefined) {
    return { ...base, error };
  }
  return base;
}

async function processAttempt(
  attempt: LabelingAttemptData,
  minF1: number,
  existingUrls: Set<string>,
  dryRun: boolean
): Promise<SavedAnnotation> {
  if (!attempt.bootstrapResult) {
    return createAnnotationResult(attempt, 'skipped', '', 'No bootstrap result available');
  }

  const f1 = attempt.metrics?.f1 ?? 0;
  if (f1 < minF1) {
    return createAnnotationResult(attempt, 'skipped', '', `F1 ${f1.toFixed(2)} below threshold ${minF1}`);
  }

  if (existingUrls.has(attempt.page.url)) {
    return createAnnotationResult(attempt, 'skipped', '', 'URL already exists in database');
  }

  if (dryRun) {
    return createAnnotationResult(attempt, 'created', '(dry-run)');
  }

  try {
    const saved = await saveAnnotation(attempt);
    return createAnnotationResult(attempt, saved.isNew ? 'created' : 'updated', saved.id);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error('Failed to save annotation', { url: attempt.page.url, error: msg });
    return createAnnotationResult(attempt, 'failed', '', msg);
  }
}

function countStatuses(annotations: SavedAnnotation[]): StatusCounts {
  const counts: StatusCounts = { created: 0, updated: 0, skipped: 0, failed: 0 };
  for (const a of annotations) {
    counts[a.status]++;
  }
  return counts;
}

// ============================================================================
// Procedure
// ============================================================================

/** Run iteration and save extracted annotations to the database */
export const runIterationAndSave = settingsProcedure
  .input(runIterationAndSaveInputSchema)
  .mutation(async ({ input }) => {
    const { sampleSize, minF1Threshold, source, pageTypes, skipExisting, dryRun } = input;

    logger.info('Starting iteration with database persistence', {
      sampleSize, minF1Threshold, source, pageTypes, dryRun,
    });

    const filters: SamplingFilters = { requireAnilistId: true };
    if (source) {
      filters.sources = [source];
      if (source === 'fandom') filters.requireFandomUrls = true;
      if (source === 'wikipedia') filters.requireWikipediaUrls = true;
    }
    if (pageTypes && pageTypes.length > 0) {
      filters.urlTypes = pageTypes as DiscoveredUrlType[];
    }

    const result = await runSingleIteration({ sampleSize, filters });
    const existingUrls = skipExisting
      ? await getExistingUrls(result.attempts.map(a => a.page.url))
      : new Set<string>();

    const savedAnnotations: SavedAnnotation[] = [];
    for (const attempt of result.attempts) {
      // eslint-disable-next-line no-await-in-loop -- Sequential processing required
      const annotation = await processAttempt(
        attempt as LabelingAttemptData,
        minF1Threshold,
        existingUrls,
        dryRun
      );
      savedAnnotations.push(annotation);
    }

    const counts = countStatuses(savedAnnotations);

    logger.info('Iteration with persistence complete', {
      iterationNumber: result.iterationNumber,
      avgF1: result.metrics.avgF1,
      ...counts,
      dryRun,
    });

    return {
      success: true,
      dryRun,
      iterationNumber: result.iterationNumber,
      metrics: {
        totalAttempts: result.metrics.totalAttempts,
        successfulAttempts: result.metrics.successfulAttempts,
        avgPrecision: result.metrics.avgPrecision,
        avgRecall: result.metrics.avgRecall,
        avgF1: result.metrics.avgF1,
      },
      persistence: { ...counts, total: savedAnnotations.length },
      savedAnnotations: savedAnnotations.slice(0, 50),
      topErrors: result.failures.byCategory,
      suggestions: result.suggestions.slice(0, 3),
    };
  });
