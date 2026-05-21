/**
 * Library Scanner — scans a manga's library folder for untracked files
 *
 * Discovers .cbz/.cbr/.pdf files on disk that aren't registered as chapters
 * in the database, then creates COMPLETED chapter records for them.
 */

import fs from 'fs/promises';
import path from 'path';

import { maybeEnqueueConversion } from '@/server/services/conversion/auto-convert-trigger';
import { normalizeFileFormat } from '@/server/services/conversion/format-normalization';
import type { AsyncResult } from '@/utils/async-result';
import { createSuccessResult, createErrorResult, isSuccess } from '@/utils/async-result';
import { logger } from '@/utils/logger';


import { organizeChapterFile } from './chapter-organizer';
import { type Construct, detectConstruct } from './construct-type';
import { scanDirectoryForChapterFiles, type ScannedFile } from './file-scanner';
import { loadPackImportConfig, buildMangaPaths } from './library-path-resolver';

import type { PrismaClient } from '@prisma/client';

export interface LibraryScanResult {
  scannedFiles: number;
  newChaptersCreated: number;
  existingLinked: number;
  alreadyTracked: number;
  errors: string[];
}

interface ExistingChapter {
  id: number;
  index: number;
  filePath: string | null;
  chapterNumber: number | null;
}

interface CreateRow {
  fileName: string; index: number; size: number; mangaId: number;
  title: string; downloadStatus: 'COMPLETED'; filePath: string;
  fileFormat: string | null; chapterNumber: number | null;
  volume: number | null; updatedAt: Date;
}

// iter-IC1: FILE_FORMAT_MAP retired — resolveFileFormat now delegates
// to the canonical lowercase normalizeFileFormat helper so the same
// rules apply across pack-import, native-download, and library-scanner.

/**
 * Pick the DB index for a scanned file.
 *
 * For chapter-numbered files, the chapter number is the index. For
 * volume-only files (no chapter number), the legacy behavior is to
 * synthesize a placeholder index `100_000 + volumeNumber` — appropriate
 * for JP tankobon / KR manhwa / older CN manhua where a volume IS a
 * release unit.
 *
 * iter-IH: when the caller passes `construct = 'webtoon'`, refuse the
 * synthetic-volume fallback (return null). Webtoons don't have real
 * volume releases, and a synthesized row corrupts the chapter timeline
 * (cf. Lookism 2026-05-10 — 390 fake volume rows). The default-
 * undefined construct path preserves pre-iter-IH behavior exactly.
 */
export function resolveIndex(file: ScannedFile, construct?: Construct): number | null {
  if (file.chapterNumber !== null) return file.chapterNumber;
  if (file.volumeNumber !== null) {
    if (construct === 'webtoon') return null;
    return 100_000 + file.volumeNumber;
  }
  return null;
}

function resolveTitle(file: ScannedFile): string {
  if (file.chapterNumber !== null) return `Chapter ${file.chapterNumber}`;
  if (file.volumeNumber !== null) return `Volume ${file.volumeNumber}`;
  return path.basename(file.fileName, path.extname(file.fileName));
}

function resolveFileFormat(fileName: string): string | null {
  return normalizeFileFormat(fileName);
}

async function linkExistingChapter(
  prismaClient: PrismaClient,
  existing: ExistingChapter,
  file: ScannedFile,
): Promise<void> {
  await prismaClient.chapter.update({
    where: { id: existing.id },
    data: {
      filePath: file.filePath,
      size: file.size,
      fileFormat: resolveFileFormat(file.fileName),
      downloadStatus: 'COMPLETED',
    },
  });
  logger.info(`[LibraryScanner] Linked ${file.fileName} to existing chapter index=${existing.index}`);
}

export function classifyFile(
  file: ScannedFile,
  filePathSet: Set<string>,
  indexMap: Map<number, ExistingChapter>,
  construct?: Construct,
): { action: 'skip' | 'link' | 'create' | 'error'; existing?: ExistingChapter; index?: number; error?: string } {
  if (filePathSet.has(file.filePath)) return { action: 'skip' };

  const index = resolveIndex(file, construct);
  if (index === null) {
    const reason = construct === 'webtoon' && file.volumeNumber !== null && file.chapterNumber === null
      ? `Could not determine index for ${file.fileName} (webtoon construct refuses synthetic-volume placeholder; file looks volume-numbered)`
      : `Could not determine index for: ${file.fileName}`;
    return { action: 'error', error: reason };
  }

  const existing = indexMap.get(index);
  if (!existing) return { action: 'create', index };
  if (!existing.filePath) return { action: 'link', existing, index };
  return { action: 'skip' };
}

interface MangaContext {
  dir: string;
  construct: Construct;
}

