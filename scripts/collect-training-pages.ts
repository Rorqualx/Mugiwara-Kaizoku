/**
 * Training Data Collection Script
 *
 * Collects pages from Fandom, Wikipedia, AniList, and ComicVine
 * for the 400+ manga titles in the training dataset.
 *
 * Usage:
 *   bun run scripts/collect-training-pages.ts [--limit=N] [--source=fandom|wikipedia|all]
 */

import { Prisma, PrismaClient } from '@prisma/client';

import { linearizeDOM } from '../src/server/ml/features/dom-linearizer';
import { TRAINING_TITLES } from '../src/server/ml/training/training-titles';
import { logger } from '../src/utils/logger';

import type { MangaTitle } from '../src/server/ml/training/training-titles';

// ============================================================================
// Types
// ============================================================================

type SourceType = 'FANDOM' | 'WIKIPEDIA' | 'ANILIST' | 'COMICVINE';

interface CollectionResult {
  title: string;
  source: SourceType;
  url: string;
  success: boolean;
  tokenCount: number;
  error?: string;
}

interface CollectionStats {
  total: number;
  successful: number;
  failed: number;
  bySource: Record<SourceType, number>;
}

// ============================================================================
// URL Builders
// ============================================================================

function buildFandomUrl(title: string): string {
  const slug = title.replace(/[:\s]+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
  return `https://${slug.toLowerCase()}.fandom.com/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;
}

function buildWikipediaUrl(title: string): string {
  return `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}_(manga)`;
}

function buildAnilistUrl(title: string): string {
  return `https://anilist.co/search/manga?search=${encodeURIComponent(title)}`;
}

function buildComicvineUrl(title: string): string {
  return `https://comicvine.gamespot.com/search/?q=${encodeURIComponent(title)}&i=volume`;
}

// ============================================================================
// Fetchers
// ============================================================================

async function fetchPage(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MangaTrainingBot/1.0)',
        Accept: 'text/html',
      },
    });

    if (!response.ok) {
      logger.warn('Failed to fetch page', { url, status: response.status });
      return null;
    }

    return await response.text();
  } catch (error) {
    logger.error('Error fetching page', { url, error });
    return null;
  }
}

// ============================================================================
// Main Collection Function
// ============================================================================

async function collectPage(
  prisma: PrismaClient,
  manga: MangaTitle,
  source: SourceType
): Promise<CollectionResult> {
  const urlBuilders: Record<SourceType, (title: string) => string> = {
    FANDOM: buildFandomUrl,
    WIKIPEDIA: buildWikipediaUrl,
    ANILIST: buildAnilistUrl,
    COMICVINE: buildComicvineUrl,
  };

  const url = urlBuilders[source](manga.title);
  logger.info('Collecting page', { source, title: manga.title, url });

  const html = await fetchPage(url);
  if (!html) {
    return { title: manga.title, source, url, success: false, tokenCount: 0, error: 'Fetch failed' };
  }

  try {
    const result = linearizeDOM(html, url);
    const tokenCount = result.tokens.length;

    // Use atomic create with unique constraint error handling to prevent race conditions
    // Instead of check-then-create, we try to create directly and catch unique violations
    try {
      await prisma.annotatedPage.create({
        data: {
          url,
          mangaTitle: manga.title,
          sourceType: source,
          htmlSnapshot: html,
          tokens: result.tokens,
          labels: result.tokens.map(() => 'O'),
          status: 'BOOTSTRAP',
        },
      });
      logger.info('Page saved', { title: manga.title, source, tokenCount });
    } catch (createError) {
      // Handle race condition: unique constraint violation means URL already exists
      if (createError instanceof Prisma.PrismaClientKnownRequestError && createError.code === 'P2002') {
        logger.info('Page already exists (race condition handled)', { url });
      } else {
        throw createError;
      }
    }

    return { title: manga.title, source, url, success: true, tokenCount };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error processing page', { title: manga.title, source, error: errorMsg });
    return { title: manga.title, source, url, success: false, tokenCount: 0, error: errorMsg };
  }
}

async function collectTrainingData(
  sources: SourceType[] = ['FANDOM', 'WIKIPEDIA'],
  limit?: number
): Promise<CollectionStats> {
  const prisma = new PrismaClient();
  const stats: CollectionStats = {
    total: 0,
    successful: 0,
    failed: 0,
    bySource: { FANDOM: 0, WIKIPEDIA: 0, ANILIST: 0, COMICVINE: 0 },
  };

  const titles = limit ? TRAINING_TITLES.slice(0, limit) : TRAINING_TITLES;

  logger.info('Starting training data collection', { titleCount: titles.length, sources });

  for (const manga of titles) {
    for (const source of sources) {
      stats.total++;
      const result = await collectPage(prisma, manga, source);

      if (result.success) {
        stats.successful++;
        stats.bySource[source]++;
      } else {
        stats.failed++;
      }

      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  await prisma.$disconnect();
  return stats;
}

// ============================================================================
// CLI Entry Point
// ============================================================================

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  let limit: number | undefined;
  let sources: SourceType[] = ['FANDOM', 'WIKIPEDIA'];

  for (const arg of args) {
    if (arg.startsWith('--limit=')) {
      limit = parseInt(arg.split('=')[1], 10);
    } else if (arg.startsWith('--source=')) {
      const sourceArg = arg.split('=')[1].toUpperCase();
      if (sourceArg === 'ALL') {
        sources = ['FANDOM', 'WIKIPEDIA', 'ANILIST', 'COMICVINE'];
      } else {
        sources = [sourceArg as SourceType];
      }
    }
  }

  logger.info('ML Training Data Collection started', { limit, sources });

  const stats = await collectTrainingData(sources, limit);

  logger.info('Collection complete', {
    total: stats.total,
    successful: stats.successful,
    failed: stats.failed,
    bySource: stats.bySource,
  });
}

main().catch((error) => logger.error('Collection failed', { error }));
