#!/usr/bin/env bun
/**
 * Run Iteration and Save to Database
 *
 * Runs an auto-labeling iteration and persists the extracted annotations
 * to the AnnotatedPage table in the database.
 *
 * Usage:
 *   bun run scripts/run-iteration-with-save.ts [options]
 *
 * Options:
 *   --sample-size <n>    Number of pages to process (default: 10)
 *   --source <name>      Filter by source: fandom, wikipedia, comicvine
 *   --min-f1 <n>         Minimum F1 threshold to save (default: 0.3)
 *   --dry-run            Preview without saving
 *   --no-skip-existing   Process pages even if already in database
 *   --anilist-id <id>    Target a specific manga by AniList ID
 *   --all-page-types     Include all page types (not just MANGA_PAGE)
 */

import { prisma } from '@/server/db';
import { runSingleIteration } from '@/server/services/auto-labeling';
import type { SamplingFilters, LabelingAttempt } from '@/server/services/auto-labeling';
import { fetchHtmlWithFlareSolverr } from '@/server/trpc/routers/annotation/helpers';
import { createLogger } from '@/utils/logger';

const logger = createLogger('run-iteration-with-save');

// ============================================================================
// Types
// ============================================================================

interface Config {
  sampleSize: number;
  source?: 'fandom' | 'wikipedia' | 'comicvine';
  minF1Threshold: number;
  skipExisting: boolean;
  dryRun: boolean;
  anilistId?: number;
  allPageTypes: boolean;
}

interface SaveResult {
  url: string;
  mangaTitle: string;
  status: 'created' | 'updated' | 'skipped' | 'failed';
  entityCount: number;
  f1: number;
  error?: string;
}

// ============================================================================
// Helpers
// ============================================================================

function parseArgs(): Config {
  const args = process.argv.slice(2);
  const config: Config = {
    sampleSize: 10,
    minF1Threshold: 0.3,
    skipExisting: true,
    dryRun: false,
    allPageTypes: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--sample-size':
        config.sampleSize = parseInt(args[++i] ?? '10', 10);
        break;
      case '--source':
        config.source = args[++i] as 'fandom' | 'wikipedia' | 'comicvine';
        break;
      case '--min-f1':
        config.minF1Threshold = parseFloat(args[++i] ?? '0.3');
        break;
      case '--dry-run':
        config.dryRun = true;
        break;
      case '--no-skip-existing':
        config.skipExisting = false;
        break;
      case '--anilist-id':
        config.anilistId = parseInt(args[++i] ?? '0', 10);
        break;
      case '--all-page-types':
        config.allPageTypes = true;
        break;
    }
  }

  return config;
}

async function getExistingUrls(urls: string[]): Promise<Set<string>> {
  const existing = await prisma.annotatedPage.findMany({
    where: { url: { in: urls } },
    select: { url: true },
  });
  return new Set(existing.map(p => p.url));
}

function mapSourceType(source: string): 'FANDOM' | 'WIKIPEDIA' | 'COMICVINE' {
  const map: Record<string, 'FANDOM' | 'WIKIPEDIA' | 'COMICVINE'> = {
    fandom: 'FANDOM',
    wikipedia: 'WIKIPEDIA',
    comicvine: 'COMICVINE',
  };
  return map[source] ?? 'FANDOM';
}

function shouldSkipAttempt(
  attempt: LabelingAttempt,
  config: Config,
  existingUrls: Set<string>
): { skip: boolean; reason?: string } {
  if (!attempt.bootstrapResult) {
    return { skip: true, reason: 'No bootstrap result' };
  }

  const f1 = attempt.metrics?.f1 ?? 0;
  if (f1 < config.minF1Threshold) {
    return { skip: true, reason: `F1 ${(f1 * 100).toFixed(1)}% below threshold` };
  }

  if (existingUrls.has(attempt.page.url)) {
    return { skip: true, reason: 'Already in database' };
  }

  return { skip: false };
}

