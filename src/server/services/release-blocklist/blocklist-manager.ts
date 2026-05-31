/**
 * Release Blocklist Manager
 *
 * Handles adding and managing blocklist entries.
 *
 * Extracted from: releaseBlocklistService.ts (lines 265-304)
 */


import { ReleaseBlocklistReason } from '@prisma/client';

import { realtimeEmitter } from '@/server/services/realtime/RealtimeEventEmitter';
import type { AsyncResult } from '@/utils/async-result';
import { createSuccessResult, createErrorResult } from '@/utils/async-result';
import { toNumberId } from '@/utils/id-converters';
import { logger } from '@/utils/logger';


import {
  isValidReleaseIdentifier,
  isValidBlocklistReason
} from './types';
import { extractReleaseGroup } from './utils';

import type { AddReleaseBlocklistInput } from './types';
import type { PrismaClient } from '@prisma/client';

/**
 * Parameters for auto-blocking a failed release
 */
export interface BlockReleaseParams {
  releaseTitle: string;
  releaseUrl: string;
  mangaId: number;
  failureReason: string;
  expiryDays: number;
  /** Source identifier (e.g. 'getcomics', 'prowlarr'); scopes the entry. */
  source?: string;
}

/**
 * Add a release to the blocklist
 *
 * @param prisma - Prisma client
 * @param input - Blocklist input data
 * @param userId - User ID adding the block
 * @returns AsyncResult indicating success
 */
export async function blockRelease(
  prisma: PrismaClient,
  input: AddReleaseBlocklistInput,
  userId: string
): Promise<AsyncResult<void, Error>> {
  try {
    // Runtime defense: the type forces `release` to be present, but the
    // jobs-page incident (commit d201679be) was rooted in a flat shape
    // sneaking past the type system via Prisma JSON / external callers.
    // `isValidReleaseIdentifier` already handles undefined input.
    if (!isValidReleaseIdentifier(input.release)) {
      return createErrorResult(new Error('Invalid release identifier'));
    }

    if (!isValidBlocklistReason(input.reason)) {
      return createErrorResult(new Error('Invalid blocklist reason'));
    }

    // Convert mangaId if provided
    const mangaId = input.release.mangaId ? toNumberId(input.release.mangaId) : null;

    // Create blocklist entry. `source` scopes the entry so a manga-source
    // block doesn't cross-pollute releases from another source (e.g. a
    // Prowlarr-blocked title doesn't suppress a GetComics release).
    await prisma.releaseBlocklist.create({
      data: {
        title: input.release.releaseTitle,
        hash: input.release.releaseHash ?? null,
        mangaId: mangaId,
        source: input.source ?? input.release.source ?? null,
        reason: input.reason,
        details: input.reasonDetails ?? null,
        pattern: input.blockPattern ?? null,
        group: input.releaseGroup ?? extractReleaseGroup(input.release.releaseTitle) ?? null,
        isActive: true,
        autoBlocked: false
      }
    });

    logger.info('Release added to blocklist', {
      release: input.release.releaseTitle,
      reason: input.reason,
      userId
    });

    // Emit WebSocket event for blocklist update
    void realtimeEmitter.emitSystemEvent({
      eventType: 'blocklist:release:added',
      source: 'blocklist-manager',
      message: `Release "${input.release.releaseTitle}" added to blocklist`,
      data: {
        releaseTitle: input.release.releaseTitle,
        mangaId,
        reason: input.reason,
        autoBlocked: false
      }
    });

    return createSuccessResult(undefined);
  } catch (error: unknown) {
    logger.error('Error adding release to blocklist', {
      input,
      error: error instanceof Error ? error.message : String(error)
    });
    return createErrorResult(
      error instanceof Error ? error : new Error('Failed to add release to blocklist')
    );
  }
}

/**
 * Automatically block a release that failed to download
 *
 * This is used by the retry system to prevent re-downloading releases
 * that have already failed.
 *
 * @param prisma - Prisma client
 * @param releaseTitle - Title of the failed release
 * @param releaseUrl - URL or magnet link of the failed release
 * @param prisma - Prisma client instance
 * @param params - Block release parameters
 * @returns AsyncResult indicating success
 */
export async function autoBlockFailedRelease(
  prisma: PrismaClient,
  params: BlockReleaseParams
): Promise<AsyncResult<void, Error>> {
  const { releaseTitle, releaseUrl, mangaId, failureReason, expiryDays, source } = params;
  try {
    // Validate inputs
    if (!releaseTitle || releaseTitle.trim().length === 0) {
      return createErrorResult(new Error('Release title is required for blocklist'));
    }

    // Calculate expiry date
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiryDays);

    // Generate a hash from the release URL for matching
    const releaseHash = releaseUrl
      ? Buffer.from(releaseUrl).toString('base64').substring(0, 64)
      : null;

    // Check if already blocklisted to avoid duplicates
    const existing = await prisma.releaseBlocklist.findFirst({
      where: {
        title: releaseTitle,
        mangaId: mangaId,
        isActive: true,
      },
    });

    if (existing) {
      logger.debug('Release already blocklisted, updating expiry', {
        releaseTitle,
        mangaId,
        existingId: existing.id,
      });

      // Update the existing entry with new expiry
      await prisma.releaseBlocklist.update({
        where: { id: existing.id },
        data: {
          details: failureReason,
          expiryDate: expiresAt,
        },
      });

      return createSuccessResult(undefined);
    }

    // Extract release group from title
    const releaseGroup = extractReleaseGroup(releaseTitle);

    // Create blocklist entry
    await prisma.releaseBlocklist.create({
      data: {
        title: releaseTitle,
        hash: releaseHash,
        mangaId: mangaId,
        source: source ?? null,
        reason: ReleaseBlocklistReason.DOWNLOAD_FAILED,
        details: failureReason,
        pattern: null,
        group: releaseGroup,
        isActive: true,
        autoBlocked: true,
        expiryDate: expiresAt,
      },
    });

    logger.info('Auto-blocked failed release', {
      releaseTitle,
      mangaId,
      failureReason,
      expiryDays,
      expiresAt: expiresAt.toISOString(),
    });

    // Emit WebSocket event for auto-blocked release
    void realtimeEmitter.emitSystemEvent({
      eventType: 'blocklist:release:auto-blocked',
      source: 'blocklist-manager',
      message: `Release "${releaseTitle}" auto-blocked due to download failure`,
      data: {
        releaseTitle,
        mangaId,
        reason: ReleaseBlocklistReason.DOWNLOAD_FAILED,
        failureReason,
        expiresAt: expiresAt.toISOString(),
        autoBlocked: true
      }
    });

    return createSuccessResult(undefined);
  } catch (error: unknown) {
    logger.error('Error auto-blocking failed release', {
      releaseTitle,
      mangaId,
      error: error instanceof Error ? error.message : String(error),
    });
    return createErrorResult(
      error instanceof Error ? error : new Error('Failed to auto-block release')
    );
  }
}
