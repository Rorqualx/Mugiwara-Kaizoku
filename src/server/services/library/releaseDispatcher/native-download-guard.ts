/**
 * Race-safe creation of active NativeDownload rows.
 *
 * The unified release dispatcher can run concurrently for the same manga
 * from six entry points (auto-download scheduler, monitoring toggle, quick
 * download, post-enrichment hook, failed-chapter retry, Prowlarr fallback)
 * with no cross-run locking. Each run snapshots in-flight chapters once at
 * start, so two overlapping runs can both decide a chapter is free and
 * double-enqueue it.
 *
 * This helper is the single choke point for creating QUEUED rows. It
 * re-checks for an active row immediately before creating, and relies on
 * the partial unique index `idx_native_download_active_unique`
 * (`(mangaId, chapterNumber) WHERE status IN ('QUEUED','DOWNLOADING')`,
 * migration 20260611000000) as the hard barrier for the remaining window:
 * a concurrent loser surfaces as Prisma P2002 and is treated as
 * "already enqueued", not an error.
 */
import { NativeDownloadStatus, Prisma } from '@prisma/client';


import { prisma } from '@/server/db';
import { logger } from '@/utils/logger';

import type { NativeDownload } from '@prisma/client';

const log = logger.child('NativeDownloadGuard');

const ACTIVE_STATUSES = [NativeDownloadStatus.QUEUED, NativeDownloadStatus.DOWNLOADING];

export interface ActiveNativeDownloadInput {
  mangaId: number;
  chapterId: number | null;
  chapterNumber: number;
  sourceType: 'MANGADEX' | 'SUWAYOMI' | 'GETCOMICS';
  destinationPath: string;
}

/**
 * Create a QUEUED NativeDownload row unless an active (QUEUED/DOWNLOADING)
 * row already exists for the same (mangaId, chapterNumber).
 *
 * Returns the created row, or `null` when another dispatcher already holds
 * the active slot — either seen by the pre-create check or by losing the
 * insert race at the partial unique index.
 */
export async function createActiveNativeDownload(
  input: ActiveNativeDownloadInput,
): Promise<NativeDownload | null> {
  const existing = await prisma.nativeDownload.findFirst({
    where: {
      mangaId: input.mangaId,
      chapterNumber: input.chapterNumber,
      status: { in: ACTIVE_STATUSES },
    },
    select: { id: true },
  });
  if (existing !== null) {
    log.info('Skipping native enqueue: chapter already queued/downloading', {
      mangaId: input.mangaId,
      chapterNumber: input.chapterNumber,
      existingDownloadId: existing.id,
    });
    return null;
  }

  try {
    return await prisma.nativeDownload.create({
      data: {
        mangaId: input.mangaId,
        chapterId: input.chapterId,
        chapterNumber: input.chapterNumber,
        status: NativeDownloadStatus.QUEUED,
        progress: 0,
        sourceType: input.sourceType,
        destinationPath: input.destinationPath,
      },
    });
  } catch (err: unknown) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      log.info('Skipping native enqueue: lost creation race to a concurrent dispatcher', {
        mangaId: input.mangaId,
        chapterNumber: input.chapterNumber,
        sourceType: input.sourceType,
      });
      return null;
    }
    throw err;
  }
}
