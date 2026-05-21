/**
 * ComicVine Batch Scraper
 *
 * Scrapes multiple volumes from a series and aggregates all chapters.
 *
 * Pipeline:
 * 1. Get volume list from API (fast, ~1 second)
 * 2. For each volume, scrape HTML page for chapters (slow, 20-60s per volume)
 * 3. Aggregate all chapters across volumes
 *
 * Usage:
 *   bun scripts/comicvine/batch-scraper.ts <seriesVolumeId> [maxVolumes]
 */

import { comicvineService } from '@/server/services/comicvine/service';
import { logger } from '@/utils/logger';
import { ComicVineScrapingService } from '@/server/services/comicvine/scrapingService';
import type { ComicVineIssue, ComicVineVolume } from '@/server/services/comicvine/comicvine/types';

interface VolumeScrapeResult {
  volumeId: string;
  volumeNumber: number;
  volumeTitle: string;
  volumeUrl: string;

  // API metadata
  hasCoverImage: boolean;
  hasDescription: boolean;
  hasIssueDate: boolean;
  issueDate?: string;

  // Scraped metadata
  chaptersFound: number;
  chapterTitles: string[];
  themes: string[];
  genres: string[];

  // Quality metrics
  scrapeSuccess: boolean;
  scrapeTime: number;
  errorMessage?: string;
}

interface BatchScrapeResult {
  seriesTitle: string;
  totalVolumes: number;
  volumesScraped: number;
  volumesFailed: number;

  // Aggregate metrics
  totalChapters: number;
  totalThemes: string[];
  totalGenres: string[];

  // Per-volume results
  volumeResults: VolumeScrapeResult[];

  // Timing
  totalTime: number;
  averageScrapeTime: number;
}

/**
 * Scrape a single volume with error handling and timing
 */
