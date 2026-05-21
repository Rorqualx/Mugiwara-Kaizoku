/**
 * Post-Import Download Cleanup Service
 *
 * After a successful pack import, removes the completed download from the
 * client (Transmission, Deluge, NZBGet, SABnzbd) and optionally deletes the
 * source files on disk. The library copy is already imported, so the client
 * entry and download dir are duplicates that consume resources indefinitely.
 *
 * Failures are logged and swallowed — pack-import success is already committed
 * and reverting on a stale-torrent error would be strictly worse than leaving
 * an orphaned client entry.
 *
 * @module server/services/download/cleanup/cleanup-service
 */

import { isError } from '@/utils/async-result';
import { logger } from '@/utils/logger';

import { ClientDownloadService } from '../clientDownload';

import { CLEANUP_CONFIG_KEYS, DEFAULT_CLEANUP_CONFIG } from './types';

import type { DownloadCleanupConfig } from './types';
import type { PackDownload, PrismaClient } from '@prisma/client';

function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined) return defaultValue;
  return value.toLowerCase() === 'true';
}

/**
 * Load cleanup configuration from the Config table
 */
async function getCleanupConfig(prismaClient: PrismaClient): Promise<DownloadCleanupConfig> {
  try {
    const configEntries = await prismaClient.config.findMany({
      where: {
        key: { startsWith: 'download.cleanup.' },
      },
    });

    const configMap = new Map<string, string>();
    for (const entry of configEntries) {
      configMap.set(entry.key, entry.value);
    }

    return {
      enabled: parseBoolean(
        configMap.get(CLEANUP_CONFIG_KEYS.ENABLED),
        DEFAULT_CLEANUP_CONFIG.enabled
      ),
      deleteFiles: parseBoolean(
        configMap.get(CLEANUP_CONFIG_KEYS.DELETE_FILES),
        DEFAULT_CLEANUP_CONFIG.deleteFiles
      ),
      keepTorrentsForSeeding: parseBoolean(
        configMap.get(CLEANUP_CONFIG_KEYS.KEEP_TORRENTS_FOR_SEEDING),
        DEFAULT_CLEANUP_CONFIG.keepTorrentsForSeeding
      ),
    };
  } catch (error: unknown) {
    logger.warn('[CleanupService] Failed to load config, using defaults', {
      error: error instanceof Error ? error.message : String(error),
    });
    return DEFAULT_CLEANUP_CONFIG;
  }
}

/**
 * Remove a successfully-imported download from its client.
 *
 * Skips when:
 *   - Cleanup is globally disabled
 *   - PackDownload is missing clientType or downloadId
 *   - Protocol is 'torrent' and keepTorrentsForSeeding is true
 *
 * Errors are logged and swallowed — never throws.
 */
export async function cleanupAfterImport(
  prismaClient: PrismaClient,
  packDownload: PackDownload,
  clientService: ClientDownloadService = new ClientDownloadService(prismaClient)
): Promise<void> {
  try {
    const config = await getCleanupConfig(prismaClient);

    if (!config.enabled) {
      logger.debug('[CleanupService] Cleanup disabled, skipping', {
        packDownloadId: String(packDownload.id),
      });
      return;
    }

    if (!packDownload.clientType || !packDownload.downloadId) {
      logger.debug('[CleanupService] PackDownload missing clientType/downloadId, skipping', {
        packDownloadId: String(packDownload.id),
        clientType: packDownload.clientType,
        downloadId: packDownload.downloadId,
      });
      return;
    }

    if (packDownload.protocol === 'torrent' && config.keepTorrentsForSeeding) {
      logger.info('[CleanupService] Seedbox mode: keeping torrent for ratio', {
        packDownloadId: String(packDownload.id),
        downloadId: packDownload.downloadId,
        clientType: packDownload.clientType,
      });
      return;
    }

    logger.info('[CleanupService] Removing imported download from client', {
      packDownloadId: String(packDownload.id),
      clientType: packDownload.clientType,
      downloadId: packDownload.downloadId,
      protocol: packDownload.protocol,
      deleteFiles: config.deleteFiles,
    });

    const removeResult = await clientService.removeDownload(
      packDownload.clientType,
      packDownload.downloadId,
      config.deleteFiles
    );

    if (isError(removeResult)) {
      logger.warn('[CleanupService] Failed to remove download from client (orphan left behind)', {
        packDownloadId: String(packDownload.id),
        clientType: packDownload.clientType,
        downloadId: packDownload.downloadId,
        error: removeResult.error.message,
      });
      return;
    }

    logger.info('[CleanupService] Successfully removed imported download from client', {
      packDownloadId: String(packDownload.id),
      clientType: packDownload.clientType,
      downloadId: packDownload.downloadId,
    });
  } catch (error: unknown) {
    logger.warn('[CleanupService] Unexpected error during cleanup (orphan left behind)', {
      packDownloadId: String(packDownload.id),
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
