/**
 * System Updates Router — exposes parsed CHANGELOG.md and admin-gated update instructions.
 */

import { z } from 'zod';

import { realtimeEmitter } from '@/server/services/realtime/RealtimeEventEmitter';
import { toTRPCError } from '@/server/trpc/errors';
import { adminProcedure, protectedProcedure } from '@/server/trpc/procedures';
import { router } from '@/server/trpc/trpc';
import { logger } from '@/utils/logging';

import { compareSemver, getPackageVersion, parseChangelog } from './utils';

import type { VersionEntry } from './utils';

interface UpdateInfoResponse {
  currentVersion: string;
  lastChecked: string;
  changelog: VersionEntry[];
}

interface CheckUpdatesResponse {
  currentVersion: string;
  latestVersion: string;
  updateAvailable: boolean;
  lastChecked: string;
}

interface PerformUpdateResponse {
  message: string;
  instructions: string[];
}

// ============================================================================
// Update Management Procedures
// ============================================================================

/**
 * Retrieves information about available updates
 *
 * This endpoint checks the current version against the changelog
 * to determine if updates are available and provides detailed
 * information about each version's changes.
 *
 * @returns {Promise<UpdateInfoResponse>} Current version, available updates, and changelog
 */
export const getUpdateInfo = protectedProcedure.query((): UpdateInfoResponse => {
  try {
    const currentVersion = getPackageVersion();
    const changelog = parseChangelog();

    const updatedChangelog = changelog
      .map((version): VersionEntry => {
        const cmp = compareSemver(version.version, currentVersion);
        const status: VersionEntry['status'] =
          cmp === 0 ? 'installed' : cmp > 0 ? 'available' : 'previous';
        return { ...version, status };
      })
      .sort((a, b) => compareSemver(b.version, a.version));

    return {
      currentVersion,
      lastChecked: new Date().toISOString(),
      changelog: updatedChangelog,
    };
  } catch (error: unknown) {
    logger.error(`Failed to get update info: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
});

/**
 * Checks for new application updates
 *
 * This endpoint actively checks for new versions of the application
 * and returns information about whether an update is available.
 *
 * @returns {Promise<CheckUpdatesResponse>} Update availability status and version information
 */
export const checkForUpdates = protectedProcedure.query((): CheckUpdatesResponse => {
  try {
    const currentVersion = getPackageVersion();
    const changelog = parseChangelog();

    let latestVersion = currentVersion;
    for (const version of changelog) {
      if (compareSemver(version.version, latestVersion) > 0) {
        latestVersion = version.version;
      }
    }

    const updateAvailable = compareSemver(latestVersion, currentVersion) > 0;

    void realtimeEmitter.emitSystemEvent({
      eventType: 'system:updateChecked',
      source: 'system-updates',
      message: updateAvailable ? `Update available: ${latestVersion}` : 'System is up to date',
      data: { currentVersion, latestVersion, updateAvailable },
    });

    return {
      currentVersion,
      latestVersion,
      updateAvailable,
      lastChecked: new Date().toISOString(),
    };
  } catch (error: unknown) {
    logger.error(`Failed to check for updates: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
});

/**
 * Initiates the application update process
 *
 * This endpoint provides instructions for updating the application,
 * with different approaches for Docker and non-Docker installations.
 *
 * @param {Object} input - Update parameters
 * @param {string} [input.version] - Specific version to update to (optional)
 * @returns {PerformUpdateResponse} Update instructions
 */
export const performUpdate = adminProcedure
  .input(z.object({ version: z.string().optional() }))
  .mutation(({ input: _input }): PerformUpdateResponse => {
    try {
      const isDocker = process.env['DOCKER'] === 'true';

      void realtimeEmitter.emitSystemEvent({
        eventType: 'system:updateStarted',
        source: 'system-updates',
        message: 'Update instructions provided',
        data: { isDocker, method: isDocker ? 'docker' : 'local' },
      });

      if (isDocker) {
        return {
          message: 'To update the Docker container, run: docker-compose pull && docker-compose up -d',
          instructions: [
            'Stop the container: docker-compose down',
            'Pull the latest image: docker-compose pull',
            'Start the container: docker-compose up -d',
            'Check logs for any issues: docker-compose logs -f',
          ],
        };
      }

      return {
        message: 'To update the local installation, run: git pull && bun install && bun run build:clean && bun run start',
        instructions: [
          'Stop the current process',
          'Pull the latest code: git pull',
          'Install dependencies: bun install',
          'Build the application: bun run build:clean',
          'Start the application: bun run start',
        ],
      };
    } catch (error: unknown) {
      logger.error(`Failed to perform update: ${error instanceof Error ? error.message : String(error)}`);
      throw toTRPCError(
        error instanceof Error ? error : new Error('Failed to perform update')
      );
    }
  });

export const systemUpdatesRouter = router({
  getUpdateInfo,
  checkForUpdates,
  performUpdate,
});
