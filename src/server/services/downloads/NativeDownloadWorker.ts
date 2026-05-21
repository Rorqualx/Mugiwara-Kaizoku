/**
 * Native Download Worker
 *
 * Processes Native chapter downloads using configured website selectors.
 * Integrates with the Job queue system for activity tracking and progress updates.
 *
 * Features:
 * - Fetches chapter pages using WebScraper
 * - Extracts download links via CSS selectors
 * - Downloads images with rate limiting
 * - Creates CBZ archives
 * - Updates Job and Chapter records
 * - Handles errors and retries
 *
 * @module server/services/downloads/NativeDownloadWorker
 */


import { JobStatus, NativeDownloadStatus, ChapterStatus } from '@prisma/client';

import { prisma } from '@/server/db';
import type { NativeDownloadProviderConfig } from '@/types/adapters/native-download-types';
import { logger } from '@/utils/logger';


import { WebScraper } from '../metadata/scrapers/WebScraper';

import { ChapterFileManager } from './ChapterFileManager';

/**
 * Download result interface
 */
interface DownloadResult {
  success: boolean;
  filePath?: string;
  fileSize?: number;
  pageCount?: number;
  error?: string;
}

/**
 * Options for executing a download
 */
interface ExecuteDownloadOptions {
  sourceConfig: NativeDownloadProviderConfig;
  chapterId: string;
  mangaId: number;
  chapterNumber: number;
  onProgress: (progress: number) => void;
}

/**
 * Options for updating chapter record
 */
interface UpdateChapterRecordOptions {
  mangaId: number;
  chapterNumber: number;
  filePath: string;
  fileSize?: number | undefined;
  pageCount?: number | undefined;
}

/**
 * Job payload structure for Native downloads
 */
interface NativeDownloadJobPayload {
  downloadId: string;
  sourceId: string;
  chapterId: string;
  chapterNumber: number;
}

/**
 * Job record structure from database (simplified from Prisma result)
 * Uses interface instead of type to be compatible with Prisma result
 */
interface JobRecord {
  id: bigint;
  partition_key: string;
  payload: unknown;
  progress: number | null;
  manga: {
    id: number;
    title: string;
  } | null;
}

/**
 * Native Download Worker
 */
