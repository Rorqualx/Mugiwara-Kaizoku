/**
 * Release Blocklist Checker
 *
 * Core logic for checking if releases are blocked.
 * Split from monolithic checkRelease method to reduce complexity.
 *
 * Extracted from: releaseBlocklistService.ts (lines 118-261)
 */

import type { AsyncResult } from '@/utils/async-result';
import {
  createSuccessResult,
  createErrorResult,
  unwrapOr,
} from '@/utils/async-result';
import { logger } from '@/utils/logger';

import { buildBlocklistScopeWhere } from './scope-where';
import {
  isValidReleaseIdentifier,
  ReleaseBlocklistReason,
} from './types';
import { extractReleaseGroup } from './utils';

import type {
  ReleaseIdentifier,
  BlocklistCheckResult,
} from './types';
import type { Prisma, PrismaClient } from '@prisma/client';

/**
 * Builds the source/mangaId scoping fragment shared by every blocklist
 * lookup so a manga-scoped or source-scoped entry doesn't leak across
 * unrelated rows. NULL columns mean "any" — they always match.
 *
 * Delegates to the shared builder in `scope-where.ts` so the parallel
 * batch path (`prowlarr/batch-blocklist.ts`) cannot drift again.
 */
function buildScopeWhere(release: ReleaseIdentifier): Prisma.ReleaseBlocklistWhereInput {
  return buildBlocklistScopeWhere({
    source: release.source,
    mangaId: release.mangaId,
  });
}

/**
 * Check if release is blocked by hash
 */
async function checkByHash(
  prisma: PrismaClient,
  release: ReleaseIdentifier,
  findAlternatives: (
    mangaId: number,
    chapterNum: string,
    exclude: string[]
  ) => Promise<AsyncResult<ReleaseIdentifier[], Error>>
): Promise<BlocklistCheckResult | null> {
  if (!release.releaseHash) {
    return null;
  }

  const scope = buildScopeWhere(release);
  const hashMatch = await prisma.releaseBlocklist.findFirst({
    where: {
      hash: release.releaseHash,
      isActive: true,
      AND: [
        { OR: [{ expiryDate: null }, { expiryDate: { gt: new Date() } }] },
        ...((scope.AND as Prisma.ReleaseBlocklistWhereInput[] | undefined) ?? []),
      ],
    },
  });

  if (!hashMatch) {
    return null;
  }

  const alternatives = await findAlternatives(
    release.mangaId ?? hashMatch.mangaId ?? 0,
    String(release.chapterNumber ?? ''),
    [release.releaseTitle]
  );

  const result: BlocklistCheckResult = {
    isBlocked: true,
    reason: hashMatch.reason as ReleaseBlocklistReason,
    alternatives: unwrapOr(alternatives, []),
  };

  if (hashMatch.details) {
    result.details = hashMatch.details;
  }

  return result;
}

/**
 * Check if release is blocked by exact title match
 */
async function checkByTitle(
  prisma: PrismaClient,
  release: ReleaseIdentifier,
  findAlternatives: (
    mangaId: number,
    chapterNum: string,
    exclude: string[]
  ) => Promise<AsyncResult<ReleaseIdentifier[], Error>>
): Promise<BlocklistCheckResult | null> {
  const scope = buildScopeWhere(release);
  const titleMatch = await prisma.releaseBlocklist.findFirst({
    where: {
      title: release.releaseTitle,
      isActive: true,
      AND: [
        { OR: [{ expiryDate: null }, { expiryDate: { gt: new Date() } }] },
        ...((scope.AND as Prisma.ReleaseBlocklistWhereInput[] | undefined) ?? []),
      ],
    },
  });

  if (!titleMatch) {
    return null;
  }

  const alternatives = await findAlternatives(
    release.mangaId ?? titleMatch.mangaId ?? 0,
    String(release.chapterNumber ?? ''),
    [release.releaseTitle]
  );

  const result: BlocklistCheckResult = {
    isBlocked: true,
    reason: titleMatch.reason as ReleaseBlocklistReason,
    alternatives: unwrapOr(alternatives, []),
  };

  if (titleMatch.details) {
    result.details = titleMatch.details;
  }

  return result;
}

/**
 * Check if release is blocked by regex pattern
 *
 * NOTE: Sequential pattern checking with early return
 * Patterns must be checked one at a time to find first match.
 * Once a match is found, we return immediately (no need to check remaining).
 */
