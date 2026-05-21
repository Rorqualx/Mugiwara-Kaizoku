/**
 * @quality-check-skip
 *
 * MangaDex download pipeline smoke test.
 *
 * Exercises the wired download path end-to-end against a real MangaDex
 * chapter (Iken Senki Volundio, ch.72). Bypasses the tRPC layer (which
 * needs session auth) and writes the same NativeDownload + Jobs rows the
 * `startDownload` mutation would, then calls `manager.queueDownload()` so
 * the running server's queue worker picks it up and runs handleMangaDexDownload.
 *
 * Requires the dev server to be running so the queue worker is polling.
 */

import { existsSync, mkdirSync, statSync } from 'fs';
import path from 'path';

import { JobPriority, NativeDownloadStatus, Prisma } from '@prisma/client';

import { prisma } from '@/server/db';
import { getNativeDownloadManager } from '@/server/services/native-download/NativeDownloadManager';

const TEST = {
  mangaTitle: 'Iken Senki Volundio',
  mangadexMangaId: '4fd4f8c0-fab8-4ee5-ab9e-5907720afed9',
  mangadexChapterId: '32135667-8a56-4837-9f61-4ab97ea760dc',
  chapterNumber: 72,
  quality: 'full' as const,
} as const;

function log(prefix: string, message: string): void {
  process.stdout.write(`[${prefix}] ${message}\n`);
}

function fail(message: string): never {
  log('error', message);
  process.exit(1);
}

function chapterFileName(chapterNumber: number): string {
  return `Chapter ${chapterNumber.toString().padStart(4, '0')}.cbz`;
}

function buildJobPayload(downloadId: string, mangaId: number, destinationPath: string): Prisma.InputJsonValue {
  return {
    downloadId,
    mangaId,
    mangadexChapterId: TEST.mangadexChapterId,
    chapterNumber: TEST.chapterNumber,
    quality: TEST.quality,
    destinationPath,
    metadata: {
      series: TEST.mangaTitle,
      number: String(TEST.chapterNumber),
    },
  };
}

const JOB_METADATA: Prisma.InputJsonValue = {
  downloadType: 'chapter',
  sourceName: 'MANGADEX',
};

async function step1ResolveLibrary(): Promise<{ id: number; path: string }> {
  const lib = await prisma.library.findFirst({ orderBy: { id: 'asc' } });
  if (!lib) {
    fail('No Library row exists. Add a library via the UI first, then re-run this script.');
  }
  log('step 1', `using library id=${lib.id} path=${lib.path}`);
  return { id: lib.id, path: lib.path };
}

async function step2UpsertManga(lib: { id: number; path: string }): Promise<{ id: number; libraryPath: string }> {
  const libraryPath = path.join(lib.path, TEST.mangaTitle);
  mkdirSync(libraryPath, { recursive: true });

  const manga = await prisma.manga.upsert({
    where: { title: TEST.mangaTitle },
    create: {
      title: TEST.mangaTitle,
      source: 'MANGADEX',
      sourceId: TEST.mangadexMangaId,
      libraryId: lib.id,
      libraryPath,
      mangaTitle: TEST.mangaTitle,
      searchProvider: 'mangadex',
      updatedAt: new Date(),
    },
    update: {
      libraryId: lib.id,
      libraryPath,
      sourceId: TEST.mangadexMangaId,
      searchProvider: 'mangadex',
      updatedAt: new Date(),
    },
  });
  log('step 2', `manga id=${manga.id} libraryPath=${manga.libraryPath}`);
  return { id: manga.id, libraryPath };
}

async function createDownloadRow(
  tx: Prisma.TransactionClient,
  opts: { mangaId: number; existingChapterId: number | null; destinationPath: string },
): Promise<string> {
  const row = await tx.nativeDownload.create({
    data: {
      sourceId: 'MANGADEX',
      mangaId: opts.mangaId,
      chapterId: opts.existingChapterId,
      sourceChapterId: TEST.mangadexChapterId,
      chapterNumber: TEST.chapterNumber,
      status: NativeDownloadStatus.QUEUED,
      sourceType: 'MANGADEX',
      destinationPath: opts.destinationPath,
    },
  });
  return row.id;
}

async function createJobRow(
  tx: Prisma.TransactionClient,
  opts: { mangaId: number; downloadId: string; destinationPath: string },
): Promise<bigint> {
  const job = await tx.jobs.create({
    data: {
      job_type: 'mangadex_download',
      queue_name: 'default',
      priority: JobPriority.normal,
      status: 'pending',
      manga_id: opts.mangaId,
      payload: buildJobPayload(opts.downloadId, opts.mangaId, opts.destinationPath),
      metadata: JOB_METADATA,
    },
  });
  return job.id;
}

