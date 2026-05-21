/**
 * Annotation Router - Auto-Labeling Procedures
 *
 * tRPC procedures for the iterative auto-labeling improvement system.
 *
 * @module annotation/auto-labeling-procedures
 */

import { Prisma } from '@prisma/client';
import { z } from 'zod';


import { prisma } from '@/server/db';
import {
  runSingleIteration,
  getProgress,
  analyzeRecentFailures,
  loadTrainingData,
} from '@/server/services/auto-labeling';
import { settingsProcedure } from '@/server/trpc/procedures';
import { logger } from '@/utils/logger';


import { fetchHtmlWithFlareSolverr } from './helpers';

// Type imported for documentation, not directly used in this simplified version
// import type { EntityType } from '@/server/ml/features/dom-linearizer';

// ============================================================================
// Schemas
// ============================================================================

const runIterationInputSchema = z.object({
  sampleSize: z.number().min(1).max(50).default(10),
});

const bootstrapSourceInputSchema = z.object({
  sampleSize: z.number().min(1).max(100).default(20),
  source: z.enum(['wikipedia', 'fandom', 'comicvine']),
  /** Run all available entries (ignores sampleSize) */
  processAll: z.boolean().default(false),
});

const importFromTrainingDataInputSchema = z.object({
  source: z.enum(['wikipedia', 'fandom']),
  /** Maximum number of pages to import (0 = all) */
  limit: z.number().min(0).max(500).default(50),
  /** Skip entries that don't have AniList IDs */
  requireAnilistId: z.boolean().default(true),
  /** Dry run - just count without importing */
  dryRun: z.boolean().default(false),
});

const compareWithGoldInputSchema = z.object({
  limit: z.number().min(1).max(100).default(20),
});

// ============================================================================
// Entity Extraction Helper Types
// ============================================================================

interface GoldEntity {
  type: string;
  value: string;
}

// ============================================================================
// Entity Extraction Helpers
// ============================================================================

function createGoldEntity(type: string, tokens: string[]): GoldEntity {
  return { type, value: tokens.join(' ') };
}

function extractEntitiesFromBIO(labels: string[], tokens: string[]): GoldEntity[] {
  const entities: GoldEntity[] = [];
  let currentType: string | null = null;
  let currentTokens: string[] = [];

  for (let i = 0; i < labels.length; i++) {
    const label = labels[i] ?? 'O';
    const token = tokens[i] ?? '';

    if (label.startsWith('B-')) {
      if (currentType) entities.push(createGoldEntity(currentType, currentTokens));
      currentType = label.slice(2);
      currentTokens = [token];
    } else if (label.startsWith('I-') && currentType) {
      currentTokens.push(token);
    } else if (currentType) {
      entities.push(createGoldEntity(currentType, currentTokens));
      currentType = null;
      currentTokens = [];
    }
  }

  if (currentType) entities.push(createGoldEntity(currentType, currentTokens));
  return entities;
}

// ============================================================================
// Procedures
// ============================================================================

/** Run a single auto-labeling iteration */
export const runIteration = settingsProcedure
  .input(runIterationInputSchema)
  .mutation(async ({ input }) => {
    logger.info('Starting auto-labeling iteration', { sampleSize: input.sampleSize });

    const result = await runSingleIteration({ sampleSize: input.sampleSize });

    logger.info('Completed auto-labeling iteration', {
      iterationNumber: result.iterationNumber,
      avgF1: result.metrics.avgF1,
    });

    return {
      success: true,
      iterationNumber: result.iterationNumber,
      metrics: {
        totalAttempts: result.metrics.totalAttempts,
        successfulAttempts: result.metrics.successfulAttempts,
        avgPrecision: result.metrics.avgPrecision,
        avgRecall: result.metrics.avgRecall,
        avgF1: result.metrics.avgF1,
      },
      topErrors: result.failures.byCategory,
      suggestions: result.suggestions.slice(0, 5),
    };
  });

/** Get current progress and trends */
export const getAutoLabelingProgress = settingsProcedure.query(() => {
  const progress = getProgress();
  const failures = analyzeRecentFailures();

  return {
    iterationCount: progress.totalIterations,
    currentF1: progress.latestIteration?.avgF1 ?? 0,
    trend: progress.trend,
    recentErrors: failures.patterns,
    suggestions: failures.suggestions,
  };
});

