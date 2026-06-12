/**
 * Pack Import Service — extraction and import of downloaded manga packs
 */

import fs from 'fs/promises';
import path from 'path';

import { prisma } from '@/server/db';
import type { PackExtractionResult } from '@/types/pack-download-types';
import type { AsyncResult } from '@/utils/async-result';
import { createSuccessResult, createErrorResult, isSuccess, isError } from '@/utils/async-result';
import { logger } from '@/utils/logger';

import { loadConversionConfig, maybeConvertFile } from './archive-converter';
import { createArchiveExtractor } from './archiveExtractor';
import { linkIndividualChapterFiles, linkVolumeChapters } from './chapter-linker';
import { scanDirectoryForChapterFiles, groupFilesByVolume } from './file-scanner';
import {
  loadPackImportConfig, formatVolumeFolderName, buildMangaPaths
} from './library-path-resolver';
import { detectMultiPartRar, extractMultiPartRar } from './multi-part-rar';

import type { ConversionConfig } from './archive-converter';
import type { PrismaClient } from '@prisma/client';

/**
 * iter-19: backoff schedule (ms) for waitForPackReadiness. Tuned to cover the
 * common "torrent/usenet just hit 100% but files are still being moved to the
 * final path" window (~30–60s on SMB/NFS) without blocking longer than the
 * downloadMonitor's poll cadence.
 */
const READINESS_POLL_DELAYS_MS = [0, 2000, 5000, 10000, 20000, 30000] as const;

type PackStat = Awaited<ReturnType<typeof fs.stat>>;

type ReadinessProbe =
  | { kind: 'ready'; stat: PackStat }
  | { kind: 'unstable'; stat: PackStat; mtimeMs: number }
  | { kind: 'missing' }
  | { kind: 'error'; error: Error };

async function probeReadiness(packPath: string, prevMtimeMs: number | undefined): Promise<ReadinessProbe> {
  try {
    const stat = await fs.stat(packPath);
    if (stat.isFile() && stat.size > 0) return { kind: 'ready', stat };
    if (!stat.isDirectory()) return { kind: 'unstable', stat, mtimeMs: stat.mtimeMs };
    const entries = await fs.readdir(packPath);
    const stableAcrossPolls = entries.length > 0 && prevMtimeMs !== undefined && stat.mtimeMs === prevMtimeMs;
    return stableAcrossPolls ? { kind: 'ready', stat } : { kind: 'unstable', stat, mtimeMs: stat.mtimeMs };
  } catch (err: unknown) {
    if (err instanceof Error && 'code' in err && (err as NodeJS.ErrnoException).code === 'ENOENT') {
      return { kind: 'missing' };
    }
    return { kind: 'error', error: err instanceof Error ? err : new Error(String(err)) };
  }
}

/**
 * iter-19: poll a pack path until it's ready for scanning:
 *   - path exists,
 *   - is either a non-empty directory or a non-empty regular file, and
 *   - if a directory, its mtime is stable across two consecutive polls
 *     (i.e. no active writes landing).
 *
 * Returns an AsyncResult so callers can distinguish a "not-ready-yet" outcome
 * from real import errors in the log.
 */
async function waitForPackReadiness(packPath: string): Promise<AsyncResult<{ stat: PackStat; totalWaitMs: number }, Error>> {
  let lastMtimeMs: number | undefined;
  let lastStat: PackStat | undefined;
  let totalWaitMs = 0;
  for (const delay of READINESS_POLL_DELAYS_MS) {
    if (delay > 0) {
      // eslint-disable-next-line no-await-in-loop -- sequential backoff is the intent
      await new Promise<void>((resolve) => { setTimeout(resolve, delay); });
      totalWaitMs += delay;
    }
    // eslint-disable-next-line no-await-in-loop -- sequential probes; each informs the next
    const probe = await probeReadiness(packPath, lastMtimeMs);
    if (probe.kind === 'ready') return createSuccessResult({ stat: probe.stat, totalWaitMs });
    if (probe.kind === 'error') return createErrorResult(probe.error);
    if (probe.kind === 'unstable') {
      lastStat = probe.stat;
      lastMtimeMs = probe.mtimeMs;
    }
  }
  const kind = lastStat?.isDirectory() === true
    ? 'directory (empty or still being written)'
    : lastStat?.isFile() === true ? 'file (0 bytes)' : 'no such path';
  return createErrorResult(new Error(`pack path not ready after ${Math.round(totalWaitMs / 1000)}s — ${kind}: ${packPath}`));
}