async function step3CreateRows(opts: { mangaId: number; libraryPath: string }): Promise<{ downloadId: string; jobId: string; destinationPath: string }> {
  const destinationPath = path.join(opts.libraryPath, chapterFileName(TEST.chapterNumber));
  const existingChapter = await prisma.chapter.findUnique({
    where: { mangadexId: TEST.mangadexChapterId },
    select: { id: true },
  });

  const result = await prisma.$transaction(async (tx) => {
    const downloadId = await createDownloadRow(tx, {
      mangaId: opts.mangaId,
      existingChapterId: existingChapter?.id ?? null,
      destinationPath,
    });
    const jobId = await createJobRow(tx, { mangaId: opts.mangaId, downloadId, destinationPath });
    return { downloadId, jobId };
  });

  log('step 3', `enqueued downloadId=${result.downloadId} jobId=${String(result.jobId)} dest=${destinationPath}`);
  return { downloadId: result.downloadId, jobId: String(result.jobId), destinationPath };
}

async function step4WaitForCompletion(downloadId: string): Promise<NativeDownloadStatus> {
  const manager = await getNativeDownloadManager();
  await manager.queueDownload(downloadId);

  const startTime = Date.now();
  const timeoutMs = 5 * 60 * 1000;
  let lastStatus: NativeDownloadStatus | null = null;
  let warnedStuck = false;

  while (Date.now() - startTime < timeoutMs) {
    const row = await prisma.nativeDownload.findUnique({ where: { id: downloadId } });
    if (!row) fail(`Download row ${downloadId} disappeared`);

    if (row.status !== lastStatus) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      log('step 4', `${lastStatus ?? 'init'} → ${row.status} (after ${elapsed}s, progress=${row.progress})`);
      lastStatus = row.status;
    }

    if (row.status === NativeDownloadStatus.COMPLETED) return row.status;
    if (row.status === NativeDownloadStatus.FAILED || row.status === NativeDownloadStatus.CANCELLED) {
      log('step 4', `terminal ${row.status}: ${row.error ?? '(no error message)'}`);
      return row.status;
    }

    if (!warnedStuck && Date.now() - startTime > 60_000 && row.status === NativeDownloadStatus.QUEUED) {
      log('warn', 'still QUEUED after 60s — is the dev server / queue worker actually running?');
      warnedStuck = true;
    }

    await new Promise((resolve) => { setTimeout(resolve, 2000); });
  }

  fail(`Timed out after ${timeoutMs / 1000}s waiting for terminal status (last: ${lastStatus})`);
}

async function step5VerifyArtifacts(opts: { expectedFile: string }): Promise<void> {
  if (!existsSync(opts.expectedFile)) {
    fail(`File missing on disk: ${opts.expectedFile}`);
  }
  const stat = statSync(opts.expectedFile);
  log('step 5', `file: ${opts.expectedFile} (${(stat.size / 1024 / 1024).toFixed(2)} MB)`);

  const chapter = await prisma.chapter.findUnique({ where: { mangadexId: TEST.mangadexChapterId } });
  if (!chapter) {
    fail('Chapter row was not upserted by handleMangaDexDownload');
  }
  log('step 5', `chapter: id=${chapter.id} mangadexId=${chapter.mangadexId} pageCount=${chapter.pageCount} downloadStatus=${chapter.downloadStatus}`);
}

async function main(): Promise<void> {
  try {
    log('init', `target: ${TEST.mangaTitle} ch.${TEST.chapterNumber} (${TEST.mangadexChapterId})`);

    const lib = await step1ResolveLibrary();
    const manga = await step2UpsertManga(lib);
    const enqueued = await step3CreateRows({ mangaId: manga.id, libraryPath: manga.libraryPath });
    const finalStatus = await step4WaitForCompletion(enqueued.downloadId);

    if (finalStatus !== NativeDownloadStatus.COMPLETED) {
      log('result', `❌ pipeline did not complete (final status: ${finalStatus})`);
      process.exitCode = 1;
      return;
    }

    await step5VerifyArtifacts({ expectedFile: enqueued.destinationPath });
    log('result', '✅ pipeline OK');
  } finally {
    await prisma.$disconnect();
  }
}

await main();
