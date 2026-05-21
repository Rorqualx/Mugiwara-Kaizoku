/**
 * ComicVine ID Discovery Script
 *
 * Discovers real ComicVine volume IDs for manga titles in the test corpus
 * using the ComicVine API with multiple search strategies.
 */

import * as fs from 'fs';
import * as path from 'path';

import { comicvineService } from '../../src/server/services/comicvine/service';
import type { ComicVineVolume } from '../../src/server/services/comicvine/comicvine/types';
import { logger } from '../../src/utils/logger';

// Types
interface ComicVineTestManga {
  title: string;
  anilistSearch: string;
  comicvineUrl?: string;
  comicvineVolumeId?: string;
  expectedLanguage?: string;
  expectedPublisher?: string;
}

interface DiscoveredId {
  title: string;
  volumeId: number;
  url: string;
  strategy: string;
  confidence: number;
}

// Results tracking
const discoveredIds: Map<string, DiscoveredId> = new Map();
const failedTitles: string[] = [];

/**
 * Normalize title for search
 */
function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Get base title without subtitle
 */
function getBaseTitle(title: string): string {
  return title
    .replace(/\s*:.*$/, '')
    .replace(/\s*\(.+$/, '')
    .trim();
}

/**
 * Calculate match score
 */
function calculateMatchScore(
  result: ComicVineVolume,
  title: string,
  publisher: string
): number {
  let score = 0;

  if (result.name.toLowerCase() === title.toLowerCase()) {
    score += 0.8;
  } else if (result.name.toLowerCase().includes(title.toLowerCase())) {
    score += 0.4;
  }

  const resultPublisher = typeof result.publisher === 'string'
    ? result.publisher
    : result.publisher?.name ?? '';

  if (resultPublisher.toLowerCase().includes(publisher.toLowerCase())) {
    score += 0.2;
  }

  if (result.site_detail_url?.includes('/4050-')) {
    score += 0.1;
  }

  return score;
}

/**
 * Find best match in results
 */
function findBestMatch(
  results: ComicVineVolume[],
  title: string,
  publisher: string
): { volume: ComicVineVolume | null; score: number } {
  let bestMatch: ComicVineVolume | null = null;
  let bestScore = 0;

  for (const result of results) {
    const score = calculateMatchScore(result, title, publisher);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = result;
    }
  }

  return { volume: bestMatch, score: bestScore };
}

/**
 * Process search results
 */
function processSearchResults(
  results: ComicVineVolume[],
  title: string,
  publisher: string,
  strategyName: string
): DiscoveredId | null {
  if (results.length === 0) {
    logger.info(`${strategyName}: No results`);
    return null;
  }

  const { volume, score } = findBestMatch(results, title, publisher);

  if (volume && score >= 0.7) {
    logger.info(`✓ ${strategyName}: Found "${volume.name}" (ID: ${volume.id}, ${(score * 100).toFixed(0)}% confidence)`);

    return {
      title,
      volumeId: volume.id,
      url: volume.site_detail_url ?? `https://comicvine.gamespot.com/volume/${volume.id}`,
      strategy: strategyName,
      confidence: score,
    };
  }

  logger.info(`${strategyName}: No good match (${results.length} results)`);
  return null;
}

/**
 * Search with multiple strategies
 */
async function searchWithStrategies(
  title: string,
  publisher: string
): Promise<DiscoveredId | null> {
  logger.info(`Searching for: "${title}"`);

  const strategies = [
    { name: 'Direct', query: title },
    { name: 'Normalized', query: normalizeTitle(title) },
    { name: 'Base Title', query: getBaseTitle(title) },
  ];

  for (const strategy of strategies) {
    try {
      const results = await comicvineService.searchBasicVolumes(strategy.query, 0, 10);
      const discovered = processSearchResults(results, title, publisher, strategy.name);

      if (discovered) {
        return discovered;
      }
    } catch (error) {
      logger.warn(`${strategy.name}: Error - ${error instanceof Error ? error.message : String(error)}`);
    }

    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  return null;
}

/**
 * Process a single title
 */
async function processTitle(
  manga: ComicVineTestManga,
  index: number,
  total: number
): Promise<void> {
  logger.info(`[${index + 1}/${total}] ${manga.title}`);

  if (manga.comicvineVolumeId) {
    logger.info(`⊗ Already has volume ID: ${manga.comicvineVolumeId}`);
    return;
  }

  const discovered = await searchWithStrategies(
    manga.title,
    manga.expectedPublisher ?? 'Viz Media'
  );

  if (discovered) {
    discoveredIds.set(manga.title, discovered);
    manga.comicvineVolumeId = discovered.volumeId.toString();
    manga.comicvineUrl = discovered.url;
    logger.info(`✓ SUCCESS: Volume ID ${discovered.volumeId}`);
  } else {
    failedTitles.push(manga.title);
    logger.warn(`✗ FAILED: Could not find ComicVine ID`);
  }

  await new Promise(resolve => setTimeout(resolve, 3000));
}

/**
 * Process all titles
 */
async function processTitles(
  titles: ComicVineTestManga[],
  startFrom = 0
): Promise<void> {
  logger.info('ComicVine ID Discovery');
  logger.info(`Processing ${titles.length} titles from index ${startFrom}`);

  const initialized = await comicvineService.initialize();

  if (!initialized) {
    logger.error('Failed to initialize ComicVine service');
    return;
  }

  logger.info('✓ ComicVine service initialized');

  for (let i = startFrom; i < titles.length; i++) {
    await processTitle(titles[i], i, titles.length);
  }

  logger.info('SUMMARY');
  logger.info(`Successfully discovered: ${discoveredIds.size}/${titles.length}`);
  logger.info(`Failed: ${failedTitles.length}/${titles.length}`);

  if (failedTitles.length > 0) {
    logger.warn('Failed titles:');
    for (const title of failedTitles) {
      logger.warn(`  - ${title}`);
    }
  }

  updateCorpusFile(titles);
}

/**
 * Extract title from line
 */
function extractTitleFromLine(line: string): string | null {
  const titleMatch = line.match(/title:\s*'([^']+)'/);
  return titleMatch ? titleMatch[1] : null;
}