/**
 * Move a file, falling back to copy+delete when source and target are on different devices.
 */
export async function moveFile(src: string, dest: string): Promise<void> {
  try {
    await fs.rename(src, dest);
  } catch (err: unknown) {
    if (err instanceof Error && 'code' in err && (err as NodeJS.ErrnoException).code === 'EXDEV') {
      await fs.copyFile(src, dest);
      await fs.unlink(src);
    } else {
      throw err;
    }
  }
}

/**
 * Pack Import Service
 * Handles extraction and import of downloaded manga packs
 */
export class PackImportService {
  private archiveExtractor = createArchiveExtractor();

  constructor(private prismaClient: PrismaClient = prisma) {}

  /**
   * Import a completed pack download
   *
   * @param packDownloadId - Pack download ID to import
   * @returns Import result with created chapter IDs
   */
  // eslint-disable-next-line max-statements, complexity -- 70 statements + complexity 24 covering the full pack-import state machine (download → extract → match → link); future split candidate
  async importPack(packDownloadId: number): Promise<AsyncResult<PackExtractionResult, Error>> {
    try {
      // Get pack download record
      const packDownload = await this.prismaClient.packDownload.findUnique({
        where: { id: packDownloadId },
        include: {
          manga: true
        }
      });

      if (!packDownload) {
        return createErrorResult(new Error(`PackDownload not found: ${packDownloadId}`));
      }

      if (packDownload.status !== 'COMPLETED') {
        return createErrorResult(new Error(`PackDownload ${packDownloadId} is not in COMPLETED status (current: ${packDownload.status})`));
      }

      if (!packDownload.filePath) {
        return createErrorResult(new Error(`PackDownload ${packDownloadId} has no file path`));
      }

      logger.info(`[PackImport] Starting import for pack #${packDownloadId}: ${packDownload.releaseTitle}`);

      // Update status to IMPORTING
      await this.prismaClient.packDownload.update({
        where: { id: packDownloadId },
        data: { status: 'IMPORTING' }
      });

      // iter-19: wait for the client/mover to finish writing files before we
      // scan. Previously we hit fs.stat immediately and ~170 imports/iter-18
      // failed with empty-errors at :222 because files hadn't arrived yet.
      const readiness = await waitForPackReadiness(packDownload.filePath);
      if (!isSuccess(readiness)) {
        const err = isError(readiness) ? readiness.error : new Error('pack readiness failed');
        logger.warn(`[PackImport] Readiness guard tripped for pack #${packDownloadId}: ${err.message}`);
        await this.updatePackStatus(packDownloadId, 'FAILED', err.message);
        return createErrorResult(err);
      }
      if (readiness.data.totalWaitMs > 0) {
        logger.info(`[PackImport] Pack #${packDownloadId} became ready after ${readiness.data.totalWaitMs}ms of polling`);
      }
      const stat = readiness.data.stat;
      let files: Array<{ fileName: string; filePath: string; size: number; volumeNumber: number | null; chapterNumber: number | null; isValidChapter: boolean }>;

      if (stat.isDirectory()) {
        // Directory of CBZ/chapter files — scan directly, no extraction needed
        logger.info(`[PackImport] Scanning directory: ${packDownload.filePath}`);
        files = await scanDirectoryForChapterFiles(packDownload.filePath);
        logger.info(`[PackImport] Found ${files.length} chapter files in directory`);
      } else {
        // Single archive — extract it
        const extractPath = path.join(
          path.dirname(packDownload.filePath),
          `extracted_${packDownload.id}_${Date.now()}`
        );

        logger.info(`[PackImport] Extracting archive: ${packDownload.filePath}`);
        const extractionResult = await this.archiveExtractor.extractArchive(
          packDownload.filePath,
          extractPath
        );

        if (isError(extractionResult)) {
          await this.updatePackStatus(packDownloadId, 'FAILED', extractionResult.error.message);
          return extractionResult;
        }

        if (!isSuccess(extractionResult)) {
          return createErrorResult(new Error('Archive extraction returned unexpected status'));
        }

        files = extractionResult.data.files;
        logger.info(`[PackImport] Extracted ${extractionResult.data.extractedFiles} files`);
      }

      // iter-16: detect multi-part RAR splits; extract in one pass so chapter
      // files inside the split archive get linked instead of each part
      // becoming a bogus volume entry.
      files = await this.maybeUnpackMultiPartRar(files, Number(packDownload.id), packDownload.filePath);

      // Load conversion config (RAR→CBZ etc.)
      const conversionConfig = await loadConversionConfig(this.prismaClient);

      // Group files by volume
      const filesByVolume = groupFilesByVolume(files);

      // Extract individual chapter files (null volume) for separate handling
      const individualChapterFiles = filesByVolume.get(null) ?? [];
      filesByVolume.delete(null);

      logger.info(`[PackImport] Found ${filesByVolume.size} volume groups and ${individualChapterFiles.length} individual chapter files`);

      const createdChapterIds: number[] = [];
      const errors: string[] = [];

      // 1. Link individual chapter files to existing DB chapters
      if (individualChapterFiles.length > 0) {
        const linkResult = await linkIndividualChapterFiles(
          this.prismaClient, packDownload.mangaId, individualChapterFiles, packDownloadId, conversionConfig
        );
        createdChapterIds.push(...linkResult.linkedIds);
        errors.push(...linkResult.errors);
      }

      // 2. Process volume groups (existing logic)
      const volumePromises = Array.from(filesByVolume.entries()).map(async ([volumeNum, volumeFiles]) => {
        const volumeName = volumeNum !== null ? `Volume ${volumeNum}` : 'Unknown Volume';
        logger.info(`[PackImport] Processing ${volumeName} with ${volumeFiles.length} files`);

        try {
          const chapterResult = await this.createChapterFromFiles(
            packDownload.mangaId,
            volumeNum,
            volumeFiles,
            packDownloadId,
            conversionConfig
          );

          if (isSuccess(chapterResult)) {
            logger.info(`[PackImport] Created chapter #${chapterResult.data} for ${volumeName}`);
            return { success: true, chapterId: chapterResult.data, volumeName };
          } else if (isError(chapterResult)) {
            return { success: false, error: `Failed to create chapter for ${volumeName}: ${chapterResult.error.message}`, volumeName };
          } else {
            return { success: false, error: `Failed to create chapter for ${volumeName}: Unexpected result status`, volumeName };
          }
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          logger.error(`[PackImport] Error processing ${volumeName}:`, error);
          return { success: false, error: `Error processing ${volumeName}: ${errorMessage}`, volumeName };
        }
      });

      const results = await Promise.allSettled(volumePromises);

      // Process results
      for (const result of results) {
        if (result.status === 'fulfilled') {
          const volumeResult = result.value;
          if (volumeResult.success && volumeResult.chapterId !== undefined) {
            createdChapterIds.push(volumeResult.chapterId);
          } else if (!volumeResult.success && volumeResult.error) {
            errors.push(volumeResult.error);
          }
        } else {
          errors.push(`Volume processing failed: ${result.reason}`);
        }
      }

      // Update PackDownload status
      if (createdChapterIds.length > 0) {
        await this.prismaClient.packDownload.update({
          where: { id: packDownloadId },
          data: {
            status: 'IMPORTED',
            completedAt: new Date()
          }
        });

        logger.info(`[PackImport] Successfully imported pack #${packDownloadId}: Created ${createdChapterIds.length} chapters`);

        return createSuccessResult({
          success: true,
          chaptersCreated: createdChapterIds.length,
          chapterIds: createdChapterIds,
          errors,
          extractedPath: packDownload.filePath
        });
      } else {
        // iter-19: distinguish the empty-scan case from aggregated import
        // failures so the log signal is actionable. If errors.length === 0
        // and files was empty, we hit the "scan returned nothing" path
        // even though the readiness guard passed — likely a directory of
        // unrecognized file types.
        //
        // C4: filter blank/whitespace entries before joining — historically
        // some pack imports surfaced "Failed to create any chapters. Errors: "
        // (empty trail) when the array contained empty strings from upstream
        // helpers. If filtering empties the list, fall through to the
        // empty-scan reason and log the raw array so the next reproduction
        // surfaces the source.
        const meaningfulErrors = errors.filter((e) => typeof e === 'string' && e.trim().length > 0);
        if (errors.length > 0 && meaningfulErrors.length === 0) {
          logger.warn(`[PackImport] Pack #${packDownloadId} produced ${errors.length} blank error entries — investigate upstream helpers`, { errors });
        }
        const reason = meaningfulErrors.length > 0
          ? `Errors: ${meaningfulErrors.join('; ')}`
          : `scan returned 0 chapter-like files at ${packDownload.filePath} (${files.length} files seen, 0 valid)`;
        const message = `Failed to create any chapters. ${reason}`;
        await this.updatePackStatus(packDownloadId, 'FAILED', message);

        return createErrorResult(new Error(message));
      }

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Pack import failed';
      logger.error(`[PackImport] Import failed for pack #${packDownloadId}:`, error);

      await this.updatePackStatus(packDownloadId, 'FAILED', errorMessage);
      return createErrorResult(new Error(errorMessage));
    }
  }