async function saveAttemptToDatabase(attempt: LabelingAttempt): Promise<'created' | 'updated'> {
  const { bootstrapResult } = attempt;
  if (!bootstrapResult) throw new Error('No bootstrap result');

  const sourceType = mapSourceType(attempt.page.source);
  const f1 = attempt.metrics?.f1 ?? 0;
  const entityCount = attempt.extractedEntities.length;

  const tokens = bootstrapResult.tokens.map((t, i) => ({
    id: i,
    text: t.text,
    tagName: t.tagName ?? 'span',
    xpath: t.xpath ?? '',
  }));

  const notes = [
    attempt.page.anilistId ? `AniList ID: ${attempt.page.anilistId}` : null,
    attempt.page.urlType ? `Page Type: ${attempt.page.urlType}` : null,
    `Entities: ${entityCount}`,
    `F1: ${(f1 * 100).toFixed(1)}%`,
  ].filter(Boolean).join(' | ');

  const existing = await prisma.annotatedPage.findUnique({
    where: { url: attempt.page.url },
    select: { id: true },
  });

  if (existing) {
    await prisma.annotatedPage.update({
      where: { id: existing.id },
      data: {
        tokens,
        labels: bootstrapResult.labels,
        entityCounts: bootstrapResult.stats.entityCounts,
        confidence: bootstrapResult.confidence,
        status: 'BOOTSTRAP',
        notes,
        updatedAt: new Date(),
      },
    });
    return 'updated';
  }

  const fetchResult = await fetchHtmlWithFlareSolverr(attempt.page.url, sourceType);

  await prisma.annotatedPage.create({
    data: {
      url: attempt.page.url,
      mangaTitle: attempt.page.title,
      sourceType,
      htmlSnapshot: fetchResult.html,
      tokens,
      labels: bootstrapResult.labels,
      entityCounts: bootstrapResult.stats.entityCounts,
      confidence: bootstrapResult.confidence,
      status: 'BOOTSTRAP',
      notes,
      annotatorId: null,
    },
  });
  return 'created';
}

async function processAttempt(
  attempt: LabelingAttempt,
  config: Config,
  existingUrls: Set<string>
): Promise<SaveResult> {
  const f1 = attempt.metrics?.f1 ?? 0;
  const entityCount = attempt.extractedEntities.length;

  const skipCheck = shouldSkipAttempt(attempt, config, existingUrls);
  if (skipCheck.skip) {
    return {
      url: attempt.page.url,
      mangaTitle: attempt.page.title,
      status: 'skipped',
      entityCount,
      f1,
      error: skipCheck.reason,
    };
  }

  if (config.dryRun) {
    logger.info('Dry run - would save', { title: attempt.page.title, f1: (f1 * 100).toFixed(1), entityCount });
    return {
      url: attempt.page.url,
      mangaTitle: attempt.page.title,
      status: 'created',
      entityCount,
      f1,
    };
  }

  try {
    const status = await saveAttemptToDatabase(attempt);
    logger.info('Saved annotation', { title: attempt.page.title, status, f1: (f1 * 100).toFixed(1), entityCount });
    return {
      url: attempt.page.url,
      mangaTitle: attempt.page.title,
      status,
      entityCount,
      f1,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error('Failed to save', { title: attempt.page.title, error: msg });
    return {
      url: attempt.page.url,
      mangaTitle: attempt.page.title,
      status: 'failed',
      entityCount,
      f1,
      error: msg,
    };
  }
}

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
  const config = parseArgs();

  logger.info('Starting iteration with persistence', {
    sampleSize: config.sampleSize,
    source: config.source ?? 'all',
    minF1Threshold: config.minF1Threshold,
    skipExisting: config.skipExisting,
    dryRun: config.dryRun,
    anilistId: config.anilistId ?? 'none',
    allPageTypes: config.allPageTypes,
  });

  const filters: SamplingFilters = {
    requireAnilistId: true,
    ...(config.allPageTypes ? {} : { urlTypes: ['MANGA_PAGE'] as const }),
  };
  if (config.anilistId) {
    filters.includeAnilistIds = [config.anilistId];
  }
  if (config.source) {
    filters.sources = [config.source];
    if (config.source === 'fandom') filters.requireFandomUrls = true;
    if (config.source === 'wikipedia') filters.requireWikipediaUrls = true;
  }

  const result = await runSingleIteration({ sampleSize: config.sampleSize, filters });

  logger.info('Iteration complete', {
    iterationNumber: result.iterationNumber,
    totalAttempts: result.metrics.totalAttempts,
    successfulAttempts: result.metrics.successfulAttempts,
    avgF1: `${(result.metrics.avgF1 * 100).toFixed(1)}%`,
  });

  const urls = result.attempts.map(a => a.page.url);
  const existingUrls = config.skipExisting ? await getExistingUrls(urls) : new Set<string>();

  const results: SaveResult[] = [];
  for (const attempt of result.attempts) {
    const saveResult = await processAttempt(attempt, config, existingUrls);
    results.push(saveResult);
  }

  const created = results.filter(r => r.status === 'created').length;
  const updated = results.filter(r => r.status === 'updated').length;
  const skipped = results.filter(r => r.status === 'skipped').length;
  const failed = results.filter(r => r.status === 'failed').length;

  logger.info('Persistence complete', {
    created,
    updated,
    skipped,
    failed,
    total: results.length,
    dryRun: config.dryRun,
  });

  if (skipped > 0) {
    const skippedResults = results.filter(r => r.status === 'skipped');
    logger.info('Skipped pages', {
      count: skippedResults.length,
      reasons: skippedResults.slice(0, 5).map(r => ({ title: r.mangaTitle, reason: r.error })),
    });
  }

  await prisma.$disconnect();
}

main().catch(async (error) => {
  logger.error('Script failed', { error: error instanceof Error ? error.message : String(error) });
  await prisma.$disconnect();
  process.exit(1);
});