/** Get training data statistics */
export const getTrainingDataStats = settingsProcedure.query(() => {
  const data = loadTrainingData();

  // Count entries by source and total discovered URLs
  const bySource: Record<string, number> = {};
  let totalDiscoveredUrls = 0;

  for (const entry of data) {
    if (entry.fandomDiscoveredUrls.length > 0) {
      bySource['fandom'] = (bySource['fandom'] ?? 0) + 1;
      totalDiscoveredUrls += entry.fandomDiscoveredUrls.length;
    }
    if (entry.wikipediaDiscoveredUrls.length > 0) {
      bySource['wikipedia'] = (bySource['wikipedia'] ?? 0) + 1;
      totalDiscoveredUrls += entry.wikipediaDiscoveredUrls.length;
    }
    if (entry.comicVineDiscoveredUrls.length > 0) {
      bySource['comicvine'] = (bySource['comicvine'] ?? 0) + 1;
      totalDiscoveredUrls += entry.comicVineDiscoveredUrls.length;
    }
  }

  const withUrls = data.filter(e =>
    e.fandomDiscoveredUrls.length > 0 ||
    e.wikipediaDiscoveredUrls.length > 0 ||
    e.comicVineDiscoveredUrls.length > 0
  ).length;

  return {
    totalEntries: data.length,
    bySource,
    hasUrls: withUrls,
    totalDiscoveredUrls,
  };
});

const getTrainingDataEntriesInputSchema = z.object({
  /** Maximum entries to return (0 = all) */
  limit: z.number().min(0).max(1000).default(100),
  /** Filter by source */
  source: z.enum(['all', 'fandom', 'wikipedia', 'comicvine']).default('all'),
  /** Search by title */
  search: z.string().optional(),
});

/** Get training data entries with all columns for display */
export const getTrainingDataEntries = settingsProcedure
  .input(getTrainingDataEntriesInputSchema)
  .query(({ input }) => {
    const data = loadTrainingData();
    const { limit, source, search } = input;

    // Filter by source if specified
    let filtered = data;
    if (source !== 'all') {
      filtered = data.filter(entry => {
        switch (source) {
          case 'fandom':
            return entry.fandomUrl ?? entry.fandomDiscoveredUrls.length > 0;
          case 'wikipedia':
            return entry.wikipediaUrl ?? entry.wikipediaDiscoveredUrls.length > 0;
          case 'comicvine':
            return entry.comicVineId ?? entry.comicVineDiscoveredUrls.length > 0;
          default:
            return true;
        }
      });
    }

    // Filter by search term if specified
    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(entry =>
        entry.title.toLowerCase().includes(searchLower)
      );
    }

    // Apply limit
    const limited = limit > 0 ? filtered.slice(0, limit) : filtered;

    // Map to response format with all columns
    const entries = limited.map(entry => ({
      title: entry.title,
      anilistId: entry.anilistId,
      wikipediaUrl: entry.wikipediaUrl,
      fandomUrl: entry.fandomUrl,
      comicVineId: entry.comicVineId,
      fandomDiscoveredUrls: entry.fandomDiscoveredUrls.map(u => ({
        type: u.type,
        url: u.url,
        categoryName: u.categoryName,
      })),
      wikipediaDiscoveredUrls: entry.wikipediaDiscoveredUrls.map(u => ({
        type: u.type,
        url: u.url,
        categoryName: u.categoryName,
      })),
      comicVineDiscoveredUrls: entry.comicVineDiscoveredUrls.map(u => ({
        type: u.type,
        url: u.url,
        categoryName: u.categoryName,
      })),
    }));

    return {
      entries,
      total: filtered.length,
      hasMore: limit > 0 && filtered.length > limit,
    };
  });