async function checkByPattern(
  prisma: PrismaClient,
  release: ReleaseIdentifier,
  findAlternatives: (
    mangaId: number,
    chapterNum: string,
    exclude: string[]
  ) => Promise<AsyncResult<ReleaseIdentifier[], Error>>
): Promise<BlocklistCheckResult | null> {
  const scope = buildScopeWhere(release);
  const patternMatches = await prisma.releaseBlocklist.findMany({
    where: {
      pattern: { not: null },
      isActive: true,
      AND: [
        { OR: [{ expiryDate: null }, { expiryDate: { gt: new Date() } }] },
        ...((scope.AND as Prisma.ReleaseBlocklistWhereInput[] | undefined) ?? []),
      ],
    },
  });

  for (const pattern of patternMatches) {
    if (!pattern.pattern) {
      continue;
    }

    try {
      const regex = new RegExp(pattern.pattern, 'i');
      if (regex.test(release.releaseTitle)) {
        // Sequential execution required: Early return on first match
        // eslint-disable-next-line no-await-in-loop
        const alternatives = await findAlternatives(
          release.mangaId ?? pattern.mangaId ?? 0,
          String(release.chapterNumber ?? ''),
          [release.releaseTitle]
        );

        const result: BlocklistCheckResult = {
          isBlocked: true,
          reason: pattern.reason as ReleaseBlocklistReason,
          alternatives: unwrapOr(alternatives, []),
        };

        if (pattern.details) {
          result.details = pattern.details;
        }

        return result;
      }
    } catch (error: unknown) {
      logger.error('Invalid regex pattern in blocklist', {
        pattern: pattern.pattern,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return null;
}

/**
 * Check if release is blocked by release group
 */
async function checkByReleaseGroup(
  prisma: PrismaClient,
  release: ReleaseIdentifier,
  findAlternatives: (
    mangaId: number,
    chapterNum: string,
    exclude: string[]
  ) => Promise<AsyncResult<ReleaseIdentifier[], Error>>
): Promise<BlocklistCheckResult | null> {
  const releaseGroup = extractReleaseGroup(release.releaseTitle);

  if (!releaseGroup) {
    return null;
  }

  const scope = buildScopeWhere(release);
  const groupBlock = await prisma.releaseBlocklist.findFirst({
    where: {
      group: releaseGroup,
      isActive: true,
      AND: [
        { OR: [{ expiryDate: null }, { expiryDate: { gt: new Date() } }] },
        ...((scope.AND as Prisma.ReleaseBlocklistWhereInput[] | undefined) ?? []),
      ],
    },
  });

  if (!groupBlock) {
    return null;
  }

  const alternatives = await findAlternatives(
    release.mangaId ?? groupBlock.mangaId ?? 0,
    String(release.chapterNumber ?? ''),
    [release.releaseTitle]
  );

  return {
    isBlocked: true,
    reason: groupBlock.reason as ReleaseBlocklistReason,
    details: `Blocked release group: ${releaseGroup}`,
    alternatives: unwrapOr(alternatives, []),
  };
}

/**
 * Check if a release is blocked
 *
 * Orchestrates checks in order of specificity:
 * 1. Hash match (most specific)
 * 2. Title match
 * 3. Pattern match
 * 4. Release group match
 *
 * @param prisma - Prisma client
 * @param release - Release identifier to check
 * @param findAlternatives - Function to find alternative releases
 * @returns AsyncResult with check result
 */
export async function checkRelease(
  prisma: PrismaClient,
  release: ReleaseIdentifier,
  findAlternatives: (
    mangaId: number,
    chapterNum: string,
    exclude: string[]
  ) => Promise<AsyncResult<ReleaseIdentifier[], Error>>
): Promise<AsyncResult<BlocklistCheckResult, Error>> {
  try {
    if (!isValidReleaseIdentifier(release)) {
      return createErrorResult(new Error('Invalid release identifier'));
    }

    // Check in order of specificity
    const hashResult = await checkByHash(prisma, release, findAlternatives);
    if (hashResult) {
      return createSuccessResult(hashResult);
    }

    const titleResult = await checkByTitle(prisma, release, findAlternatives);
    if (titleResult) {
      return createSuccessResult(titleResult);
    }

    const patternResult = await checkByPattern(
      prisma,
      release,
      findAlternatives
    );
    if (patternResult) {
      return createSuccessResult(patternResult);
    }

    const groupResult = await checkByReleaseGroup(
      prisma,
      release,
      findAlternatives
    );
    if (groupResult) {
      return createSuccessResult(groupResult);
    }

    // Not blocked
    return createSuccessResult({ isBlocked: false });
  } catch (error: unknown) {
    logger.error('Error checking release blocklist', {
      release,
      error: error instanceof Error ? error.message : String(error),
    });
    return createErrorResult(
      error instanceof Error
        ? error
        : new Error('Failed to check release blocklist')
    );
  }
}