  /**
   * Create or update a chapter from extracted files
   *
   * Handles both new chapters and replacing existing individual chapter files with volume files
   */
  private async createChapterFromFiles(
    mangaId: number,
    volumeNumber: number | null,
    files: Array<{
      fileName: string;
      filePath: string;
      size: number;
      volumeNumber: number | null;
      chapterNumber: number | null;
      isValidChapter: boolean;
    }>,
    packDownloadId: number,
    conversionConfig: ConversionConfig
  ): Promise<AsyncResult<number, Error>> {
    try {
      const sortedFiles = files.sort((a, b) => a.fileName.localeCompare(b.fileName));
      const totalSize = sortedFiles.reduce((sum, file) => sum + file.size, 0);

      // Derive chapter index: prefer explicit chapterNumber, fall back to volumeNumber.
      // Without this, all volume-only packs (no "ch" prefix) would collide on index=1.
      const explicitChapter = sortedFiles[0]?.chapterNumber ?? null;
      const chapterIndex = explicitChapter ?? volumeNumber ?? 1;
      const isVolumeEntry = explicitChapter === null && volumeNumber !== null;
      const title = isVolumeEntry ? `Volume ${volumeNumber}` : `Chapter ${chapterIndex}`;

      // Determine fileFormat from actual files
      const fileFormat = this.detectFileFormat(sortedFiles);

      const manga = await this.prismaClient.manga.findUnique({
        where: { id: mangaId }, select: { title: true }
      });
      if (!manga) {
        return createErrorResult(new Error(`Manga not found: ${mangaId}`));
      }

      // Build volume folder name from naming template
      const config = await loadPackImportConfig(this.prismaClient);
      const { volumesDir } = buildMangaPaths(config.libraryBasePath, manga.title);
      const volumeDirName = volumeNumber !== null
        ? formatVolumeFolderName(config.volumeNamingTemplate, manga.title, volumeNumber)
        : `unknown_c${chapterIndex.toString().padStart(3, '0')}`;
      const chapterPath = path.join(volumesDir, volumeDirName);

      // Move files into volume directory (with rename + conversion)
      await this.moveFilesToDirectory(sortedFiles, chapterPath, manga.title, conversionConfig);

      // Re-detect format after conversion (RAR→CBZ changes the extension)
      const postConversionFormat = await this.detectPostConversionFormat(chapterPath, fileFormat);

      // Resolve actual archive file path (not the directory) for single-file volumes
      const resolvedFilePath = await this.resolveArchiveFilePath(chapterPath);

      const upsertResult = await this.upsertChapterRecord({
        mangaId, volumeNumber, chapterIndex, title,
        volumeDirName, chapterPath: resolvedFilePath, totalSize,
        pageCount: sortedFiles.length, packDownloadId, fileFormat: postConversionFormat
      });

      // Link normal-index chapters (index < 100000) whose volume matches to
      // the archive so the UI reflects them as COMPLETED + readable.
      // iter-14: fix for the long-standing pack-import chapter-linking bug.
      if (isSuccess(upsertResult) && volumeNumber !== null) {
        try {
          await linkVolumeChapters({
            prismaClient: this.prismaClient,
            mangaId,
            volumeNumber,
            archivePath: resolvedFilePath,
            archiveFileName: path.basename(resolvedFilePath),
            archiveSize: totalSize,
            packDownloadId,
            fileFormat: postConversionFormat,
          });
        } catch (linkErr: unknown) {
          logger.error(`[PackImport] linkVolumeChapters failed for mangaId=${mangaId} vol=${volumeNumber}:`, linkErr);
        }
      }

      return upsertResult;

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create/update chapter';
      logger.error(`[PackImport] Failed to create/update chapter:`, error);
      return createErrorResult(new Error(errorMessage));
    }
  }

