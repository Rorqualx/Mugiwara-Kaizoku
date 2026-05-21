/**
 * Auto-convert trigger (iter-IC2)
 *
 * Helper that import paths (pack-import, library-scanner, file-importer)
 * call right after creating or linking a chapter row whose on-disk
 * file is non-canonical. The helper:
 *
 *   1. Normalizes the source format via `normalizeFileFormat`.
 *   2. Short-circuits if the source already equals the canonical target
 *      (default `cbz`) — nothing to do.
 *   3. Verifies the conversion is supported by `ConverterFactory`.
 *   4. Checks for an existing PENDING / PROCESSING job for this chapter
 *      to avoid duplicates on re-import / re-scan.
 *   5. Computes the target file path by replacing the extension on the
 *      source path.
 *   6. Enqueues a job via `FormatConversionService.createConversionJob`.
 *      The already-running ConversionJobWorker
 *      (`startConversionWorker` is called from `trpc/context.ts:78` and
 *      `conversion-initializer.ts:219`) picks it up.
 *
 * Returns a structured result so callers can log without re-deriving
 * the reason — keeps the import-path call sites tiny.
 *
 * Never throws — every failure path returns `{ enqueued: false, ... }`.
 * Auto-conversion is a best-effort backstop; if it fails the chapter
 * row stays as the original format and the user can still trigger
 * conversion manually via the existing UI.
 */

import path from 'path';

import { prisma } from '@/server/db';
import { logger } from '@/utils/logger';

import { ConverterFactory } from './ConverterFactory';
import { normalizeFileFormat } from './format-normalization';
import { getConversionService } from './FormatConversionService';

import type { ConversionFormat } from './BaseConverter';

const DEFAULT_TARGET_FORMAT: ConversionFormat = 'cbz';

export interface TriggerInput {
  chapterId: number;
  mangaId: number;
  sourceFile: string;
  /**
   * Optional — when omitted the source format is inferred from the
   * file extension. Pass this when the caller already has a normalized
   * value to avoid repeated derivation.
   */
  sourceFormat?: string | null;
  /** Canonical target format. Defaults to `cbz`. */
  targetFormat?: ConversionFormat;
}

export type TriggerReason =
  | 'enqueued'
  | 'already-canonical'
  | 'already-in-progress'
  | 'unknown-source-format'
  | 'unsupported-conversion'
  | 'novel-skip'
  | 'enqueue-error';

export interface TriggerResult {
  enqueued: boolean;
  reason: TriggerReason;
  jobId?: string;
  /** When enqueue-error: the underlying error message. */
  error?: string;
}

function computeTargetPath(sourceFile: string, targetFormat: ConversionFormat): string {
  const parsed = path.parse(sourceFile);
  return path.join(parsed.dir, `${parsed.name}.${targetFormat}`);
}

export async function maybeEnqueueConversion(input: TriggerInput): Promise<TriggerResult> {
  const targetFormat = input.targetFormat ?? DEFAULT_TARGET_FORMAT;
  const sourceFormat = normalizeFileFormat(input.sourceFormat ?? input.sourceFile);
  if (sourceFormat === null) {
    return { enqueued: false, reason: 'unknown-source-format' };
  }
  if (sourceFormat === targetFormat) {
    return { enqueued: false, reason: 'already-canonical' };
  }
  if (!ConverterFactory.isConversionSupported(sourceFormat, targetFormat)) {
    return { enqueued: false, reason: 'unsupported-conversion' };
  }

  // iter-IC4: skip light-novel manga — their EPUBs are correctly-
  // formatted text content; converting to cbz would render text pages
  // as images (semantically wrong). The library-scanner path also
  // short-circuits this manga-wide, but a per-call check here covers
  // pack-import + file-importer entry points that don't have the
  // manga context handy.
  const manga = await prisma.manga.findUnique({
    where: { id: input.mangaId },
    select: { Metadata: { select: { format: true } } },
  });
  if (manga?.Metadata?.format === 'NOVEL') {
    return { enqueued: false, reason: 'novel-skip' };
  }

  const existing = await prisma.conversionJob.findFirst({
    where: {
      chapterId: input.chapterId,
      targetFormat,
      status: { in: ['PENDING', 'PROCESSING'] },
    },
    select: { id: true },
  });
  if (existing) {
    return { enqueued: false, reason: 'already-in-progress', jobId: existing.id };
  }

  const targetFile = computeTargetPath(input.sourceFile, targetFormat);
  const result = await getConversionService().createConversionJob({
    mangaId: input.mangaId,
    chapterId: input.chapterId,
    sourceFile: input.sourceFile,
    targetFile,
    sourceFormat,
    targetFormat,
  });
  if (result.status === 'success') {
    logger.info(
      `[AutoConvertTrigger] Enqueued conversion ${sourceFormat}→${targetFormat} for chapter ${input.chapterId} (job ${result.data})`,
    );
    return { enqueued: true, reason: 'enqueued', jobId: result.data };
  }
  const msg = result.status === 'error'
    ? (result.error instanceof Error ? result.error.message : String(result.error))
    : 'unexpected createConversionJob result state';
  logger.warn(`[AutoConvertTrigger] createConversionJob failed for chapter ${input.chapterId}: ${msg}`);
  return { enqueued: false, reason: 'enqueue-error', error: msg };
}
