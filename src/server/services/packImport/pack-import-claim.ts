/**
 * Pack import claim
 *
 * A completed pack download can be picked up by more than one importer: the
 * per-download progress loop and the periodic download monitor both react to
 * "download finished". Without a single owner they scan and move the same
 * files concurrently and overwrite each other's results.
 *
 * Ownership is the `PackDownload.status` column, changed only by conditional
 * `updateMany` calls so that exactly one caller wins each transition:
 *
 *   DOWNLOADING | COMPLETED | FAILED --markPackReadyForImport--> COMPLETED
 *   COMPLETED                        --claimPackImport---------> IMPORTING
 *
 * A pack that is already IMPORTING (and not stale) or IMPORTED is left alone;
 * the caller waits for the owner's outcome instead of starting a second import.
 */

import { logger } from '@/utils/logger';

import type { PackDownloadStatus, PrismaClient } from '@prisma/client';

/** Raised when another importer already owns the pack. */
export class PackImportClaimedError extends Error {
  constructor(packDownloadId: number | bigint, readonly currentStatus: PackDownloadStatus | 'MISSING') {
    super(`PackDownload ${String(packDownloadId)} is already claimed (status: ${currentStatus})`);
    this.name = 'PackImportClaimedError';
  }
}

/**
 * An IMPORTING row older than this is treated as abandoned (the process that
 * owned it crashed or was killed) and may be claimed again.
 */
export const STALE_IMPORT_MS = 60 * 60 * 1000;

const WAIT_POLL_MS = 5_000;
const WAIT_DEADLINE_MS = 30 * 60 * 1000;

export type PackReadyOutcome = 'ready' | 'in-progress' | 'imported' | 'unavailable';

/**
 * Record the resolved path and move the pack to COMPLETED so it can be
 * claimed — but only if no importer currently owns it.
 */
export async function markPackReadyForImport(
  prisma: PrismaClient,
  packDownloadId: number | bigint,
  filePath: string,
): Promise<PackReadyOutcome> {
  const staleBefore = new Date(Date.now() - STALE_IMPORT_MS);
  const { count } = await prisma.packDownload.updateMany({
    where: {
      id: packDownloadId,
      OR: [
        { status: { in: ['DOWNLOADING', 'COMPLETED', 'FAILED'] } },
        { status: 'IMPORTING', updatedAt: { lt: staleBefore } },
      ],
    },
    data: { status: 'COMPLETED', filePath, errorMessage: null },
  });
  if (count === 1) return 'ready';

  const current = await prisma.packDownload.findUnique({
    where: { id: packDownloadId },
    select: { status: true },
  });
  if (current?.status === 'IMPORTED') return 'imported';
  if (current?.status === 'IMPORTING') return 'in-progress';
  return 'unavailable';
}

/**
 * Atomically take ownership of a COMPLETED pack. Exactly one concurrent caller
 * gets through; the others receive {@link PackImportClaimedError}.
 */
export async function claimPackImport(
  prisma: PrismaClient,
  packDownloadId: number | bigint,
): Promise<void> {
  const { count } = await prisma.packDownload.updateMany({
    where: { id: packDownloadId, status: 'COMPLETED' },
    data: { status: 'IMPORTING' },
  });
  if (count === 1) return;

  const current = await prisma.packDownload.findUnique({
    where: { id: packDownloadId },
    select: { status: true },
  });
  throw new PackImportClaimedError(packDownloadId, current?.status ?? 'MISSING');
}

/**
 * Wait for the importer that owns the pack to finish.
 *
 * @returns true when the pack ends IMPORTED; false when it ends in any other
 * state or is still IMPORTING at the deadline (the owner then reports the
 * final outcome itself).
 */
export async function waitForPackImportOwner(
  prisma: PrismaClient,
  packDownloadId: number | bigint,
  options: { pollMs?: number; deadlineMs?: number } = {},
): Promise<boolean> {
  const pollMs = options.pollMs ?? WAIT_POLL_MS;
  const deadline = Date.now() + (options.deadlineMs ?? WAIT_DEADLINE_MS);

  // Each poll depends on the previous one's result.
  /* eslint-disable no-await-in-loop */
  while (true) {
    const current = await prisma.packDownload.findUnique({
      where: { id: packDownloadId },
      select: { status: true },
    });
    if (current?.status === 'IMPORTED') return true;
    if (current?.status !== 'IMPORTING') return false;
    if (Date.now() + pollMs > deadline) {
      logger.warn(`[PackImportClaim] PackDownload ${String(packDownloadId)} still importing at wait deadline`);
      return false;
    }
    await new Promise<void>((resolve) => { setTimeout(resolve, pollMs); });
  }
  /* eslint-enable no-await-in-loop */
}