/**
 * Check if line needs comicvineUrl
 */
function needsComicVineUrl(line: string, title: string): boolean {
  const hasTitle = line.includes('title:');
  const alreadyHasUrl = line.includes('comicvineUrl');
  const isDiscovered = discoveredIds.has(title);

  return hasTitle && !alreadyHasUrl && isDiscovered;
}

/**
 * Generate comicvineUrl line
 */
function generateComicVineUrlLine(title: string): string {
  const discovered = discoveredIds.get(title);
  if (!discovered) {
    return '';
  }
  return `    comicvineUrl: '${discovered.url}',`;
}

/**
 * Update corpus file
 */
function updateCorpusFile(titles: ComicVineTestManga[]): void {
  const corpusPath = path.join(process.cwd(), 'scripts/comicvine/test-comicvine-corpus.ts');
  const content = fs.readFileSync(corpusPath, 'utf-8');
  const lines = content.split('\n');

  let inCorpus = false;
  const updatedLines: string[] = [];

  for (const line of lines) {
    updatedLines.push(line);

    if (line.includes('export const COMICVINE_TEST_CORPUS')) {
      inCorpus = true;
      continue;
    }

    if (!inCorpus) {
      continue;
    }

    const title = extractTitleFromLine(line);
    if (title && needsComicVineUrl(line, title)) {
      updatedLines.push(generateComicVineUrlLine(title));
    }
  }

  fs.writeFileSync(corpusPath, updatedLines.join('\n'));
  logger.info(`Updated corpus file: ${corpusPath}`);
}

/**
 * Parse CLI arguments
 */
function parseArgs(args: string[]) {
  const fromIndex = args.find(a => a.startsWith('--from='));
  const toIndex = args.find(a => a.startsWith('--to='));
  const singleTitle = args.find(a => a.startsWith('--title='));

  return { fromIndex, toIndex, singleTitle };
}

/**
 * Filter titles
 */
function filterTitles(
  titles: ComicVineTestManga[],
  args: ReturnType<typeof parseArgs>
): { titles: ComicVineTestManga[]; startFrom: number } {
  let startFrom = 0;
  let titlesToProcess = titles;

  if (args.singleTitle) {
    const searchTitle = args.singleTitle.split('=')[1];
    titlesToProcess = titles.filter(m =>
      m.title.toLowerCase().includes(searchTitle.toLowerCase())
    );
    logger.info(`Processing single title match: "${searchTitle}"`);
  } else if (args.fromIndex) {
    startFrom = parseInt(args.fromIndex.split('=')[1], 10);
    logger.info(`Starting from index ${startFrom}`);
  }

  if (args.toIndex) {
    const end = parseInt(args.toIndex.split('=')[1], 10);
    titlesToProcess = titlesToProcess.slice(0, end - startFrom);
  }

  return { titles: titlesToProcess, startFrom };
}

/**
 * Main function
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const corpusPath = path.join(process.cwd(), 'scripts/comicvine/test-comicvine-corpus.ts');

  const corpusModule = await import(corpusPath);
  const titles: ComicVineTestManga[] = corpusModule.COMICVINE_TEST_CORPUS;

  const parsedArgs = parseArgs(args);
  const { titles: titlesToProcess, startFrom } = filterTitles(titles, parsedArgs);

  await processTitles(titlesToProcess, startFrom);
}

main().catch(console.error);
