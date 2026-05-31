/**
 * Batch Blocklist Checker
 *
 * Efficient batch checking of releases against the blocklist.
 * Reduces database queries by checking multiple releases at once.
 *
 * @module prowlarr/batch-blocklist
 */

import { prisma } from '@/server/db';
import { buildBlocklistScopeWhere } from '@/server/services/release-blocklist/scope-where';
import type { BlocklistScope } from '@/server/services/release-blocklist/scope-where';
import type { ProwlarrSearchResult } from '@/types/prowlarr';
import { logger } from '@/utils/logger';

import type { Prisma, PrismaClient } from '@prisma/client';

/**
 * Release identifier for blocklist matching
 */
interface ReleaseIdentifier {
  /** Unique identifier (guid) */
  id: string;
  /** Release title */
  title: string;
  /** Indexer/source name */
  source?: string | undefined;
}

/**
 * Blocklist match result
 */
interface BlocklistMatch {
  /** Release ID that matched */
  id: string;
  /** Whether the release is blocked */
  isBlocked: boolean;
  /** Reason for blocking (if blocked) */
  reason?: string | undefined;
}

/**
 * Batch Blocklist Checker
 *
 * Efficiently checks multiple releases against the blocklist
 * using a single database query instead of per-release queries.
 */
export class BatchBlocklistChecker {
  constructor(private prismaClient: PrismaClient = prisma) {}

  /**
   * Check multiple releases against the blocklist in a single query.
   *
   * @param releases - Array of releases to check
   * @param scope    - Optional manga/source scope. When provided, only rows
   *                   matching that scope (or wildcards `mangaId=null` /
   *                   `source=null`) participate in the match. Omitting it
   *                   preserves the legacy global-only behavior so existing
   *                   callers don't change semantics.
   * @returns Map of release ID to blocklist match result
   */
  async checkReleases(
    releases: ReleaseIdentifier[],
    scope?: BlocklistScope,
  ): Promise<Map<string, BlocklistMatch>> {
    const results = new Map<string, BlocklistMatch>();

    if (releases.length === 0) {
      return results;
    }

    try {
      // Extract all unique titles for matching
      const titles = releases.map(r => r.title);

      // Compose the primary predicate (title or pattern) with the shared
      // scope-WHERE fragment. Both branches go through `buildBlocklistScopeWhere`
      // so this path can't drift from `checkRelease` again.
      const scopeWhere = scope ? buildBlocklistScopeWhere(scope) : {};
      const scopeAnd = (scopeWhere.AND as Prisma.ReleaseBlocklistWhereInput[] | undefined) ?? [];
      const where: Prisma.ReleaseBlocklistWhereInput = {
        isActive: true,
        AND: [
          {
            OR: [
              // Match by exact title
              { title: { in: titles } },
              // Match entries with patterns (we'll check them against all releases)
              { pattern: { not: null } },
            ],
          },
          ...scopeAnd,
        ],
      };

      // Fetch all matching blocklist entries in one query
      const blocklistEntries = await this.prismaClient.releaseBlocklist.findMany({
        where,
        select: {
          id: true,
          title: true,
          reason: true,
          pattern: true,
        },
      });

      logger.debug('Batch blocklist check', {
        releasesChecked: releases.length,
        blocklistEntriesFound: blocklistEntries.length,
      });

      // Build a lookup map for fast matching
      const blocklistByTitle = new Map<string, typeof blocklistEntries[0]>();
      const blocklistByPattern: Array<{ pattern: RegExp; entry: typeof blocklistEntries[0] }> = [];

      for (const entry of blocklistEntries) {
        // Exact title match
        if (entry.title) {
          blocklistByTitle.set(entry.title.toLowerCase(), entry);
        }

        // Pattern match (if pattern field exists)
        if (entry.pattern) {
          try {
            const regex = new RegExp(entry.pattern, 'i');
            blocklistByPattern.push({ pattern: regex, entry });
          } catch {
            // Invalid regex, skip
            logger.warn('Invalid blocklist pattern', { pattern: entry.pattern });
          }
        }
      }

      // Check each release
      for (const release of releases) {
        const titleLower = release.title.toLowerCase();

        // Check exact match
        const exactMatch = blocklistByTitle.get(titleLower);
        if (exactMatch) {
          results.set(release.id, {
            id: release.id,
            isBlocked: true,
            reason: String(exactMatch.reason),
          });
          continue;
        }

        // Check pattern matches
        let patternMatched = false;
        for (const { pattern, entry } of blocklistByPattern) {
          if (pattern.test(release.title)) {
            results.set(release.id, {
              id: release.id,
              isBlocked: true,
              reason: entry.pattern ? `Matches blocklist pattern: ${entry.pattern}` : String(entry.reason),
            });
            patternMatched = true;
            break;
          }
        }

        // Not blocked
        if (!patternMatched) {
          results.set(release.id, {
            id: release.id,
            isBlocked: false,
          });
        }
      }

      const blockedCount = Array.from(results.values()).filter(r => r.isBlocked).length;
      logger.debug('Batch blocklist check complete', {
        total: releases.length,
        blocked: blockedCount,
      });

      return results;
    } catch (error) {
      logger.error('Batch blocklist check failed', { error });

      // Return all as not blocked on error
      for (const release of releases) {
        results.set(release.id, {
          id: release.id,
          isBlocked: false,
        });
      }

      return results;
    }
  }

  /**
   * Enhance search results with blocklist status.
   *
   * @param results - Array of search results to enhance
   * @param scope   - Optional manga/source scope; same semantics as
   *                  {@link checkReleases}. Pass `{ mangaId }` from the
   *                  search caller (e.g. quick-download for manga X) so a
   *                  block on a same-titled release in manga Y can't leak.
   * @returns Enhanced results with isBlocked and blockReason fields
   */
  async enhanceResults(
    results: ProwlarrSearchResult[],
    scope?: BlocklistScope,
  ): Promise<Array<ProwlarrSearchResult & { isBlocked: boolean; blockReason?: string | undefined }>> {
    if (results.length === 0) {
      return [];
    }

    // Build release identifiers
    const releases: ReleaseIdentifier[] = results.map(r => ({
      id: r.guid,
      title: r.title,
      source: r.indexerName,
    }));

    // Batch check
    const blocklistResults = await this.checkReleases(releases, scope);

    // Enhance results
    return results.map(result => {
      const blocklistMatch = blocklistResults.get(result.guid);
      const enhanced: ProwlarrSearchResult & { isBlocked: boolean; blockReason?: string | undefined } = {
        ...result,
        isBlocked: blocklistMatch?.isBlocked ?? false,
      };
      if (blocklistMatch?.reason) {
        enhanced.blockReason = blocklistMatch.reason;
      }
      return enhanced;
    });
  }
}

/**
 * Singleton instance
 */
let batchBlocklistChecker: BatchBlocklistChecker | null = null;

/**
 * Get the batch blocklist checker instance
 */
export function getBatchBlocklistChecker(prismaClient: PrismaClient = prisma): BatchBlocklistChecker {
  batchBlocklistChecker ??= new BatchBlocklistChecker(prismaClient);
  return batchBlocklistChecker;
}
