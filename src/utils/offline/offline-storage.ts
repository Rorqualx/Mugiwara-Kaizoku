/**
 * Offline Storage Utilities
 *
 * Manages offline data storage using IndexedDB:
 * - Manga metadata caching
 * - Chapter content storage
 * - Download queue management
 * - Storage quota monitoring
 */
import { logger } from '@/utils/logger';

import { createSuccessResult, createErrorResult } from '../async-result';

import type { AsyncResult} from '../async-result';
import type { Manga as MangaEntity } from '@prisma/client';
import type { Chapter as ChapterEntity } from '@prisma/client';
const DB_NAME = 'mugiwara-offline';
const DB_VERSION = 1;
export interface OfflineManga {
    manga: MangaEntity;
    chapters: ChapterEntity[];
    coverUrl?: string;
    downloadedAt: number;
    size: number;
}
export interface OfflineChapterContent {
    chapterId: string;
    mangaId: string;
    pages: string[]; // Array of page URLs or data URLs
    downloadedAt: number;
    size: number;
}
export interface StorageQuota {
    usage: number;
    quota: number;
    percentUsed: number;
}
export interface DownloadQueueItem {
    id: string;
    mangaId: string;
    chapterId?: string;
    priority: number;
    status: 'PENDING' | 'downloading' | 'completed' | 'failed';
    progress: number;
    error?: string;
    addedAt: number;
    startedAt?: number;
    completedAt?: number;
}
class OfflineStorage {
    private db: IDBDatabase | null = null;
    /**
     * Initialize database
     */
    async init(): Promise<AsyncResult<void, Error>> {
        try {
            if (this.db) {
                return createSuccessResult(undefined);
            }
            this.db = await this.openDB();
            return createSuccessResult(undefined);
        }
        catch (error: unknown) {
            return createErrorResult(error instanceof Error ? error : new Error('Failed to initialize offline storage'));
        }
    }
    /**
     * Save manga for offline reading
     */
    async saveManga(manga: MangaEntity, chapters: ChapterEntity[], coverUrl?: string): Promise<AsyncResult<void, Error>> {
        try {
            const db = await this.ensureDB();
            const size = this.estimateDataSize({ manga, chapters, coverUrl });
            const offlineManga: OfflineManga = {
                manga,
                chapters,
                ...(coverUrl !== undefined ? { coverUrl } : {}),
                downloadedAt: Date.now(),
                size
            };
            const transaction = db.transaction(['manga'], 'readwrite');
            const store = transaction.objectStore('manga');
            await new Promise<void>((resolve, reject) => {
                const request = store.put(offlineManga, manga["id"]);
                request.onsuccess = () => resolve();
                request.onerror = () => reject(new Error(request.error?.message ?? 'Database operation failed'));
            });
            logger.info(`[Offline Storage] Saved manga: ${manga["title"]}`);
            return createSuccessResult(undefined);
        }
        catch (error: unknown) {
            return createErrorResult(error instanceof Error ? error : new Error('Failed to save manga offline'));
        }
    }
    /**
     * Get offline manga
     */
    async getManga(mangaId: string): Promise<AsyncResult<OfflineManga | null, Error>> {
        try {
            const db = await this.ensureDB();
            const transaction = db.transaction(['manga'], 'readonly');
            const store = transaction.objectStore('manga');
            const manga = await new Promise<OfflineManga | null>((resolve, reject) => {
                const request = store.get(mangaId);
                request.onsuccess = () => resolve(request.result as OfflineManga | undefined ?? null);
                request.onerror = () => reject(new Error(request.error?.message ?? 'Database operation failed'));
            });
            return createSuccessResult(manga);
        }
        catch (error: unknown) {
            return createErrorResult(error instanceof Error ? error : new Error('Failed to get offline manga'));
        }
    }
    /**
     * Get all offline manga
     */
    async getAllManga(): Promise<AsyncResult<OfflineManga[], Error>> {
        try {
            const db = await this.ensureDB();
            const transaction = db.transaction(['manga'], 'readonly');
            const store = transaction.objectStore('manga');
            const mangaList = await new Promise<OfflineManga[]>((resolve, reject) => {
                const request = store.getAll();
                request.onsuccess = () => resolve((request.result as OfflineManga[] | undefined) ?? []);
                request.onerror = () => reject(new Error(request.error?.message ?? 'Database operation failed'));
            });
            return createSuccessResult(mangaList);
        }
        catch (error: unknown) {
            return createErrorResult(error instanceof Error ? error : new Error('Failed to get offline manga list'));
        }
    }
    /**
     * Delete offline manga
     */
    async deleteManga(mangaId: string): Promise<AsyncResult<void, Error>> {
        try {
            const db = await this.ensureDB();
            const transaction = db.transaction(['manga', 'chapters'], 'readwrite');
            // Delete manga
            await new Promise<void>((resolve, reject) => {
                const request = transaction.objectStore('manga').delete(mangaId);
                request.onsuccess = () => resolve();
                request.onerror = () => reject(new Error(request.error?.message ?? 'Database operation failed'));
            });
            // Delete associated chapters
            const chapterStore = transaction.objectStore('chapters');
            const index = chapterStore.index('mangaId');
            const range = IDBKeyRange.only(mangaId);
            await new Promise<void>((resolve, reject) => {
                const request = index.openCursor(range);
                request.onsuccess = () => {
                    const cursor = request.result;
                    if (cursor) {
                        cursor.delete();
                        cursor.continue();
                    }
                    else {
                        resolve();
                    }
                };
                request.onerror = () => reject(new Error(request.error?.message ?? 'Database operation failed'));
            });
            logger.info(`[Offline Storage] Deleted manga: ${mangaId}`);
            return createSuccessResult(undefined);
        }
        catch (error: unknown) {
            return createErrorResult(error instanceof Error ? error : new Error('Failed to delete offline manga'));
        }
    }
    /**
     * Save chapter content
     */
    async saveChapterContent(chapterId: string, mangaId: string, pages: string[]): Promise<AsyncResult<void, Error>> {
        try {
            const db = await this.ensureDB();
            const size = pages.reduce((sum, page) => sum + page.length, 0);
            const chapterContent: OfflineChapterContent = {
                chapterId,
                mangaId,
                pages,
                downloadedAt: Date.now(),
                size
            };
            const transaction = db.transaction(['chapters'], 'readwrite');
            const store = transaction.objectStore('chapters');
            await new Promise<void>((resolve, reject) => {
                const request = store.put(chapterContent, chapterId);
                request.onsuccess = () => resolve();
                request.onerror = () => reject(new Error(request.error?.message ?? 'Database operation failed'));
            });
            logger.info(`[Offline Storage] Saved chapter content: ${chapterId}`);
            return createSuccessResult(undefined);
        }
        catch (error: unknown) {
            return createErrorResult(error instanceof Error ? error : new Error('Failed to save chapter content'));
        }
    }
    /**
     * Get chapter content
     */
    async getChapterContent(chapterId: string): Promise<AsyncResult<OfflineChapterContent | null, Error>> {
        try {
            const db = await this.ensureDB();
            const transaction = db.transaction(['chapters'], 'readonly');
            const store = transaction.objectStore('chapters');
            const content = await new Promise<OfflineChapterContent | null>((resolve, reject) => {
                const request = store.get(chapterId);
                request.onsuccess = () => resolve(request.result as OfflineChapterContent | undefined ?? null);
                request.onerror = () => reject(new Error(request.error?.message ?? 'Database operation failed'));
            });
            return createSuccessResult(content);
        }
        catch (error: unknown) {
            return createErrorResult(error instanceof Error ? error : new Error('Failed to get chapter content'));
        }
    }
    /**
     * Add to download queue
     */
    async addToQueue(mangaId: string, chapterId?: string, priority: number = 0): Promise<AsyncResult<string, Error>> {
        try {
            const db = await this.ensureDB();
            const queueItem: DownloadQueueItem = {
                // eslint-disable-next-line no-undef
                id: crypto.randomUUID(),
                mangaId,
                ...(chapterId !== undefined ? { chapterId } : {}),
                priority,
                status: 'PENDING',
                progress: 0,
                addedAt: Date.now()
            };
            const transaction = db.transaction(['queue'], 'readwrite');
            const store = transaction.objectStore('queue');
            await new Promise<void>((resolve, reject) => {
                const request = store.put(queueItem, queueItem["id"]);
                request.onsuccess = () => resolve();
                request.onerror = () => reject(new Error(request.error?.message ?? 'Database operation failed'));
            });
            return createSuccessResult(queueItem["id"]);
        }
        catch (error: unknown) {
            return createErrorResult(error instanceof Error ? error : new Error('Failed to add to download queue'));
        }
    }
    /**
     * Get download queue
     */
    async getQueue(): Promise<AsyncResult<DownloadQueueItem[], Error>> {
        try {
            const db = await this.ensureDB();
            const transaction = db.transaction(['queue'], 'readonly');
            const store = transaction.objectStore('queue');
            const index = store.index('priority');
            const items = await new Promise<DownloadQueueItem[]>((resolve, reject) => {
                const request = index.getAll();
                request.onsuccess = () => resolve((request.result as DownloadQueueItem[] | undefined) ?? []);
                request.onerror = () => reject(new Error(request.error?.message ?? 'Database operation failed'));
            });
            // Sort by priority (descending) and then by addedAt (ascending)
            items.sort((a, b) => {
                if (a.priority !== b.priority) {
                    return b.priority - a.priority;
                }
                return a.addedAt - b.addedAt;
            });
            return createSuccessResult(items);
        }
        catch (error: unknown) {
            return createErrorResult(error instanceof Error ? error : new Error('Failed to get download queue'));
        }
    }
    /**
     * Update queue item
     */
    async updateQueueItem(id: string, updates: Partial<DownloadQueueItem>): Promise<AsyncResult<void, Error>> {
        try {
            const db = await this.ensureDB();
            const transaction = db.transaction(['queue'], 'readwrite');
            const store = transaction.objectStore('queue');
            // Get existing item
            const existing = await new Promise<DownloadQueueItem | undefined>((resolve, reject) => {
                const request = store.get(id);
                request.onsuccess = () => resolve(request.result as DownloadQueueItem | undefined);
                request.onerror = () => reject(new Error(request.error?.message ?? 'Database operation failed'));
            });
            if (!existing) {
                return createErrorResult(new Error('Queue item not found'));
            }
            // Update item
            const updated = { ...existing, ...updates };
            await new Promise<void>((resolve, reject) => {
                const request = store.put(updated, id);
                request.onsuccess = () => resolve();
                request.onerror = () => reject(new Error(request.error?.message ?? 'Database operation failed'));
            });
            return createSuccessResult(undefined);
        }
        catch (error: unknown) {
            return createErrorResult(error instanceof Error ? error : new Error('Failed to update queue item'));
        }
    }
    /**
     * Get storage quota
     */
    async getStorageQuota(): Promise<AsyncResult<StorageQuota, Error>> {
        try {
            if (!('storage' in navigator) || !('estimate' in navigator.storage)) {
                return createSuccessResult({
                    usage: 0,
                    quota: 0,
                    percentUsed: 0
                });
            }
            const estimate = await navigator.storage.estimate();
            const usage = estimate.usage ?? 0;
            const quota = estimate.quota ?? 0;
            const percentUsed = quota > 0 ? usage / quota * 100 : 0;
            return createSuccessResult({
                usage,
                quota,
                percentUsed
            });
        }
        catch (error: unknown) {
            return createErrorResult(error instanceof Error ? error : new Error('Failed to get storage quota'));
        }
    }
    /**
     * Clear all offline data
     */
    async clearAll(): Promise<AsyncResult<void, Error>> {
        try {
            const db = await this.ensureDB();
            const transaction = db.transaction(['manga', 'chapters', 'queue'], 'readwrite');
            await Promise.all([
                this.clearStore(transaction.objectStore('manga')),
                this.clearStore(transaction.objectStore('chapters')),
                this.clearStore(transaction.objectStore('queue'))
            ]);
            logger.info('[Offline Storage] Cleared all offline data');
            return createSuccessResult(undefined);
        }
        catch (error: unknown) {
            return createErrorResult(error instanceof Error ? error : new Error('Failed to clear offline data'));
        }
    }
    /**
     * Open database
     */
    private openDB(): Promise<IDBDatabase> {
        return new Promise((resolve, reject) => {
            // eslint-disable-next-line no-undef
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            request.onerror = () => reject(new Error(request.error?.message ?? 'Database operation failed'));
            request.onsuccess = () => resolve(request.result);
            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;
                // Manga store
                if (!db.objectStoreNames.contains('manga')) {
                    const mangaStore = db.createObjectStore('manga');
                    mangaStore.createIndex('downloadedAt', 'downloadedAt');
                }
                // Chapters store
                if (!db.objectStoreNames.contains('chapters')) {
                    const chapterStore = db.createObjectStore('chapters');
                    chapterStore.createIndex('mangaId', 'mangaId');
                    chapterStore.createIndex('downloadedAt', 'downloadedAt');
                }
                // Download queue store
                if (!db.objectStoreNames.contains('queue')) {
                    const queueStore = db.createObjectStore('queue');
                    queueStore.createIndex('status', 'status');
                    queueStore.createIndex('priority', 'priority');
                    queueStore.createIndex('addedAt', 'addedAt');
                }
            };
        });
    }
    /**
     * Ensure database is initialized
     */
    private async ensureDB(): Promise<IDBDatabase> {
        if (!this.db) {
            const result = await this.init();
            if (result["status"] === 'error') {
                throw result.error;
            }
        }
        if (!this.db) {
            throw new Error('Database initialization failed');
        }
        return this.db;
    }
    /**
     * Clear object store
     */
    private clearStore(store: IDBObjectStore): Promise<void> {
        return new Promise((resolve, reject) => {
            const request = store.clear();
            request.onsuccess = () => resolve();
            request.onerror = () => reject(new Error(request.error?.message ?? 'Database operation failed'));
        });
    }
    /**
     * Estimate data size
     */
    private estimateDataSize(data: unknown): number {
        try {
            return JSON.stringify(data).length;
        }
        catch {
            return 0;
        }
    }
}
// Export singleton instance
export const offlineStorage = new OfflineStorage();