async function scrapeSingleVolume(
  volume: ComicVineIssue,
  scraper: ComicVineScrapingService
): Promise<VolumeScrapeResult> {
  const startTime = Date.now();
  const volumeId = String(volume.id);
  const volumeNumber = parseInt(volume.issue_number ?? '0', 10);
  const volumeTitle = volume.name ?? `Volume ${volumeNumber}`;
  const volumeUrl = volume.site_detail_url ?? '';

  logger.info(`\n[${volumeNumber}] Scraping: ${volumeTitle}`);
  logger.info(`    URL: ${volumeUrl}`);

  const result: VolumeScrapeResult = {
    volumeId,
    volumeNumber,
    volumeTitle,
    volumeUrl,

    // API metadata
    hasCoverImage: !!volume.image,
    hasDescription: !!volume.description,
    hasIssueDate: !!(volume.cover_date || volume.store_date),
    issueDate: volume.cover_date || volume.store_date,

    // Scraped metadata (to be filled)
    chaptersFound: 0,
    chapterTitles: [],
    themes: [],
    genres: [],

    // Quality metrics
    scrapeSuccess: false,
    scrapeTime: 0,
  };

  try {
    if (!volumeUrl) {
      throw new Error('No site_detail_url available');
    }

    // Scrape the volume page
    const volumeData = await scraper.scrapeVolumeChapters(volumeUrl);

    if (!volumeData) {
      throw new Error('Scraping returned null');
    }

    // Extract scraped data
    result.chaptersFound = volumeData.chapters.length;
    result.chapterTitles = volumeData.chapters.map((ch) => ch.title);
    result.themes = volumeData.themes ?? [];
    result.genres = volumeData.genres ?? [];
    result.scrapeSuccess = true;

    logger.info(`    ✓ Found ${result.chaptersFound} chapters`);
    if (result.themes.length > 0) {
      logger.info(`    ✓ Themes: ${result.themes.join(', ')}`);
    }
    if (result.genres.length > 0) {
      logger.info(`    ✓ Genres: ${result.genres.join(', ')}`);
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    result.errorMessage = errorMessage;
    logger.error(`    ✗ Failed: ${errorMessage}`);
  }

  result.scrapeTime = Date.now() - startTime;
  logger.info(`    Time: ${result.scrapeTime / 1000}s`);

  return result;
}

/**
 * Batch scrape multiple volumes from a series
 */
export async function batchScrapeSeries(
  seriesVolumeId: number,
  options: {
    maxVolumes?: number;
    onProgress?: (current: number, total: number, result: VolumeScrapeResult) => void;
  } = {}
): Promise<BatchScrapeResult> {
  const startTime = Date.now();
  const { maxVolumes, onProgress } = options;

  logger.info(`\n=== ComicVine Batch Scraper ===`);
  logger.info(`Series Volume ID: ${seriesVolumeId}`);
  logger.info(`Max Volumes: ${maxVolumes ?? 'all'}\n`);

  // Initialize services
  const initialized = await comicvineService.initialize();
  if (!initialized) {
    throw new Error('Failed to initialize ComicVine service');
  }

  // Phase 1: Get volume list from API (fast)
  logger.info('Phase 1: Fetching volume list from API...');
  const volumeInfo = await comicvineService.getCompleteVolumeInfo(seriesVolumeId);
  if (!volumeInfo) {
    throw new Error('Failed to fetch series volume info');
  }

  const allIssues = await comicvineService.getAllVolumeIssues(seriesVolumeId);
  logger.info(`✓ Found ${allIssues.length} volumes in series: ${volumeInfo.name}`);

  const volumesToProcess = maxVolumes ? allIssues.slice(0, maxVolumes) : allIssues;
  logger.info(`Processing ${volumesToProcess.length} volumes (maxVolumes=${maxVolumes ?? 'none'})\n`);

  // Phase 2: Scrape each volume (slow)
  logger.info('Phase 2: Scraping individual volume pages...\n');
  const scraper = new ComicVineScrapingService();
  const volumeResults: VolumeScrapeResult[] = [];

  for (let i = 0; i < volumesToProcess.length; i++) {
    const volume = volumesToProcess[i];
    const result = await scrapeSingleVolume(volume, scraper);
    volumeResults.push(result);

    // Call progress callback
    onProgress?.(i + 1, volumesToProcess.length, result);

    // Small delay between scrapes to be nice to the server
    if (i < volumesToProcess.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  // Phase 3: Aggregate results
  const totalTime = Date.now() - startTime;
  const successfulScrapes = volumeResults.filter((r) => r.scrapeSuccess);
  const failedScrapes = volumeResults.filter((r) => !r.scrapeSuccess);

  const allThemes = new Set<string>();
  const allGenres = new Set<string>();
  let totalChapters = 0;

  successfulScrapes.forEach((result) => {
    result.themes.forEach((t) => allThemes.add(t));
    result.genres.forEach((g) => allGenres.add(g));
    totalChapters += result.chaptersFound;
  });

  const batchResult: BatchScrapeResult = {
    seriesTitle: volumeInfo.name ?? 'Unknown',
    totalVolumes: volumesToProcess.length,
    volumesScraped: successfulScrapes.length,
    volumesFailed: failedScrapes.length,

    totalChapters,
    totalThemes: Array.from(allThemes),
    totalGenres: Array.from(allGenres),

    volumeResults,

    totalTime,
    averageScrapeTime: totalTime / volumesToProcess.length,
  };

  // Print summary
  logger.info('\n=== Batch Scrape Summary ===');
  logger.info(`Series: ${batchResult.seriesTitle}`);
  logger.info(`Volumes: ${batchResult.volumesScraped}/${batchResult.totalVolumes} successful`);
  logger.info(`Failed: ${batchResult.volumesFailed}`);
  logger.info(`Total Chapters Found: ${batchResult.totalChapters}`);
  logger.info(`Unique Themes: ${batchResult.totalThemes.length}`);
  logger.info(`Unique Genres: ${batchResult.totalGenres.length}`);
  logger.info(`Total Time: ${(batchResult.totalTime / 1000 / 60).toFixed(1)} minutes`);
  logger.info(`Average per Volume: ${(batchResult.averageScrapeTime / 1000).toFixed(1)} seconds`);

  if (failedScrapes.length > 0) {
    logger.info('\n=== Failed Volumes ===');
    failedScrapes.forEach((result) => {
      logger.info(`  Vol ${result.volumeNumber}: ${result.errorMessage}`);
    });
  }

  return batchResult;
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('Usage: bun batch-scraper.ts <seriesVolumeId> [maxVolumes]');
    console.error('Example: bun batch-scraper.ts 18836 5');
    process.exit(1);
  }

  const seriesVolumeId = parseInt(args[0], 10);
  const maxVolumes = args[1] ? parseInt(args[1], 10) : undefined;

  if (isNaN(seriesVolumeId)) {
    console.error('Error: seriesVolumeId must be a number');
    process.exit(1);
  }

  try {
    const result = await batchScrapeSeries(seriesVolumeId, {
      maxVolumes,
      onProgress: (current, total, volumeResult) => {
        logger.info(`Progress: ${current}/${total} (${Math.round((current / total) * 100)}%)`);
      },
    });

    // Save results to file
    const outputPath = `docs/research/comicvine-accuracy/batch-scrape-${seriesVolumeId}.json`;
    await Bun.write(outputPath, JSON.stringify(result, null, 2));
    logger.info(`\nResults saved to: ${outputPath}`);

  } catch (error) {
    logger.error('Batch scrape failed:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.main) {
  main()
    .catch(logger.error)
    .finally(() => process.exit(0));
}