export class NativeDownloadWorker {
  private fileManager: ChapterFileManager;
  private isRunning = false;
  private pollInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.fileManager = new ChapterFileManager();
  }

  /**
   * Start the worker polling loop
   */
  start(): void {
    if (this.isRunning) {
      logger.warn('NativeDownloadWorker already running');
      return;
    }

    this.isRunning = true;
    logger.info('Starting NativeDownloadWorker');

    // Poll for pending jobs every 5 seconds
    this.pollInterval = setInterval(() => {
      void this.processPendingJobs();
    }, 5000);

    // Process immediately on start
    void this.processPendingJobs();
  }

  /**
   * Stop the worker
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }

    logger.info('Stopped NativeDownloadWorker');
  }

  /**
   * Process all pending Native download jobs
   */
  private async processPendingJobs(): Promise<void> {
    try {
      // Find pending Native download jobs
      const jobs = await prisma.jobs.findMany({
        where: {
          job_type: 'native_download',
          status: JobStatus.pending,
          queue_name: 'native'
        },
        orderBy: [
          { priority: 'desc' },
          { created_at: 'asc' }
        ],
        take: 1, // Process one at a time for now
        include: {
          manga: {
            select: {
              id: true,
              title: true
            }
          }
        }
      });

      // Process jobs sequentially to respect priority ordering and prevent race conditions
      // with file system operations and database updates
      for (const job of jobs) {
        // Extract only the fields we need to satisfy JobRecord interface
        const jobRecord: JobRecord = {
          id: job.id,
          partition_key: job.partition_key,
          payload: job.payload,
          progress: job.progress,
          manga: job.manga
        };
        // Sequential processing required for download jobs to prevent file system race conditions
        // eslint-disable-next-line no-await-in-loop
        await this.processJob(jobRecord);
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Error processing pending jobs', errorMessage);
    }
  }

  /**
   * Process a single download job
   */
  private async processJob(job: JobRecord): Promise<void> {
    const jobId = String(job.id);
    const payload = job.payload as NativeDownloadJobPayload;

    logger.info(`Processing Native download job ${jobId}`, payload);

    try {
      // Mark job as active
      await this.updateJobStatus({
        jobId: job.id,
        partitionKey: job.partition_key,
        status: JobStatus.active,
        progress: 0
      });

      // Fetch download details
      const download = await prisma.nativeDownload.findUnique({
        where: { id: payload.downloadId }
      });

      if (!download) {
        throw new Error(`Download ${payload.downloadId} not found`);
      }

      // Update download status
      await prisma.nativeDownload.update({
        where: { id: download.id },
        data: { status: NativeDownloadStatus.DOWNLOADING }
      });

      // Execute the download using sourceType
      // Note: Custom source configs have been removed. For MangaDex and GetComics,
      // use their dedicated handlers instead. This worker only handles legacy downloads.
      const sourceType = download.sourceType ?? 'unknown';

      // Create a minimal config for legacy compatibility
      // Downloads without proper source config will fail gracefully
      const emptySelector = { css: '', extract: 'text' as const };
      const legacyConfig: NativeDownloadProviderConfig = {
        id: download.sourceId ?? 'legacy',
        name: sourceType,
        baseUrl: '',
        searchUrl: '',
        enabled: false, // Legacy downloads are effectively disabled
        selectors: {
          searchResults: { container: '', id: emptySelector, title: emptySelector, coverUrl: emptySelector, url: emptySelector },
          mangaDetails: { title: emptySelector, description: emptySelector, coverUrl: emptySelector },
          chapterList: { container: '', chapterId: emptySelector, chapterNumber: emptySelector, chapterTitle: emptySelector, chapterUrl: emptySelector },
          downloadLinks: { imageContainer: '', imageUrl: emptySelector }
        },
        type: sourceType
      };

      const result = await this.executeDownload({
        sourceConfig: legacyConfig,
        chapterId: payload.chapterId,
        mangaId: download.mangaId,
        chapterNumber: payload.chapterNumber,
        onProgress: (progress) => {
          // Update job progress in real-time
          void this.updateJobStatus({
            jobId: job.id,
            partitionKey: job.partition_key,
            status: JobStatus.active,
            progress
          });
        }
      });

      if (result.success && result.filePath) {
        // Update download record
        await prisma.nativeDownload.update({
          where: { id: download.id },
          data: {
            status: NativeDownloadStatus.COMPLETED,
            progress: 100,
            endTime: new Date(),
            destinationPath: result.filePath
          }
        });

        // Update or create Chapter record
        await this.updateChapterRecord({
          mangaId: download.mangaId,
          chapterNumber: payload.chapterNumber,
          filePath: result.filePath,
          fileSize: result.fileSize,
          pageCount: result.pageCount
        });

        // Mark job as completed
        await this.updateJobStatus({
          jobId: job.id,
          partitionKey: job.partition_key,
          status: JobStatus.completed,
          progress: 100,
          result: {
            filePath: result.filePath,
            fileSize: result.fileSize,
            pageCount: result.pageCount
          }
        });

        logger.info(`Successfully completed download job ${jobId}`);
      } else {
        throw new Error(result.error ?? 'Download failed');
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to process job ${jobId}`, errorMessage);

      // Update download status
      await prisma.nativeDownload.update({
        where: { id: payload.downloadId },
        data: {
          status: NativeDownloadStatus.FAILED,
          endTime: new Date(),
          error: errorMessage
        }
      }).catch(() => {
        // Ignore update errors
      });

      // Mark job as failed
      await this.updateJobStatus({
        jobId: job.id,
        partitionKey: job.partition_key,
        status: JobStatus.failed,
        progress: job.progress ?? 0,
        error: { message: errorMessage }
      });
    }
  }

  /**
   * Execute the chapter download
   */
  private async executeDownload(options: ExecuteDownloadOptions): Promise<DownloadResult> {
    const { sourceConfig, chapterId, mangaId, chapterNumber, onProgress } = options;
    try {
      // Create WebScraper instance
      const scraper = new WebScraper(sourceConfig);

      // Build chapter URL
      const chapterUrl = `${sourceConfig.baseUrl}/chapter/${chapterId}`;

      logger.info(`Fetching chapter page: ${chapterUrl}`);

      // Fetch the chapter page HTML
      const html = await scraper.fetchPage(chapterUrl);

      onProgress(10); // 10% - page fetched

      // Extract download links using configured selectors
      const downloadLinks = await scraper.extractDownloadLinks(html);

      if (downloadLinks.length === 0) {
        throw new Error('No download links found - check your selectors');
      }

      logger.info(`Found ${downloadLinks.length} images to download`);

      onProgress(20); // 20% - links extracted

      // Download images and create CBZ
      const result = await this.fileManager.downloadAndCreateCBZ(
        downloadLinks,
        mangaId,
        chapterNumber,
        (imageProgress) => {
          // Map image download progress (20% → 100%)
          const totalProgress = 20 + (imageProgress * 0.8);
          onProgress(Math.floor(totalProgress));
        }
      );

      return {
        success: true,
        filePath: result.filePath,
        fileSize: result.fileSize,
        pageCount: result.pageCount
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Download execution failed', errorMessage);
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Update Chapter record after successful download
   */
  private async updateChapterRecord(options: UpdateChapterRecordOptions): Promise<void> {
    const { mangaId, chapterNumber, filePath, fileSize, pageCount } = options;
    try {
      // Try to find existing chapter by manga + number
      const existingChapter = await prisma.chapter.findFirst({
        where: {
          mangaId,
          chapterNumber
        }
      });

      if (existingChapter) {
        // Update existing chapter
        await prisma.chapter.update({
          where: { id: existingChapter.id },
          data: {
            downloadStatus: ChapterStatus.COMPLETED,
            filePath,
            size: fileSize ?? existingChapter.size,
            pageCount: pageCount ?? existingChapter.pageCount,
            updatedAt: new Date()
          }
        });
        logger.info(`Updated chapter ${existingChapter.id} with download info`);
      } else {
        // Create new chapter record
        const manga = await prisma.manga.findUnique({
          where: { id: mangaId },
          select: { title: true }
        });

        await prisma.chapter.create({
          data: {
            mangaId,
            chapterNumber,
            number: chapterNumber,
            title: `Chapter ${chapterNumber}`,
            fileName: `${manga?.title ?? 'Unknown'} - Chapter ${chapterNumber}.cbz`,
            index: Math.floor(chapterNumber * 10), // Simple index calculation
            downloadStatus: ChapterStatus.COMPLETED,
            filePath,
            size: fileSize ?? 0,
            pageCount: pageCount ?? 0,
            updatedAt: new Date()
          }
        });
        logger.info(`Created new chapter record for chapter ${chapterNumber}`);
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to update chapter record', errorMessage);
      // Don't throw - download succeeded even if chapter update failed
    }
  }

  /**
   * Update job status and progress
   */
  private async updateJobStatus(options: {
    jobId: bigint;
    partitionKey: string;
    status: JobStatus;
    progress: number;
    result?: unknown;
    error?: unknown;
  }): Promise<void> {
    const { jobId, partitionKey, status, progress, result, error } = options;
    try {
      const updateData: Record<string, unknown> = {
        status,
        progress
      };

      if (status === JobStatus.active && !updateData['startedAt']) {
        updateData['startedAt'] = new Date();
      }

      if (status === JobStatus.completed || status === JobStatus.failed) {
        updateData['completedAt'] = new Date();

        const startedAt = updateData['startedAt'];
        if (startedAt instanceof Date) {
          const processingTime = Date.now() - startedAt.getTime();
          updateData['processingTimeMs'] = processingTime;
        }
      }

      if (result !== undefined) {
        updateData['result'] = result;
      }

      if (error !== undefined) {
        updateData['lastError'] = error;
      }

      await prisma.jobs.update({
        where: {
          id_partition_key: {
            id: jobId,
            partition_key: partitionKey
          }
        },
        data: updateData
      });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logger.error(`Failed to update job ${String(jobId)} status`, errorMessage);
    }
  }
}

// Singleton instance
let workerInstance: NativeDownloadWorker | null = null;

/**
 * Get the singleton worker instance
 */
export function getNativeDownloadWorker(): NativeDownloadWorker {
  workerInstance ??= new NativeDownloadWorker();
  return workerInstance;
}

/**
 * Start the Native download worker
 */
export function startNativeDownloadWorker(): void {
  const worker = getNativeDownloadWorker();
  worker.start();
}

/**
 * Stop the Native download worker
 */
export function stopNativeDownloadWorker(): void {
  if (workerInstance) {
    workerInstance.stop();
  }
}
