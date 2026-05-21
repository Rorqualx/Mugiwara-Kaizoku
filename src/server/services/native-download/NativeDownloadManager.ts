/**
 * NativeDownloadManager - Main Service Class
 *
 * Manages download operations and queue management.
 * Note: Custom source management has been removed. Sources are now
 * identified by string identifiers (e.g., 'MANGADEX', 'GETCOMICS').
 *
 * Architecture:
 * - native-download/types.ts - Types, interfaces, constants
 * - native-download/notifications.ts - Notification helpers
 * - native-download/download-manager.ts - Download operations
 * - native-download/queue-manager.ts - Queue management
 */


import type { INativeDownloadAdapter } from '@/types/adapters/native-download-types';
import type { MangaSearchResult } from '@/types/search.types';
import type { AsyncResult } from '@/utils/async-result';
import { ValidationError } from '@/utils/errors';
import { logger } from '@/utils/logger';

import { DownloadManager } from './download-manager';
import { QueueManager } from './queue-manager';

import type { ActiveDownload, NativeDownloadSearchOptions } from './types';
import type { PrismaClient } from '@prisma/client';

/**
 * Manager service for native download functionality
 *
 * Delegates operations to specialized modules:
 * - DownloadManager: Download operations and monitoring
 * - QueueManager: Queue management for downloads and syncs
 *
 * Note: Custom source management has been removed.
 */
export class NativeDownloadManager {
    private downloadManager: DownloadManager;
    private queueManager: QueueManager;
    private adapters: Map<string, INativeDownloadAdapter> = new Map();

    constructor(prisma: PrismaClient) {
        this.downloadManager = new DownloadManager(
            prisma,
            () => this.adapters as Map<string, unknown>
        );
        this.queueManager = new QueueManager(prisma);
    }

    // ============================================================================
    // Source Management (no-op stubs for backward compatibility)
    // ============================================================================

    /**
     * Initialize the manager
     * Note: Custom source loading has been removed
     */
    initialize(): void {
        logger.info('[NativeDownloadManager] Initialized (custom sources disabled)');
    }

    /**
     * Search for manga across sources
     * Note: Custom source search has been removed, returns empty array
     */
    searchManga(_params: NativeDownloadSearchOptions): MangaSearchResult[] {
        logger.warn('[NativeDownloadManager] searchManga called but custom sources are disabled');
        return [];
    }

    /**
     * Validate a source by testing its connection
     * Note: Custom source validation has been removed, always returns true
     */
    validateSource(_sourceId: string): boolean {
        return true;
    }

    /**
     * Get an adapter by source ID
     * Note: Custom adapters have been removed, always returns undefined
     */
    getAdapter(_sourceId: string): INativeDownloadAdapter | undefined {
        return undefined;
    }

    /**
     * Reload adapters after source changes
     * Note: No-op since custom sources are disabled
     */
    async reloadAdapters(): Promise<void> {
        // No-op
    }

    /**
     * Clean up resources
     */
    dispose(): void {
        this.adapters.clear();
    }

    // ============================================================================
    // Download Management (delegated to DownloadManager)
    // ============================================================================

    /**
     * Download a chapter
     */
    async downloadChapter(
        sourceId: string,
        mangaId: string,
        chapterId: string,
        downloadId: string
    ): Promise<AsyncResult<void, Error>> {
        return this.downloadManager.downloadChapter(sourceId, mangaId, chapterId, downloadId);
    }

    /**
     * Get active downloads
     */
    async getActiveDownloads(): Promise<ActiveDownload[]> {
        return this.downloadManager.getActiveDownloads();
    }

    /**
     * Cancel a download
     */
    async cancelDownload(downloadId: string): Promise<void> {
        return this.downloadManager.cancelDownload(downloadId);
    }

    /**
     * Retry a failed download
     */
    async retryDownload(downloadId: string): Promise<void> {
        return this.downloadManager.retryDownload(downloadId);
    }

    // ============================================================================
    // Queue Management (delegated to QueueManager)
    // ============================================================================

    /**
     * Queue a download by ID
     *
     * Note: Job creation is handled by the caller (typically in tRPC mutation).
     * This method only updates the download status to QUEUED.
     */
    async queueDownload(downloadId: string): Promise<AsyncResult<void, Error>> {
        return this.queueManager.queueDownload(downloadId);
    }

    /**
     * Queue a source sync task
     */
    async queueSourceSync(sourceId: string, fullSync = false): Promise<AsyncResult<void, Error>> {
        return this.queueManager.queueSourceSync(sourceId, fullSync);
    }

    /**
     * Queue a source validation task
     */
    async queueSourceValidation(sourceId: string, testQuery?: string): Promise<AsyncResult<void, Error>> {
        return this.queueManager.queueSourceValidation(sourceId, testQuery);
    }
}

// ============================================================================
// Singleton Instance Management
// ============================================================================

let managerInstance: NativeDownloadManager | null = null;

/**
 * Get or create the native download manager instance
 */
export async function getNativeDownloadManager(prismaClient?: PrismaClient): Promise<NativeDownloadManager> {
    if (!managerInstance) {
        const client = prismaClient ?? (await import('@/server/db').then((m) => m.prisma));
        if (!client) {
            throw new ValidationError('Failed to get Prisma client');
        }
        managerInstance = new NativeDownloadManager(client);
        managerInstance.initialize();
    }
    return managerInstance;
}

/**
 * Reset the manager instance (for testing)
 */
export function resetNativeDownloadManager(): void {
    if (managerInstance) {
        managerInstance.dispose();
        managerInstance = null;
    }
}