async function resolveMangaContext(
  prismaClient: PrismaClient,
  mangaId: number,
): Promise<AsyncResult<MangaContext, Error>> {
  const manga = await prismaClient.manga.findUnique({
    where: { id: mangaId },
    include: {
      Library: true,
      Metadata: { select: { countryOfOrigin: true, format: true, tags: true } },
    },
  });

  if (!manga) return createErrorResult(new Error(`Manga ${mangaId} not found`));

  const dir = manga.libraryPath ?? path.join(manga.Library.path, manga.title);
  try {
    await fs.stat(dir);
  } catch {
    return createErrorResult(new Error(`Library folder not found: ${dir}`));
  }

  const construct: Construct = manga.Metadata
    ? detectConstruct({
        countryOfOrigin: manga.Metadata.countryOfOrigin,
        format: manga.Metadata.format,
        tags: manga.Metadata.tags,
      })
    : 'unknown';

  return createSuccessResult({ dir, construct });
}

function makeCreateRow(file: ScannedFile, mangaId: number, index: number): CreateRow {
  return {
    fileName: file.fileName, index, size: file.size, mangaId,
    title: resolveTitle(file), downloadStatus: 'COMPLETED', filePath: file.filePath,
    fileFormat: resolveFileFormat(file.fileName), chapterNumber: file.chapterNumber,
    volume: file.volumeNumber, updatedAt: new Date(),
  };
}

async function processValidFiles(
  prismaClient: PrismaClient,
  mangaId: number,
  validFiles: ScannedFile[],
  totalScanned: number,
  construct: Construct,
): Promise<LibraryScanResult> {
  const existingChapters = await prismaClient.chapter.findMany({
    where: { mangaId },
    select: { id: true, index: true, filePath: true, chapterNumber: true },
  });

  const filePathSet = new Set(existingChapters.map((c) => c.filePath).filter(Boolean) as string[]);
  const indexMap = new Map(existingChapters.map((c) => [c.index, c]));
  const result: LibraryScanResult = {
    scannedFiles: totalScanned, newChaptersCreated: 0,
    existingLinked: 0, alreadyTracked: 0, errors: [],
  };
  const toCreate: CreateRow[] = [];

  for (const file of validFiles) {
    const classification = classifyFile(file, filePathSet, indexMap, construct);
    if (classification.action === 'skip') { result.alreadyTracked++; continue; }
    if (classification.action === 'error') { result.errors.push(classification.error ?? ''); continue; }
    if (classification.action === 'link' && classification.existing) {
      // eslint-disable-next-line no-await-in-loop
      await linkExistingChapter(prismaClient, classification.existing, file);
      result.existingLinked++;
      continue;
    }
    if (classification.action === 'create' && classification.index !== undefined) {
      toCreate.push(makeCreateRow(file, mangaId, classification.index));
    }
  }

  if (toCreate.length > 0) {
    const created = await prismaClient.chapter.createMany({ data: toCreate, skipDuplicates: true });
    result.newChaptersCreated = created.count;
    logger.info(`[LibraryScanner] Created ${created.count} new chapter records`);
  }

  return result;
}

/**
 * iter-IC2: for any chapter in this manga whose on-disk file is
 * non-cbz, enqueue a conversion job. Runs as a post-scan pass so it
 * catches both newly-created rows (from this scan's createMany) and
 * newly-linked rows (from this scan's update path). Idempotent —
 * maybeEnqueueConversion checks for existing PENDING/PROCESSING jobs
 * before creating new ones, and short-circuits if the source format
 * already matches the canonical target (cbz). Failures are logged
 * but don't fail the scan itself.
 */
async function enqueueConversionsForManga(
  prismaClient: PrismaClient, mangaId: number,
): Promise<void> {
  // iter-IC3: skip light-novel manga entirely — their EPUBs are
  // correctly-formatted text content, converting them to CBZ would
  // mean rendering text pages as images (semantically wrong).
  // Re:ZERO -Starting Life in Another World- is the canonical case
  // (`Metadata.format = 'NOVEL'`).
  const manga = await prismaClient.manga.findUnique({
    where: { id: mangaId },
    select: { Metadata: { select: { format: true } } },
  });
  if (manga?.Metadata?.format === 'NOVEL') {
    logger.info(`[LibraryScanner] Skipping conversion for manga ${mangaId} (format=NOVEL)`);
    return;
  }

  const candidates = await prismaClient.chapter.findMany({
    where: {
      mangaId,
      filePath: { not: null },
      fileFormat: { not: null, notIn: ['cbz'] },
    },
    select: { id: true, filePath: true, fileFormat: true },
  });
  if (candidates.length === 0) return;
  let enqueued = 0;
  let skipped = 0;
  for (const c of candidates) {
    if (c.filePath === null) continue;
    // eslint-disable-next-line no-await-in-loop -- per-chapter dedupe check serialized intentionally
    const result = await maybeEnqueueConversion({
      chapterId: c.id, mangaId,
      sourceFile: c.filePath, sourceFormat: c.fileFormat,
    });
    if (result.enqueued) enqueued++;
    else skipped++;
  }
  if (enqueued > 0) {
    logger.info(`[LibraryScanner] Auto-conversion: enqueued ${enqueued} job(s), skipped ${skipped} candidate(s) for manga ${mangaId}`);
  }
}

interface OrganizeCandidate {
  id: number;
  filePath: string | null;
  fileName: string;
  chapterNumber: number | null;
  volume: number | null;
}

