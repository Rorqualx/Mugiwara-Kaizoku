/**
 * ConversionJob create + execute
 *
 * Free functions extracted from FormatConversionService so the class can stay
 * a thin facade. Keeping this logic out of the class also keeps brace depth
 * under the project nesting cap when calling Prisma's `create({ data: {} })`
 * pattern.
 */

import { prisma } from '@/server/db';
import { assertChapterFilePathOwned } from '@/server/services/library/chapter-path-guard';
import { organizeChapterFile } from '@/server/services/packImport/chapter-organizer';
import { loadPackImportConfig } from '@/server/services/packImport/library-path-resolver';
import { realtimeEmitter } from '@/server/services/realtime/RealtimeEventEmitter';
import type { AsyncResult } from '@/utils/async-result';
import { createSuccessResult, createErrorResult } from '@/utils/async-result';
import { logger } from '@/utils/logger';

import { ConverterFactory } from '../ConverterFactory';

import { loadDefaultsForJob } from './defaults-loader';
import { failJob } from './job-status';
import { buildOverrideColumns, buildOptionOverrides } from './request-helpers';

import type { ConversionOptions, ConversionResult } from '../BaseConverter';
import type { ConversionJob } from '@prisma/client';

export interface ConversionRequest {
  mangaId: number;
  chapterId: number;
  sourceFile: string;
  targetFile: string;
  sourceFormat: string;
  targetFormat: string;
  priority?: number;
  maxAttempts?: number;
  quality?: number;
  compression?: number;
  bitrate?: string;
  metadata?: Record<string, unknown>;
}

function makeProgressUpdater(jobId: string): (progress: number) => void {
  return (progress: number) => {
    void prisma.conversionJob
      .update({ where: { id: jobId }, data: { progress, updatedAt: new Date() } })
      .catch((error: unknown) => {
        logger.warn('[FormatConversionService] Failed to update progress', error);
      });
  };
}

async function markJobForRetry(jobId: string, errorMessage: string): Promise<void> {
  await prisma.conversionJob.update({
    where: { id: jobId },
    data: { status: 'PENDING', errorMessage, updatedAt: new Date() }
  });
}

async function markJobAsProcessing(jobId: string): Promise<void> {
  await prisma.conversionJob.update({
    where: { id: jobId },
    data: { status: 'PROCESSING', attempts: { increment: 1 }, updatedAt: new Date() }
  });
}

/**
 * iter-IC5: after a successful conversion, re-point the originating
 * Chapter row at the new output file. Updates filePath / fileName /
 * fileFormat / size / pageCount in one shot. Idempotent — re-runs
 * just overwrite with the same values.
 *
 * Best-effort: catches and logs errors instead of throwing, so a
 * failure here doesn't undo the conversion job's COMPLETED status.
 * If the chapter row was deleted between job creation and completion,
 * the update silently no-ops.
 */
async function repointChapterToConvertedFile(
  chapterId: number, outputPath: string,
  targetFormat: string, fileSize: number, pageCount: number | null,
): Promise<void> {
  try {
    const ch = await prisma.chapter.findUnique({ where: { id: chapterId }, select: { mangaId: true } });
    if (ch !== null) {
      await assertChapterFilePathOwned(prisma, ch.mangaId, outputPath, 'repointChapterToConvertedFile');
    }
    const fileName = outputPath.split('/').pop() ?? outputPath;
    const data: {
      filePath: string; fileName: string; fileFormat: string;
      size: number; updatedAt: Date; pageCount?: number;
    } = {
      filePath: outputPath, fileName, fileFormat: targetFormat,
      size: fileSize, updatedAt: new Date(),
    };
    if (pageCount !== null && pageCount > 0) data.pageCount = pageCount;
    await prisma.chapter.updateMany({ where: { id: chapterId }, data });
  } catch (err: unknown) {
    logger.warn(
      `[FormatConversionService] repointChapterToConvertedFile failed for chapter ${chapterId}`,
      err,
    );
  }
}