/** Bootstrap all titles from a specific source (Wikipedia, Fandom, or ComicVine) */
export const bootstrapBySource = settingsProcedure
  .input(bootstrapSourceInputSchema)
  .mutation(async ({ input }) => {
    const { source, sampleSize, processAll } = input;

    logger.info('Starting source-specific bootstrap', { source, sampleSize, processAll });

    // Build filters for the specific source
    const filters = buildSourceFilters(source);

    // Get available count for this source
    const data = loadTrainingData();
    const availableCount = countEntriesForSource(data, source);

    // Determine actual sample size
    const effectiveSampleSize = processAll ? availableCount : Math.min(sampleSize, availableCount);

    if (effectiveSampleSize === 0) {
      return {
        success: false,
        message: `No entries with ${source} URLs found in training data`,
        metrics: null,
        processedCount: 0,
        availableCount,
      };
    }

    const result = await runSingleIteration({
      sampleSize: effectiveSampleSize,
      filters,
    });

    logger.info('Source bootstrap complete', {
      source,
      processedCount: result.attempts.length,
      avgF1: result.metrics.avgF1,
      successRate: result.metrics.successfulAttempts / result.metrics.totalAttempts,
    });

    return {
      success: true,
      message: `Processed ${result.attempts.length} ${source} entries`,
      iterationNumber: result.iterationNumber,
      metrics: {
        totalAttempts: result.metrics.totalAttempts,
        successfulAttempts: result.metrics.successfulAttempts,
        avgPrecision: result.metrics.avgPrecision,
        avgRecall: result.metrics.avgRecall,
        avgF1: result.metrics.avgF1,
      },
      processedCount: result.attempts.length,
      availableCount,
      topErrors: result.failures.byCategory,
      suggestions: result.suggestions.slice(0, 5),
    };
  });

/**
 * Build sampling filters for a specific source.
 */
function buildSourceFilters(source: 'wikipedia' | 'fandom' | 'comicvine'): {
  requireAnilistId: boolean;
  requireFandomUrls?: boolean;
  requireWikipediaUrls?: boolean;
  sources: Array<'fandom' | 'wikipedia' | 'comicvine'>;
} {
  const baseFilters = {
    requireAnilistId: true,
    sources: [source] as Array<'fandom' | 'wikipedia' | 'comicvine'>,
  };

  switch (source) {
    case 'wikipedia':
      return { ...baseFilters, requireWikipediaUrls: true };
    case 'fandom':
      return { ...baseFilters, requireFandomUrls: true };
    case 'comicvine':
    default:
      // ComicVine doesn't have a requireComicVineUrls filter yet
      return baseFilters;
  }
}

/**
 * Count entries that have URLs for a specific source.
 */
function countEntriesForSource(
  data: ReturnType<typeof loadTrainingData>,
  source: 'wikipedia' | 'fandom' | 'comicvine'
): number {
  return data.filter(entry => {
    // Must have AniList ID for ground truth
    if (entry.anilistId === null) return false;

    switch (source) {
      case 'wikipedia':
        return entry.wikipediaDiscoveredUrls.length > 0;
      case 'fandom':
        return entry.fandomDiscoveredUrls.length > 0;
      case 'comicvine':
      default:
        return entry.comicVineDiscoveredUrls.length > 0;
    }
  }).length;
}

// ============================================================================
// Import from Training Data Types
// ============================================================================

interface ImportResult {
  url: string;
  mangaTitle: string;
  pageId: string;
  status: 'created' | 'exists' | 'failed';
  error?: string;
}

// ============================================================================
// Import from Training Data Procedure
// ============================================================================