async function tryOrganizeOne(
  prismaClient: PrismaClient, mangaId: number, mangaTitle: string,
  config: Awaited<ReturnType<typeof loadPackImportConfig>>,
  c: OrganizeCandidate,
): Promise<{ moved: boolean; error: boolean }> {
  if (c.filePath === null) return { moved: false, error: false };
  try {
    const r = await organizeChapterFile({
      prismaClient, mangaId, mangaTitle,
      chapter: {
        id: c.id, filePath: c.filePath, fileName: c.fileName,
        chapterNumber: c.chapterNumber, volume: c.volume,
      },
      config,
    });
    return { moved: r.moved, error: false };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`[LibraryScanner] Organize failed for chapter ${c.id}: ${msg}`);
    return { moved: false, error: true };
  }
}

/**
 * Honor `Config.fileOrganization.organizeOnImport` for scanned files.
 * The pack-import path moves+renames unconditionally; the library scanner
 * historically registered files in-place which left users' configured
 * naming template (and the `Chapters/` subdir convention) unenforced.
 * This pass runs after createMany/linkExisting and moves any COMPLETED
 * chapter whose filePath isn't already under `<manga>/Chapters/`.
 * Idempotent — the organizer no-ops when filePath already matches the
 * computed destination.
 */
async function organizeScannedChapters(
  prismaClient: PrismaClient, mangaId: number,
): Promise<void> {
  const config = await loadPackImportConfig(prismaClient);
  if (!config.organizeOnImport) return;

  const manga = await prismaClient.manga.findUnique({
    where: { id: mangaId }, select: { title: true },
  });
  if (!manga) return;

  const { chaptersDir } = buildMangaPaths(config.libraryBasePath, manga.title);

  // Sweep every COMPLETED chapter for this manga, then exclude rows that are
  // already inside the canonical Volume NN/ or Unsorted/ subdir. Flat-in-
  // Chapters/ rows get picked up so the new subdir convention is enforced
  // retroactively without a separate migration step.
  const allCandidates = await prismaClient.chapter.findMany({
    where: {
      mangaId,
      downloadStatus: 'COMPLETED',
      filePath: { not: null },
      index: { lt: 100000 },
    },
    select: { id: true, filePath: true, fileName: true, chapterNumber: true, volume: true },
  });

  const volumeSubdirPrefix = `${chaptersDir}/Volume `;
  const unsortedPrefix = `${chaptersDir}/Unsorted/`;
  const candidates = allCandidates.filter((c) => {
    if (c.filePath === null) return false;
    if (c.filePath.startsWith(volumeSubdirPrefix)) return false;
    if (c.filePath.startsWith(unsortedPrefix)) return false;
    return true;
  });

  if (candidates.length === 0) return;

  let moved = 0;
  let errors = 0;
  for (const c of candidates) {
    // eslint-disable-next-line no-await-in-loop -- per-chapter fs move serialized to avoid hammering NFS
    const r = await tryOrganizeOne(prismaClient, mangaId, manga.title, config, c);
    if (r.moved) moved++;
    if (r.error) errors++;
  }
  if (moved > 0 || errors > 0) {
    logger.info(`[LibraryScanner] Organize pass: moved ${moved}/${candidates.length} (${errors} errors)`);
  }
}

export async function scanMangaLibraryFolder(
  prismaClient: PrismaClient,
  mangaId: number,
): Promise<AsyncResult<LibraryScanResult, Error>> {
  try {
    const ctxResult = await resolveMangaContext(prismaClient, mangaId);
    if (!isSuccess(ctxResult)) {
      return ctxResult.status === 'error'
        ? ctxResult
        : createErrorResult(new Error('Unexpected result state'));
    }
    const { dir: mangaDir, construct } = ctxResult.data;

    const scannedFiles = await scanDirectoryForChapterFiles(mangaDir, construct);
    const validFiles = scannedFiles.filter((f) => f.isValidChapter);
    logger.info(`[LibraryScanner] Scanned ${mangaDir}: ${scannedFiles.length} total, ${validFiles.length} valid (construct=${construct})`);

    const result = await processValidFiles(prismaClient, mangaId, validFiles, scannedFiles.length, construct);
    logger.info(`[LibraryScanner] Scan complete: ${result.newChaptersCreated} new, ${result.existingLinked} linked, ${result.alreadyTracked} tracked`);

    // Move/rename newly-tracked files into Chapters/ per fileOrganization
    // settings. Runs before the conversion enqueue so the latter sees the
    // post-organize paths.
    await organizeScannedChapters(prismaClient, mangaId);

    // iter-IC2: enqueue conversion jobs for any non-cbz chapters this
    // scan discovered. Idempotent — maybeEnqueueConversion short-circuits
    // if a job already exists or if the source is already canonical.
    await enqueueConversionsForManga(prismaClient, mangaId);
    return createSuccessResult(result);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.error(`[LibraryScanner] Scan failed for manga ${mangaId}: ${error.message}`);
    return createErrorResult(error);
  }
}
