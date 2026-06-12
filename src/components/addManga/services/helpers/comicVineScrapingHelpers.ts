import { logger } from '@/utils/logger';

/**
 * Helper functions for scrapeComicVineSeriesData
 * Extracted to reduce complexity and improve maintainability
 */

interface VolumeUrl {
  volumeNumber: number;
  url: string;
}

export interface VolumeData {
  volumeNumber: number;
  title: string;
  url: string;
  coverImageUrl: string | null;
  chapters: unknown[];
  chapterCount: number;
  status: string;
  description?: string;
  volumeSummary?: string;
}

interface ScrapedVolume {
  volumeNumber: number;
  volumeTitle?: string;
  volumeSummary?: string;
  coverImage?: string;
  chapters?: unknown[];
}

/**
 * Initialize volume data from scraped URLs
 */
export function initializeVolumeData(volumeUrls: VolumeUrl[]): VolumeData[] {
  return volumeUrls.map((v: VolumeUrl) => ({
    volumeNumber: v.volumeNumber,
    title: `Volume ${v.volumeNumber}`,
    url: v.url,
    coverImageUrl: null,
    chapters: [],
    chapterCount: 0,
    status: 'pending_scrape'
  }));
}

/**
 * Process a chunk of volume URLs
 */
export async function processVolumeChunk(
  chunk: string[],
  chunkIndex: number,
  totalChunks: number,
  scrapeChaptersMutation: { mutateAsync: (params: Record<string, unknown>) => Promise<unknown> }
): Promise<unknown[]> {
  logger.info(`[ComicVine] Scraping batch ${chunkIndex + 1}/${totalChunks}`);

  const chunkResponse = await scrapeChaptersMutation.mutateAsync({
    volumeUrls: chunk
  });

  const chunkData = chunkResponse as Record<string, unknown>;
  return (chunkData['volumes'] ?? []) as unknown[];
}

/**
 * Add minimal delay between chunk processing
 */
export async function addProcessingDelay(hasMoreChunks: boolean): Promise<void> {
  if (hasMoreChunks) {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 50);
    });
  }
}

/**
 * Update volume data with scraped information
 */
export function updateVolumeWithScrapedData(
  volumeData: VolumeData[],
  scrapedVolume: ScrapedVolume
): VolumeData[] {
  const volumeIndex = scrapedVolume.volumeNumber - 1;
  if (!volumeData[volumeIndex]) {
    return volumeData;
  }

  logger.info(`[ComicVine] Volume ${scrapedVolume.volumeNumber} scraped data:`, {
    hasTitle: !!scrapedVolume.volumeTitle,
    hasCoverImage: !!scrapedVolume.coverImage,
    coverImageUrl: scrapedVolume.coverImage,
    chapterCount: (scrapedVolume.chapters ?? []).length,
    firstChapter: ((scrapedVolume.chapters ?? []) as Record<string, unknown>[])[0]?.['title']
  });

  const updatedVolumes = [...volumeData];
  const existingVol = updatedVolumes[volumeIndex];

  // Type guard: ensure existingVol exists at runtime
  if (existingVol === undefined) {
    return volumeData;
  }

  const updatedData: VolumeData = {
    volumeNumber: existingVol.volumeNumber,
    title: scrapedVolume.volumeTitle ?? existingVol.title,
    url: existingVol.url,
    coverImageUrl: scrapedVolume.coverImage ?? existingVol.coverImageUrl,
    chapters: scrapedVolume.chapters ?? [],
    chapterCount: (scrapedVolume.chapters ?? []).length,
    status: 'scraped'
  };

  if (scrapedVolume.volumeSummary !== undefined) {
    updatedData.description = scrapedVolume.volumeSummary;
    updatedData.volumeSummary = scrapedVolume.volumeSummary;
  }

  updatedVolumes[volumeIndex] = updatedData;

  logger.info(`[ComicVine] Volume ${scrapedVolume.volumeNumber} updated in volumeData:`, {
    title: updatedData.title,
    coverImageUrl: updatedData.coverImageUrl,
    chapterCount: updatedData.chapterCount,
    status: updatedData.status,
    hasDescription: !!updatedData.description,
    descriptionLength: updatedData.description?.length ?? 0
  });

  return updatedVolumes;
}

/**
 * Check if chapter 0 exists in scraped data
 */
export function hasChapterZero(chapters: unknown[]): boolean {
  return chapters.some((ch: unknown) => {
    const chapter = ch as Record<string, unknown>;
    return (
      chapter['number'] === '0' ||
      chapter['number'] === 0 ||
      (chapter['title'] as string).toLowerCase().includes('chapter 0') ||
      (chapter['title'] as string).toLowerCase().includes('chapter zero')
    );
  });
}

/**
 * Find the lowest non-zero chapter number
 */
export function findLowestChapterNumber(chapters: unknown[]): number {
  const nonZeroChapters = chapters.filter((ch: unknown) => {
    const chapter = ch as Record<string, unknown>;
    return chapter['number'] !== '0' && chapter['number'] !== 0;
  });

  return Math.min(
    ...nonZeroChapters.map((ch: unknown) => {
      const chapter = ch as Record<string, unknown>;
      return parseInt(chapter['number'] as string) || 999;
    })
  );
}

/**
 * Verify chapter count with chapter 0 detection
 */
export function verifyChapterCount(chapters: unknown[]): void {
  const hasZero = hasChapterZero(chapters);
  const lowestNum = findLowestChapterNumber(chapters);

  if (hasZero && lowestNum === 1) {
    const uniqueChapterNumbers = new Set(
      chapters.map((ch: unknown) => (ch as Record<string, unknown>)['number'])
    );
    if (uniqueChapterNumbers.has('0') || uniqueChapterNumbers.has(0)) {
      logger.info('[ComicVine] Chapter 0 detected in scraped data, verifying count');
    }
  }
}

/**
 * Aggregate chapters from scraped volumes
 */
export function aggregateChapters(
  scrapedChapterData: unknown[],
  scrapedVolumes: unknown[]
): void {
  for (const scrapedVolumeRaw of scrapedVolumes) {
    const scrapedVolume = scrapedVolumeRaw as ScrapedVolume;
    if (scrapedVolume.chapters) {
      scrapedChapterData.push(...scrapedVolume.chapters);
    }
  }
}

/**
 * Process all scraped volumes and update volume data
 */
export function processScrapedVolumes(
  volumeData: VolumeData[],
  scrapedChapterData: unknown[],
  allVolumeChapters: unknown[]
): VolumeData[] {
  logger.info(`[ComicVine] Processing ${allVolumeChapters.length} scraped volumes`);

  let updatedVolumeData = [...volumeData];

  for (const scrapedVolumeRaw of allVolumeChapters) {
    const scrapedVolume = scrapedVolumeRaw as ScrapedVolume;
    updatedVolumeData = updateVolumeWithScrapedData(updatedVolumeData, scrapedVolume);
  }

  aggregateChapters(scrapedChapterData, allVolumeChapters);
  verifyChapterCount(scrapedChapterData);

  return updatedVolumeData;
}