  /** Detect file format from a list of files (single archive → its format, multiple → FOLDER) */
  private detectFileFormat(
    files: Array<{ fileName: string }>
  ): string {
    if (files.length === 1) {
      const ext = path.extname(files[0]?.fileName ?? '').toLowerCase();
      const formatMap: Record<string, string> = {
        '.cbz': 'CBZ', '.cbr': 'CBR', '.zip': 'CBZ',
        '.rar': 'CBR', '.pdf': 'PDF', '.epub': 'EPUB',
      };
      return formatMap[ext] ?? 'FOLDER';
    }
    return 'FOLDER';
  }

  /**
   * Resolve the actual archive file path inside a volume directory.
   * If the directory contains a single archive, return its full path.
   * Otherwise return the directory path as-is (folder-based chapter).
   */
  private async resolveArchiveFilePath(dirPath: string): Promise<string> {
    const ARCHIVE_EXTS = new Set(['.cbz', '.cbr', '.pdf', '.epub', '.zip', '.rar', '.7z', '.cb7']);
    try {
      const entries = await fs.readdir(dirPath);
      const archives = entries.filter(f =>
        !f.startsWith('.') && ARCHIVE_EXTS.has(path.extname(f).toLowerCase())
      );
      if (archives.length === 1 && archives[0]) {
        return path.join(dirPath, archives[0]);
      }
    } catch {
      // Directory may not exist yet
    }
    return dirPath;
  }

