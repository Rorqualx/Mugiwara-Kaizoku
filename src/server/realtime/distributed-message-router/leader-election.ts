/**
 * Distributed Message Router - Leader Election Module
 *
 * Implements leader election using PostgreSQL advisory locks.
 * Ensures only one server in the cluster performs cleanup operations.
 *
 * Extracted from: DistributedMessageRouter.ts (lines 495-552)
 */

import { prisma } from '@/server/db';
import { logger } from '@/utils/logger';

// ============================================================================
// Leader Election
// ============================================================================

/**
 * Try to become the leader using PostgreSQL advisory lock
 *
 * @param leaderLockId - The advisory lock ID to use
 * @param serverId - Current server ID for logging
 * @returns Whether successfully acquired leader status
 */
export async function tryBecomeLeader(
  leaderLockId: number,
  serverId: string
): Promise<boolean> {
  try {
    const result = await prisma.$queryRaw<
      Array<{ pg_try_advisory_lock: boolean }>
    >`
      SELECT pg_try_advisory_lock(${leaderLockId}) as pg_try_advisory_lock
    `;

    const acquired = result[0]?.pg_try_advisory_lock ?? false;

    if (acquired) {
      logger.info('Became cluster leader', { serverId });
    }

    return acquired;
  } catch (error: unknown) {
    logger.error('Failed to acquire leader lock:', error);
    return false;
  }
}

/**
 * Try to maintain leader lock
 *
 * Checks if this process still holds the PostgreSQL advisory lock.
 *
 * @param leaderLockId - The advisory lock ID to check
 * @returns Whether the lock is still held
 */
export async function tryMaintainLeaderLock(
  leaderLockId: number
): Promise<boolean> {
  try {
    const result = await prisma.$queryRaw<Array<{ held: boolean }>>`
      SELECT EXISTS(
        SELECT 1 FROM pg_locks
        WHERE locktype = 'advisory'
          AND objid = ${leaderLockId}
          AND pid = pg_backend_pid()
      ) as held
    `;

    return result[0]?.held ?? false;
  } catch (error: unknown) {
    logger.error('Failed to check leader lock:', error);
    return false;
  }
}

/**
 * Release leader lock
 *
 * Releases the PostgreSQL advisory lock, allowing another server to become leader.
 *
 * @param leaderLockId - The advisory lock ID to release
 * @param serverId - Current server ID for logging
 */
export async function releaseLeaderLock(
  leaderLockId: number,
  serverId: string
): Promise<void> {
  try {
    await prisma.$executeRaw`
      SELECT pg_advisory_unlock(${leaderLockId})
    `;

    logger.info('Released leader lock', { serverId });
  } catch (error: unknown) {
    logger.error('Failed to release leader lock:', error);
  }
}