/**
 * After a successful conversion + repoint, move the output into
 * `<manga>/Chapters/<canonical>.ext` so converted files don't sit
 * stranded in the source dir (e.g. at the manga root, or under
 * `Volumes/Vol N/`). Mirrors the post-import organize sweep in
 * `library-scanner.organizeScannedChapters`.
 *
 * Volume-source files (shared across chapter rows) are no-ops —
 * `organizeChapterFile` already guards via the `sharers > 0` check.
 *
 * Best-effort: catches and logs errors so a failure here doesn't
 * undo the conversion job's COMPLETED status.
 */
async function organizeConvertedChapter(chapterId: number): Promise<void> {
  try {
    const chapter = await prisma.chapter.findUnique({
      where: { id: chapterId },
      select: {
        id: true, filePath: true, fileName: true,
        chapterNumber: true, volume: true, mangaId: true,
        Manga: { select: { title: true } },
      },
    });
    if (chapter?.filePath === null || chapter?.filePath === undefined) return;
    const config = await loadPackImportConfig(prisma);
    if (!config.organizeOnImport) return;
    await organizeChapterFile({
      prismaClient: prisma,
      mangaId: chapter.mangaId,
      mangaTitle: chapter.Manga.title,
      chapter: {
        id: chapter.id, filePath: chapter.filePath, fileName: chapter.fileName,
        chapterNumber: chapter.chapterNumber, volume: chapter.volume,
      },
      config,
    });
  } catch (err: unknown) {
    logger.warn(
      `[FormatConversionService] organizeConvertedChapter failed for chapter ${chapterId}`,
      err,
    );
  }
}

async function markJobAsCompleted(jobId: string, outputPath: string): Promise<void> {
  await prisma.conversionJob.update({
    where: { id: jobId },
    data: {
      status: 'COMPLETED',
      progress: 100,
      targetFilePath: outputPath,
      completedAt: new Date(),
      updatedAt: new Date(),
      errorMessage: null
    }
  });
}

async function handleConversionError(
  job: ConversionJob,
  conversionError: Error
): Promise<void> {
  const shouldRetry = job.attempts < job.maxAttempts;
  if (shouldRetry) {
    logger.warn('[FormatConversionService] Conversion failed, will retry', {
      jobId: job.id,
      attempts: job.attempts,
      maxAttempts: job.maxAttempts,
      error: conversionError.message
    });
    await markJobForRetry(job.id, conversionError.message);
    return;
  }
  await failJob(job.id, conversionError.message);
}

function buildOptions(
  job: ConversionJob,
  overrides: ReturnType<typeof buildOptionOverrides>
): ConversionOptions {
  return {
    sourceFile: job.sourceFilePath,
    targetFile: job.targetFilePath ?? job.sourceFilePath.replace(
      new RegExp(`\\.${job.sourceFormat}$`, 'i'),
      `.${job.targetFormat}`
    ),
    sourceFormat: job.sourceFormat as unknown as never,
    targetFormat: job.targetFormat as unknown as never,
    ...overrides,
    onProgress: makeProgressUpdater(job.id)
  };
}

export async function createConversionJob(
  request: ConversionRequest
): Promise<AsyncResult<string, Error>> {
  try {
    logger.info('[FormatConversionService] Creating conversion job', {
      mangaId: request.mangaId,
      chapterId: request.chapterId,
      sourceFormat: request.sourceFormat,
      targetFormat: request.targetFormat
    });

    if (!ConverterFactory.isConversionSupported(
      request.sourceFormat as unknown as never,
      request.targetFormat as unknown as never
    )) {
      const error = new Error(
        `Conversion from ${request.sourceFormat} to ${request.targetFormat} is not supported`
      );
      logger.error('[FormatConversionService] Unsupported conversion', error);
      return createErrorResult(error);
    }

    // Per-job overrides (quality/compression/bitrate/metadata, plus the
    // explicit targetFilePath) are persisted so the worker and any future
    // re-run paths see the original request, not just config defaults at
    // execution time.
    const job = await prisma.conversionJob.create({
      data: {
        mangaId: request.mangaId,
        chapterId: request.chapterId,
        sourceFilePath: request.sourceFile,
        targetFilePath: request.targetFile,
        sourceFormat: request.sourceFormat,
        targetFormat: request.targetFormat,
        status: 'PENDING',
        priority: request.priority ?? 50,
        maxAttempts: request.maxAttempts ?? 3,
        progress: 0,
        ...buildOverrideColumns(request)
      }
    });

    logger.info('[FormatConversionService] Conversion job created', {
      jobId: job.id,
      mangaId: request.mangaId,
      chapterId: request.chapterId
    });

    void realtimeEmitter.emitConversionJob({
      jobId: job.id,
      status: 'queued',
      inputFile: request.sourceFile,
      outputFile: request.targetFile
    });

    return createSuccessResult(job.id);
  } catch (error: unknown) {
    logger.error('[FormatConversionService] Failed to create conversion job', error);
    return createErrorResult(error instanceof Error ? error : new Error(String(error)));
  }
}

