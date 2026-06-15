/**
 * Library Job Handlers
 *
 * Handles background library scanning jobs with real-time progress updates.
 * Supports auto-matching metadata with fallback to manual matching.
 */

import { access, constants } from 'fs/promises';

import { jobs } from '@prisma/client';
import { z } from 'zod';

import type { WebSocketService } from '@/server/api/services/websocket-service';
import { prisma } from '@/server/db';
import { healArchiveCoveredChaptersSweep } from '@/server/services/download/download-monitor/chapter-manager';
import { EnhancedScanner } from '@/server/services/library/scanner';
import { isSuccess, isError } from '@/utils/async-result';
import { logger } from '@/utils/logger';


/**
 * Get the WebSocket service instance.
 * In production, the module-level export may be null due to timing issues
 * (the service is created after Next.js bundles the modules).
 * This helper always checks the global instance first.
 */
function getWebSocketService(): WebSocketService | null {
  // Always prefer the global instance (set by production server)
  if (global.__websocketService) {
    return global.__websocketService;
  }
  // In development mode, the module export should be available
  // We don't use dynamic import here because the global should always be set
  // when the queue worker runs (after server initialization)
  return null;
}

/**
 * Check if a path is accessible within a timeout.
 * Prevents blocking the event loop on slow/unresponsive network volumes.
 *
 * @param path - Path to check accessibility
 * @param timeoutMs - Timeout in milliseconds (default: 5000ms)
 * @returns True if path is accessible, false otherwise
 */
async function isPathAccessible(path: string, timeoutMs = 5000): Promise<boolean> {
  try {
    await Promise.race([
      access(path, constants.R_OK),
      new Promise<never>((_, reject) => {
        setTimeout(() => { reject(new Error(`Path accessibility check timed out after ${timeoutMs}ms`)); }, timeoutMs);
      })
    ]);
    return true;
  } catch (error) {
    logger.warn('Path accessibility check failed', {
      path,
      error: error instanceof Error ? error.message : String(error)
    });
    return false;
  }
}

// Zod schema for library scan job payload
const LibraryScanPayloadSchema = z.object({
  libraryId: z.number().optional(),
  path: z.string().optional(),
  fullScan: z.boolean().optional(),
  autoMatch: z.boolean().optional(),
  skipExisting: z.boolean().optional(),
  preview: z.boolean().optional()
});

const scanner = new EnhancedScanner();

/**
 * Handle library scan job with progress events
 */