  /**
   * If the pack is actually a multi-part split RAR archive, unpack it once
   * with `unar` and return the extracted file list. Otherwise returns the
   * input unchanged.
   */
  private async maybeUnpackMultiPartRar(
    files: Array<{ fileName: string; filePath: string; size: number; volumeNumber: number | null; chapterNumber: number | null; isValidChapter: boolean }>,
    packDownloadId: number,
    packFilePath: string
  ): Promise<Array<{ fileName: string; filePath: string; size: number; volumeNumber: number | null; chapterNumber: number | null; isValidChapter: boolean }>> {
    const multiPart = detectMultiPartRar(files);
    if (!multiPart.isMultiPart || multiPart.firstPart === null) return files;

    const extractPath = path.join(
      path.dirname(packFilePath),
      `multipart_${packDownloadId}_${Date.now()}`
    );
    logger.info(`[PackImport] Multi-part RAR detected (${multiPart.allParts.length} parts, ${multiPart.totalBytes} bytes). Extracting via unar → ${extractPath}`);

    const result = await extractMultiPartRar(multiPart.firstPart, extractPath);
    if (isError(result)) {
      logger.error(`[PackImport] Multi-part RAR extraction failed; continuing with per-part fallback:`, result.error);
      return files;
    }
    const rescanned = await scanDirectoryForChapterFiles(extractPath);
    logger.info(`[PackImport] Multi-part RAR extraction yielded ${rescanned.length} files`);
    return rescanned;
  }