/** Import Wikipedia/Fandom pages from training CSV into annotation pages */
export const importFromTrainingData = settingsProcedure
  .input(importFromTrainingDataInputSchema)
  .mutation(async ({ input }) => {
    const { source, limit, requireAnilistId, dryRun } = input;

    logger.info('Starting import from training data', { source, limit, requireAnilistId, dryRun });

    // Load training data
    const trainingData = loadTrainingData();

    // Extract URLs for the specified source
    const urlsToImport = extractUrlsFromTrainingData(trainingData, source, requireAnilistId);

    // Apply limit (0 = all)
    const limitedUrls = limit > 0 ? urlsToImport.slice(0, limit) : urlsToImport;

    if (dryRun) {
      return {
        success: true,
        dryRun: true,
        message: `Would import ${limitedUrls.length} ${source} pages`,
        totalAvailable: urlsToImport.length,
        wouldImport: limitedUrls.length,
        preview: limitedUrls.slice(0, 10).map(u => ({ title: u.mangaTitle, url: u.url })),
      };
    }

    // Check which URLs already exist
    const existingUrls = await getExistingUrls(limitedUrls.map(u => u.url));

    // Filter out existing URLs
    const newUrls = limitedUrls.filter(u => !existingUrls.has(u.url));

    if (newUrls.length === 0) {
      return {
        success: true,
        message: `All ${limitedUrls.length} URLs already exist in the database`,
        totalAvailable: urlsToImport.length,
        alreadyExists: limitedUrls.length,
        imported: 0,
        failed: 0,
        results: [],
      };
    }

    // Import pages in batches
    const results = await importPagesInBatches(newUrls, source);

    const created = results.filter(r => r.status === 'created').length;
    const exists = results.filter(r => r.status === 'exists').length;
    const failed = results.filter(r => r.status === 'failed').length;

    logger.info('Import from training data complete', {
      source,
      totalAvailable: urlsToImport.length,
      imported: created,
      alreadyExists: exists + existingUrls.size,
      failed,
    });

    return {
      success: true,
      message: `Imported ${created} ${source} pages (${exists + existingUrls.size} already existed, ${failed} failed)`,
      totalAvailable: urlsToImport.length,
      imported: created,
      alreadyExists: exists + existingUrls.size,
      failed,
      results: results.slice(0, 50), // Return first 50 results
    };
  });

/**
 * Extract URLs from training data for a specific source.
 * Includes both base URLs and discovered URLs.
 */
function extractUrlsFromTrainingData(
  data: ReturnType<typeof loadTrainingData>,
  source: 'wikipedia' | 'fandom',
  requireAnilistId: boolean
): Array<{ url: string; mangaTitle: string; anilistId: number | null; urlType?: string }> {
  const urls: Array<{ url: string; mangaTitle: string; anilistId: number | null; urlType?: string }> = [];
  const seenUrls = new Set<string>();

  for (const entry of data) {
    // Skip if we require AniList ID and it's missing
    if (requireAnilistId && entry.anilistId === null) continue;

    // Add base URL first
    const baseUrl = source === 'wikipedia' ? entry.wikipediaUrl : entry.fandomUrl;
    if (baseUrl && baseUrl !== 'DOES_NOT_EXIST' && baseUrl.trim() !== '' && !seenUrls.has(baseUrl)) {
      seenUrls.add(baseUrl);
      urls.push({
        url: baseUrl,
        mangaTitle: entry.title,
        anilistId: entry.anilistId,
        urlType: 'MAIN_PAGE',
      });
    }

    // Add discovered URLs
    const discoveredUrls = source === 'wikipedia'
      ? entry.wikipediaDiscoveredUrls
      : entry.fandomDiscoveredUrls;

    for (const discovered of discoveredUrls) {
      if (!discovered.url || seenUrls.has(discovered.url)) continue;
      seenUrls.add(discovered.url);
      urls.push({
        url: discovered.url,
        mangaTitle: entry.title,
        anilistId: entry.anilistId,
        urlType: discovered.type,
      });
    }
  }

  return urls;
}

/**
 * Get set of URLs that already exist in the database.
 */
async function getExistingUrls(urls: string[]): Promise<Set<string>> {
  const existing = await prisma.annotatedPage.findMany({
    where: { url: { in: urls } },
    select: { url: true },
  });

  return new Set(existing.map(p => p.url));
}

/**
 * Import pages in batches with concurrency control.
 */
async function importPagesInBatches(
  urls: Array<{ url: string; mangaTitle: string; anilistId: number | null; urlType?: string }>,
  source: 'wikipedia' | 'fandom'
): Promise<ImportResult[]> {
  const BATCH_SIZE = 3;
  const results: ImportResult[] = [];

  // Process in batches
  for (let i = 0; i < urls.length; i += BATCH_SIZE) {
    const batch = urls.slice(i, i + BATCH_SIZE);
    const batchPromises = batch.map(item => importSinglePage(item, source));

    // eslint-disable-next-line no-await-in-loop -- Sequential batch processing for controlled concurrency
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);

    // Log progress
    logger.info('Import batch complete', {
      progress: `${Math.min(i + BATCH_SIZE, urls.length)}/${urls.length}`,
      created: results.filter(r => r.status === 'created').length,
    });
  }

  return results;
}