export async function executeConversionJob(
  jobId: string
): Promise<AsyncResult<ConversionResult, Error>> {
  try {
    logger.info('[FormatConversionService] Executing conversion job', { jobId });

    const job = await prisma.conversionJob.findUnique({ where: { id: jobId } });

    if (!job) {
      const error = new Error(`Conversion job not found: ${jobId}`);
      logger.error('[FormatConversionService] Job not found', error);
      return createErrorResult(error);
    }

    if (job.status === 'COMPLETED' || job.status === 'CANCELLED') {
      const error = new Error(`Job is already ${job.status}`);
      logger.warn('[FormatConversionService] Job already finished', { jobId, status: job.status });
      return createErrorResult(error);
    }

    await markJobAsProcessing(jobId);

    const converterResult = ConverterFactory.getConverter(
      job.sourceFormat as unknown as never,
      job.targetFormat as unknown as never
    );

    if (converterResult.status === 'error') {
      await failJob(jobId, converterResult.error.message);
      return createErrorResult(converterResult.error);
    }

    if (converterResult.status !== 'success') {
      const err = new Error('Unexpected converter result status');
      await failJob(jobId, err.message);
      return createErrorResult(err);
    }

    // Resolution order: per-job DB overrides > global config defaults >
    // converter built-in defaults. The createConversionJob path now always
    // populates targetFilePath, so the regex fallback is only hit by legacy
    // rows.
    const defaults = await loadDefaultsForJob(job.sourceFormat, job.targetFormat);
    const overrides = buildOptionOverrides(job, defaults);
    const options = buildOptions(job, overrides);

    const conversionResult = await converterResult.data.convert(options);

    if (conversionResult.status === 'error') {
      await handleConversionError(job, conversionResult.error);
      return createErrorResult(conversionResult.error);
    }

    if (conversionResult.status !== 'success') {
      const err = new Error('Unexpected conversion result status');
      await failJob(jobId, err.message);
      return createErrorResult(err);
    }

    await markJobAsCompleted(jobId, conversionResult.data.outputPath);

    // iter-IC5: re-point the Chapter row at the converted file. Without
    // this the chapter still references the source (e.g. .epub) even
    // after conversion produces a .cbz alongside, and a subsequent
    // library scan would create a duplicate Chapter row for the new
    // file. ChapterId is nullable on ConversionJob (jobs can be
    // manga-wide, not chapter-specific) — only re-point when the job
    // tracks a specific chapter. Failures are logged but don't fail
    // the conversion job — it's already marked COMPLETED.
    if (job.chapterId !== null) {
      await repointChapterToConvertedFile(
        job.chapterId, conversionResult.data.outputPath,
        job.targetFormat, conversionResult.data.fileSize, conversionResult.data.pageCount,
      );
      await organizeConvertedChapter(job.chapterId);
    }

    logger.info('[FormatConversionService] Conversion job completed', {
      jobId,
      outputPath: conversionResult.data.outputPath,
      fileSize: conversionResult.data.fileSize,
      duration: conversionResult.data.duration
    });

    void realtimeEmitter.emitConversionJob({
      jobId,
      status: 'completed',
      progress: 100,
      outputFile: conversionResult.data.outputPath
    });

    return createSuccessResult(conversionResult.data);
  } catch (error: unknown) {
    logger.error('[FormatConversionService] Conversion execution error', error);

    await failJob(
      jobId,
      error instanceof Error ? error.message : String(error)
    ).catch((failError: unknown) => {
      logger.error('[FormatConversionService] Failed to mark job as failed', failError);
    });

    return createErrorResult(error instanceof Error ? error : new Error(String(error)));
  }
}