  /** After conversion, re-check directory contents for the actual file format */
  private async detectPostConversionFormat(chapterPath: string, fallback: string): Promise<string> {
    try {
      const dirFiles = await fs.readdir(chapterPath);
      const archives = dirFiles.filter(f => !f.startsWith('.'));
      if (archives.length === 1) {
        const ext = path.extname(archives[0] ?? '').toLowerCase();
        if (ext === '.cbz') return 'CBZ';
        if (ext === '.cbr') return 'CBR';
        if (ext === '.pdf') return 'PDF';
      }
    } catch {
      // Directory might not exist yet in edge cases
    }
    return fallback;
  }

  /**
   * Deterministic index for volume entries: 100000 + volumeNumber.
   * Avoids colliding with normal chapter indexes (typically 1-2000)
   * and is safe for parallel volume processing (no DB query needed).
   */
  private static readonly VOLUME_INDEX_OFFSET = 100000;

  /**
   * Create or update a chapter record in DB for a volume import.
   *
   * Key behavior: Does NOT overwrite existing chapter records that weren't
   * created by a pack import. This preserves original chapter-to-volume
   * grouping from metadata providers. Volume entries are created at
   * deterministic indexes (100000 + volumeNumber) so they don't collide
   * with existing chapters and are safe for parallel processing.
   */
  private async upsertChapterRecord(params: {
    mangaId: number; volumeNumber: number | null; chapterIndex: number;
    title: string; volumeDirName: string; chapterPath: string;
    totalSize: number; pageCount: number; packDownloadId: number; fileFormat: string;
  }): Promise<AsyncResult<number, Error>> {
    const {
      mangaId, volumeNumber, volumeDirName, chapterPath,
      totalSize, pageCount, packDownloadId, fileFormat, title
    } = params;

    const volumeIndex = PackImportService.VOLUME_INDEX_OFFSET + (volumeNumber ?? 0);

    // Check if a volume entry already exists at this index (reimport case)
    const existing = await this.prismaClient.chapter.findUnique({
      where: { mangaId_index: { mangaId, index: volumeIndex } }
    });

    if (existing) {
      // Guard: when re-import resolves to the SAME path the old row already
      // points at (typical for fixed-template re-imports), `moveFilesToDirectory`
      // has already overwritten the file in place. Unlinking
      // `existing.filePath` here would nuke the file we just wrote.
      // Also verify the new file is actually on disk before letting the
      // delete run on a different path.
      if (existing.filePath && existing.filePath !== chapterPath) {
        let newFileExists = false;
        try {
          await fs.access(chapterPath);
          newFileExists = true;
        } catch {
          newFileExists = false;
        }
        if (newFileExists) {
          await this.deleteOldChapterFile(existing.filePath);
        } else {
          logger.warn(
            `[PackImport] Skipping deleteOldChapterFile — new path missing on disk: ${chapterPath} (old: ${existing.filePath})`,
          );
        }
      }
      const updated = await this.prismaClient.chapter.update({
        where: { id: existing.id },
        data: {
          volume: volumeNumber, fileName: volumeDirName, filePath: chapterPath,
          size: totalSize, pageCount, downloadStatus: 'COMPLETED',
          packDownloadId, fileFormat, title,
          // Volume-file rows carry NULL chapterNumber (the library-wide
          // convention — see ensureVolumeFileRows). Re-imports also normalize
          // legacy rows that still hold the old 100000+vol synthetic number.
          chapterNumber: null
        }
      });
      logger.info(`[PackImport] Re-imported ${title} (id=${updated.id})`);
      return createSuccessResult(updated.id);
    }

    const chapter = await this.prismaClient.chapter.create({
      data: {
        // chapterNumber intentionally omitted (NULL): volume-file rows are
        // marked by NULL chapterNumber + index in the 100000+ band, same as
        // the library scanner and ensureVolumeFileRows. Writing the synthetic
        // 100000+vol value here made enrichment phases (volume reassignment,
        // volume-id backfill, pages-fill) misclassify these rows as numbered
        // chapters and clobber their volume/volumeId.
        mangaId, volume: volumeNumber, index: volumeIndex,
        title, fileName: volumeDirName, filePath: chapterPath,
        size: totalSize, pageCount, downloadStatus: 'COMPLETED',
        packDownloadId: BigInt(packDownloadId), fileFormat, monitored: true,
        updatedAt: new Date()
      }
    });

    logger.info(`[PackImport] Created ${title} at index=${volumeIndex} (id=${chapter.id})`);
    return createSuccessResult(chapter.id);
  }

