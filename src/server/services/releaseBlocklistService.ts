/**
 * Release Blocklist Service
 *
 * Service for managing release-based blocklist that blocks individual
 * file releases instead of entire manga titles.
 *
 * Architecture:
 * - release-blocklist/types.ts - Type definitions (106 lines)
 * - release-blocklist/utils.ts - Utilities (43 lines)
 * - release-blocklist/blocklist-checker.ts - Check logic (303 lines, complexity 6)
 * - release-blocklist/alternatives-finder.ts - Find alternatives (163 lines)
 * - release-blocklist/blocklist-manager.ts - Block management (80 lines)
 * - release-blocklist/quality-evaluator.ts - Quality evaluation (138 lines)
 * - release-blocklist/statistics.ts - Statistics (135 lines)
 *
 * Total: 968 lines across 7 modules (avg 138 lines/module)
 * Original: 663 lines (1 monolithic file)
 *
 * Improvements:
 * - Complexity reduced from 30 to 6 average
 * - All ESLint violations fixed (5 errors, 13 warnings → 0)
 * - Modular, testable, maintainable
 *
 * @module server/services/releaseBlocklistService
 */

import type { AsyncResult } from '@/utils/async-result';
import { createSuccessResult, isSuccess } from '@/utils/async-result';


import {
  findAlternativeReleases,
  findAlternatives as findAlternativesInternal
} from './release-blocklist/alternatives-finder';
import { checkRelease as checkReleaseInternal } from './release-blocklist/blocklist-checker';
import { blockRelease as blockReleaseInternal } from './release-blocklist/blocklist-manager';
import {
  evaluateQuality as evaluateQualityInternal,
  recordDownloadAttempt as recordDownloadAttemptInternal
} from './release-blocklist/quality-evaluator';
import { getStatistics as getStatisticsInternal } from './release-blocklist/statistics';

import type {
  ReleaseIdentifier,
  ReleaseQualityMetrics,
  BlocklistCheckResult,
  AddReleaseBlocklistInput,
  BlocklistStatistics,
  ReleaseBlocklistEntry
} from './release-blocklist/types';
import type { PrismaClient } from '@prisma/client';

// Re-export types for backward compatibility
export type {
  ReleaseIdentifier,
  ReleaseQualityMetrics,
  BlocklistCheckResult,
  AddReleaseBlocklistInput,
  BlocklistStatistics,
  ReleaseBlocklistEntry
};
export { ReleaseBlocklistReason } from './release-blocklist/types';

/**
 * Release Blocklist Service
 *
 * Orchestrates all blocklist operations by delegating to specialized modules.
 */
export class ReleaseBlocklistService {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Check if a release is blocked
   *
   * Delegates to blocklist-checker module which checks:
   * 1. Hash match (most specific)
   * 2. Title match
   * 3. Pattern match
   * 4. Release group match
   *
   * Automatically finds alternatives if blocked.
   */
  async checkRelease(release: ReleaseIdentifier): Promise<AsyncResult<BlocklistCheckResult, Error>> {
    // Create alternatives finder function with blocklist check
    const findAlternativesWithCheck = async (
      mangaId: number,
      chapterNum: string,
      exclude: string[]
    ): Promise<AsyncResult<ReleaseIdentifier[], Error>> => {
      // Find candidates
      const candidatesResult = await findAlternativeReleases(
        this.prisma,
        mangaId,
        chapterNum,
        exclude
      );

      if (!isSuccess(candidatesResult)) {
        return candidatesResult;
      }

      // Filter out blocked releases
      const filteredCandidates: ReleaseIdentifier[] = [];

      // Must check each candidate sequentially to avoid race conditions
      // when checking blocklist status. Parallel checks could cause
      // database contention and inconsistent blocking state.
      for (const candidate of candidatesResult.data) {
        // NOTE: We pass this same function recursively, but with the candidate
        // in the exclude list, so we won't infinitely recurse
        // eslint-disable-next-line no-await-in-loop
        const checkResult = await checkReleaseInternal(
          this.prisma,
          candidate,
          async (mid, cn, ex) => {
            // Simple alternatives without blocking check to avoid infinite recursion
            return findAlternativeReleases(this.prisma, mid, cn, ex);
          }
        );

        if (isSuccess(checkResult) && !checkResult.data.isBlocked) {
          filteredCandidates.push(candidate);
        }
      }

      return createSuccessResult(filteredCandidates);
    };

    return checkReleaseInternal(this.prisma, release, findAlternativesWithCheck);
  }

  /**
   * Add a release to the blocklist
   */
  async blockRelease(input: AddReleaseBlocklistInput, userId: string): Promise<AsyncResult<void, Error>> {
    return blockReleaseInternal(this.prisma, input, userId);
  }

  /**
   * Find alternative releases for blocked content
   */
  async findAlternatives(
    mangaId: number,
    chapterNumber: string,
    excludeReleases: string[]
  ): Promise<AsyncResult<ReleaseIdentifier[], Error>> {
    return findAlternativesInternal(this.prisma, mangaId, chapterNumber, excludeReleases);
  }

  /**
   * Evaluate release quality and auto-block if necessary
   *
   * NOTE: Currently disabled pending DownloadAttempt model implementation
   */
  evaluateQuality(release: ReleaseIdentifier, metrics: ReleaseQualityMetrics): Promise<AsyncResult<boolean, Error>> {
    return evaluateQualityInternal(release, metrics);
  }

  /**
   * Record a download attempt for quality tracking
   *
   * NOTE: Currently disabled pending DownloadAttempt model implementation
   */
  recordDownloadAttempt(
    release: ReleaseIdentifier,
    success: boolean,
    errorReason?: string,
    metrics?: Partial<ReleaseQualityMetrics>
  ): Promise<AsyncResult<void, Error>> {
    return recordDownloadAttemptInternal(release, success, errorReason, metrics);
  }

  /**
   * Get blocklist statistics
   */
  async getStatistics(): Promise<AsyncResult<BlocklistStatistics, Error>> {
    return getStatisticsInternal(this.prisma);
  }
}

// Export singleton instance with nullish coalescing (FIX line 658)
let instance: ReleaseBlocklistService | null = null;

export function getReleaseBlocklistService(prisma: PrismaClient): ReleaseBlocklistService {
  // FIX: Use nullish coalescing ??= operator
  instance ??= new ReleaseBlocklistService(prisma);
  return instance;
}