// eslint-disable-next-line complexity, max-statements -- Library scan orchestration with path validation, progress tracking, and error recovery
export async function handleLibraryScan(job: jobs): Promise<void> {
  // Debug: Log raw payload to verify preview field is present
  logger.debug('Raw job payload:', { payload: job.payload });

  const result = LibraryScanPayloadSchema.safeParse(job.payload);

  if (!result.success) {
    logger.error('Invalid library scan payload:', result.error);
    throw new Error(`Invalid job payload: ${result.error.message}`);
  }

  const { libraryId, path: scanPath, fullScan, autoMatch, skipExisting, preview } = result.data;

  // Debug: Log parsed data to verify preview extraction
  logger.debug('Parsed scan options:', { preview, autoMatch, skipExisting });
  const jobId = job["id"];
  const partitionKey = job.partition_key;

  logger.info(`Scanning library ${libraryId ?? 'all'}`, {
    jobId: String(jobId),
    path: scanPath,
    fullScan,
    autoMatch,
    skipExisting,
    preview
  });

  if (libraryId) {
    const library = await prisma.library.findUnique({
      where: { id: libraryId }
    });

    if (!library) {
      throw new Error(`Library ${libraryId} not found`);
    }

    // Validate path accessibility before starting scan
    // This prevents blocking on slow/unresponsive network volumes
    const targetPath = scanPath ?? library.path;
    const pathAccessible = await isPathAccessible(targetPath, 5000);
    if (!pathAccessible) {
      throw new Error(`Library path not accessible: ${targetPath}. The path may not exist, be unmounted, or on an unresponsive network volume.`);
    }

    // Emit scan started event
    emitScanProgress(libraryId, {
      status: 'started',
      progress: 0,
      message: `Starting scan of "${library.name}"...`
    });

    try {
      // Build scan options
      const shouldAutoMatch = autoMatch ?? true;
      // Preview mode: scan files but don't create manga entries
      // User can review and import manually from the review table
      const shouldPreview = preview ?? true;
      const scanOptions = {
        skipExisting: skipExisting ?? !(fullScan ?? false),
        autoMatch: shouldAutoMatch,
        preview: shouldPreview,
        // If autoMatch enabled and not in preview mode, include enrichment options
        ...(!shouldPreview && shouldAutoMatch && {
          enrichmentOptions: {
            provider: 'anilist',
            threshold: 0.7
          }
        }),
        onProgress: (current: number, total: number, status: string): void => {
          const progress = Math.round((current / Math.max(total, 1)) * 100);
          // Emit progress updates via WebSocket
          void emitScanProgress(libraryId, {
            status: 'scanning',
            progress,
            current,
            total,
            message: status
          });
        }
      };

      // Scan specific library using scanDirectory
      const scanResult = await scanner.scanDirectory({
        path: scanPath ?? library.path,
        targetLibraryId: library["id"],
        options: scanOptions
      });

      // Handle scan result using type guards
      if (isSuccess(scanResult)) {
        const data = scanResult.data;
        const completionMessage = `Scan completed: ${data.created} created, ${data.skipped} skipped, ${data.errors} errors`;
        emitScanProgress(libraryId, {
          status: 'completed',
          progress: 100,
          message: completionMessage,
          created: data.created,
          skipped: data.skipped,
          errors: data.errors,
          totalFiles: data.totalFiles
        });

        // Store full scan results in job record for UI display
        const scanResultData = {
          totalFiles: data.totalFiles,
          processed: data.processed,
          created: data.created,
          skipped: data.skipped,
          errors: data.errors,
          // eslint-disable-next-line complexity -- Item mapping extracts from multiple enrichment sources
          items: data.items.map(item => {
            // Extract manga ID if created
            const mangaRecord = item.manga as { id?: number } | undefined;
            let mangaId = mangaRecord?.id ?? null;

            // Extract enrichment details if available
            const enrichment = item.enrichment;
            const appliedMatch = enrichment?.appliedMatch;

            // For duplicates, extract match data from existing manga entry
            const isDuplicate = item.status === 'exists' && item.duplicate !== null && item.duplicate !== undefined;
            let duplicateTitle: string | null = null;
            let duplicateCoverImage: string | null = null;
            let duplicateScore: number | null = null;

            if (isDuplicate) {
              const dup = item.duplicate as {
                id?: number;
                title?: string;
                Metadata?: { cover?: string | null } | null;
              };
              if (dup.id !== undefined) mangaId = dup.id;
              duplicateTitle = dup.title ?? null;
              duplicateCoverImage = dup.Metadata?.cover ?? null;
              duplicateScore = item.duplicateScore ?? null;
            }

            return {
              path: item.path,
              title: item.parsed.cleanTitle,
              originalName: item.parsed.original,
              status: item.status,
              error: item.error ?? null,
              chapters: item.chapters ?? 0,
              fileSize: item.fileSize ?? 0,
              enriched: item.status === 'enriched',
              // Additional details
              mangaId,
              provider: appliedMatch?.provider ?? null,
              matchedTitle: appliedMatch?.title ?? null,
              confidence: appliedMatch?.confidence ?? null,
              requiresUserSelection: enrichment?.requiresUserSelection ?? false,
              matchCount: enrichment?.matches?.length ?? 0,
              // Duplicate match info (existing library entries)
              ...(isDuplicate && {
                duplicateTitle,
                duplicateCoverImage,
                duplicateScore,
              }),
              // Parsed metadata
              year: item.parsed.year ?? null,
              group: item.parsed.group ?? null,
              language: item.parsed.language ?? null,
              // Individual file details for file-to-chapter matching
              files: (item.files ?? []).map(f => ({
                name: f.name,
                path: f.path,
                size: f.size,
                extension: f.extension,
                ...(f.chapterNumber !== undefined && { chapterNumber: f.chapterNumber }),
                ...(f.volumeNumber !== undefined && { volumeNumber: f.volumeNumber })
              }))
            };
          })
        };

        logger.info('Storing scan results in job record', {
          jobId: String(jobId),
          partitionKey,
          totalFiles: scanResultData.totalFiles,
          itemCount: scanResultData.items.length
        });

        await prisma.jobs.update({
          where: {
            id_partition_key: {
              id: jobId,
              partition_key: partitionKey
            }
          },
          data: {
            result: scanResultData,
            progress: 100,
            completed_at: new Date()
          }
        });

        logger.info('Scan results stored successfully', { jobId: String(jobId) });

        // Update library last scan time
        await prisma.library.update({
          where: { id: libraryId },
          data: { lastScanAt: new Date() }
        });
      } else if (isError(scanResult)) {
        emitScanProgress(libraryId, {
          status: 'error',
          progress: 0,
          message: `Scan failed: ${scanResult.error.message}`
        });
        throw scanResult.error;
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      emitScanProgress(libraryId, {
        status: 'error',
        progress: 0,
        message: `Scan failed: ${errorMessage}`
      });
      throw error;
    }
  } else {
    // Scan all libraries
    const libraries = await prisma.library.findMany();
    const shouldAutoMatch = autoMatch ?? true;
    const shouldPreview = preview ?? true;

    // Sequential scanning to avoid resource contention (file system, memory)
    /* eslint-disable no-await-in-loop -- Intentional sequential file system operations to avoid resource contention */
    for (const library of libraries) {
      // Validate path accessibility before starting scan
      const pathAccessible = await isPathAccessible(library.path, 5000);
      if (!pathAccessible) {
        logger.warn(`Skipping library "${library.name}" - path not accessible: ${library.path}`);
        emitScanProgress(library.id, {
          status: 'error',
          progress: 0,
          message: `Path not accessible: ${library.path}. May not exist or be unmounted.`
        });
        continue; // Skip to next library instead of failing entire scan
      }

      emitScanProgress(library.id, {
        status: 'started',
        progress: 0,
        message: `Starting scan of "${library.name}"...`
      });

      try {
        // Build scan options
        const scanOptions = {
          skipExisting: skipExisting ?? !(fullScan ?? false),
          autoMatch: shouldAutoMatch,
          preview: shouldPreview,
          ...(!shouldPreview && shouldAutoMatch && {
            enrichmentOptions: {
              provider: 'anilist',
              threshold: 0.7
            }
          }),
          onProgress: (current: number, total: number, status: string): void => {
            void emitScanProgress(library.id, {
              status: 'scanning',
              progress: Math.round((current / Math.max(total, 1)) * 100),
              current,
              total,
              message: status
            });
          }
        };

        const scanResult = await scanner.scanDirectory({
          path: library.path,
          targetLibraryId: library["id"],
          options: scanOptions
        });

        if (isSuccess(scanResult)) {
          const data = scanResult.data;
          emitScanProgress(library.id, {
            status: 'completed',
            progress: 100,
            message: `Scan completed: ${data.created} created, ${data.skipped} skipped`,
            created: data.created,
            skipped: data.skipped,
            errors: data.errors
          });

          await prisma.library.update({
            where: { id: library.id },
            data: { lastScanAt: new Date() }
          });
        }
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(`Failed to scan library ${library.name}:`, error);
        emitScanProgress(library.id, {
          status: 'error',
          progress: 0,
          message: `Scan failed: ${errorMessage}`
        });
        // Continue with next library even if one fails
      }
    }
    /* eslint-enable no-await-in-loop */
  }

  // A library scan skips existing manga (duplicate detection), so it wouldn't
  // otherwise heal an already-drifted title. Run a full archive-coverage heal
  // pass at completion so "refresh library" immediately completes any chapters
  // on disk inside a volume archive but stuck non-COMPLETED — no per-manga limit
  // (the candidate set is small; each call fs-verifies and no-ops when clean).
  const { chaptersHealed } = await healArchiveCoveredChaptersSweep(prisma, 100_000);
  if (chaptersHealed > 0) {
    logger.info(`Library scan: archive-coverage heal completed ${chaptersHealed} chapter(s)`);
  }

  logger.info(`Library scan completed`);
}

/**
 * Emit scan progress event for real-time updates
 */
interface ScanProgressPayload {
  status: 'started' | 'scanning' | 'completed' | 'error';
  progress: number;
  message: string;
  current?: number;
  total?: number;
  created?: number;
  skipped?: number;
  errors?: number;
  totalFiles?: number;
}

function emitScanProgress(libraryId: number, payload: ScanProgressPayload): void {
  try {
    const now = new Date().toISOString();

    // Build event data with required properties
    const eventData = {
      libraryId,
      status: payload.status,
      progress: payload.progress,
      message: payload.message,
      timestamp: now,
      ...(payload.current !== undefined && { current: payload.current }),
      ...(payload.total !== undefined && { total: payload.total }),
      ...(payload.created !== undefined && { created: payload.created }),
      ...(payload.skipped !== undefined && { skipped: payload.skipped }),
      ...(payload.errors !== undefined && { errors: payload.errors }),
      ...(payload.totalFiles !== undefined && { totalFiles: payload.totalFiles })
    };

    // Get WebSocket service (use helper to handle production timing issues)
    const wsService = getWebSocketService();
    if (!wsService) {
      logger.warn('WebSocket service not available for scan progress broadcast', {
        libraryId,
        status: payload.status,
        hasGlobal: !!global.__websocketService
      });
      return;
    }

    // Broadcast to WebSocket clients subscribed to the channel
    void wsService.broadcastToChannel('library:scan:progress', {
      id: `scan-progress-${libraryId}-${Date.now()}`,
      type: 'library:scan:progress',
      channel: 'library:scan:progress',
      data: eventData,
      timestamp: now
    });

    logger.debug('Broadcast scan progress', { libraryId, status: payload.status, progress: payload.progress });
  } catch (error: unknown) {
    // Don't fail the scan if event emission fails
    logger.warn('Failed to broadcast scan progress event:', error);
  }
}