  /**
   * Delete old chapter file or directory
   * Extracted helper to reduce nesting depth
   */
  private async deleteOldChapterFile(filePath: string): Promise<void> {
    try {
      const stats = await fs.stat(filePath);
      if (stats.isDirectory()) {
        await fs.rm(filePath, { recursive: true, force: true });
        logger.info(`[PackImport] Deleted old chapter directory: ${filePath}`);
      } else {
        await fs.unlink(filePath);
        logger.info(`[PackImport] Deleted old chapter file: ${filePath}`);
      }
    } catch (error: unknown) {
      // File might not exist or already deleted - log but continue
      logger.warn(`[PackImport] Could not delete old chapter file (may not exist): ${filePath}`, error);
    }
  }

  /**
   * Create directory, rename files per naming template, convert if needed, then move.
   */
  private async moveFilesToDirectory(
    files: Array<{ fileName: string; filePath: string; volumeNumber: number | null }>,
    targetDir: string,
    mangaTitle: string,
    conversionConfig: ConversionConfig
  ): Promise<void> {
    await fs.mkdir(targetDir, { recursive: true });

    for (const file of files) {
      // Convert RAR→CBZ if enabled
      // eslint-disable-next-line no-await-in-loop
      const converted = await maybeConvertFile(file.filePath, file.fileName, conversionConfig);

      // Rename: use volume naming if available, otherwise keep original name
      let destName = converted.fileName;
      if (file.volumeNumber !== null) {
        const ext = path.extname(converted.fileName);
        destName = `${mangaTitle} V${String(file.volumeNumber).padStart(2, '0')}${ext}`;
      }

      // eslint-disable-next-line no-await-in-loop
      await moveFile(converted.filePath, path.join(targetDir, destName));
    }

    logger.info(`[PackImport] Moved ${files.length} files to ${targetDir}`);
  }

  /** Update pack download status */
  private async updatePackStatus(
    packDownloadId: number,
    status: 'DOWNLOADING' | 'COMPLETED' | 'IMPORTING' | 'IMPORTED' | 'FAILED' | 'CANCELLED',
    errorMessage?: string
  ): Promise<void> {
    try {
      await this.prismaClient.packDownload.update({
        where: { id: packDownloadId },
        data: {
          status,
          ...(errorMessage !== undefined && { errorMessage }),
          ...(status === 'IMPORTED' && { completedAt: new Date() })
        }
      });
    } catch (error: unknown) {
      logger.error(`[PackImport] Failed to update pack status:`, error);
    }
  }

  /** Clean up extraction directory */
  async cleanupExtraction(extractedPath: string): Promise<void> {
    try {
      await fs.rm(extractedPath, { recursive: true, force: true });
    } catch (error: unknown) {
      logger.error(`[PackImport] Failed to cleanup extraction directory:`, error);
    }
  }
}

/**
 * Factory function to create PackImportService instance
 */
export function createPackImportService(prismaClient?: PrismaClient): PackImportService {
  return new PackImportService(prismaClient);
}