/**
 * Build notes string from item metadata.
 */
function buildNotesString(item: { anilistId: number | null; urlType?: string }): string | null {
  const parts: string[] = [];
  if (item.anilistId) {
    parts.push(`AniList ID: ${item.anilistId}`);
  }
  if (item.urlType) {
    parts.push(`Type: ${item.urlType}`);
  }
  return parts.length > 0 ? parts.join(' | ') : null;
}

/**
 * Import a single page from URL.
 */
async function importSinglePage(
  item: { url: string; mangaTitle: string; anilistId: number | null; urlType?: string },
  source: 'wikipedia' | 'fandom'
): Promise<ImportResult> {
  const sourceType = source === 'wikipedia' ? 'WIKIPEDIA' : 'FANDOM';

  try {
    // Fetch HTML
    const fetchResult = await fetchHtmlWithFlareSolverr(item.url, sourceType);
    const html = fetchResult.html;

    // Create annotated page
    const page = await prisma.annotatedPage.create({
      data: {
        url: item.url,
        mangaTitle: item.mangaTitle,
        sourceType,
        htmlSnapshot: html,
        tokens: [],
        labels: [],
        entityCounts: {},
        confidence: null,
        notes: buildNotesString(item),
        annotatorId: null,
        status: 'BOOTSTRAP',
      },
    });

    logger.debug('Imported page', { pageId: page.id, url: item.url, title: item.mangaTitle, urlType: item.urlType });
    return { url: item.url, mangaTitle: item.mangaTitle, pageId: page.id, status: 'created' };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      logger.debug('URL already exists', { url: item.url });
      return { url: item.url, mangaTitle: item.mangaTitle, pageId: '', status: 'exists' };
    }

    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Import failed', { url: item.url, error: errorMessage });
    return { url: item.url, mangaTitle: item.mangaTitle, pageId: '', status: 'failed', error: errorMessage };
  }
}

/** Get gold annotation statistics */
export const compareWithGold = settingsProcedure
  .input(compareWithGoldInputSchema)
  .mutation(async ({ input }) => {
    const goldPages = await prisma.annotatedPage.findMany({
      where: { status: 'GOLD' },
      select: {
        id: true,
        mangaTitle: true,
        tokens: true,
        labels: true,
        entityCounts: true,
      },
      take: input.limit,
    });

    const results = processGoldAnnotations(goldPages);
    return buildGoldComparisonResult(results);
  });

// ============================================================================
// Gold Comparison Helpers
// ============================================================================

interface GoldPageData {
  id: string;
  mangaTitle: string | null;
  tokens: unknown;
  labels: unknown;
  entityCounts: unknown;
}

interface GoldComparisonResult {
  pageId: string;
  title: string;
  entityCount: number;
  entityTypes: string[];
}

function processGoldAnnotations(pages: GoldPageData[]): GoldComparisonResult[] {
  const results: GoldComparisonResult[] = [];

  for (const page of pages) {
    const result = processOneGoldPage(page);
    if (result) results.push(result);
  }

  return results;
}

function processOneGoldPage(page: GoldPageData): GoldComparisonResult | null {
  const tokens = page.tokens as string[] | null;
  const labels = page.labels as string[] | null;
  if (!tokens || !labels) return null;

  const entities = extractEntitiesFromBIO(labels, tokens);
  const types = [...new Set(entities.map(e => e.type))];

  return {
    pageId: page.id,
    title: page.mangaTitle ?? 'Unknown',
    entityCount: entities.length,
    entityTypes: types,
  };
}

function buildGoldComparisonResult(results: GoldComparisonResult[]): {
  success: boolean;
  message: string;
  goldPages: GoldComparisonResult[];
  summary: { totalPages: number; totalEntities: number; avgEntitiesPerPage: number };
} {
  const count = results.length;
  const hasResults = count > 0;
  const totalEntities = results.reduce((s, r) => s + r.entityCount, 0);

  return {
    success: hasResults,
    message: hasResults ? `Found ${count} gold annotations` : 'No gold annotations found',
    goldPages: results,
    summary: {
      totalPages: count,
      totalEntities,
      avgEntitiesPerPage: hasResults ? totalEntities / count : 0,
    },
  };
}
