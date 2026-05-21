/**
 * Service Worker Manager
 *
 * Manages service worker registration and communication:
 * - Registration with update handling
 * - Message passing
 * - Cache management
 * - Offline action queue
 */
import { logger } from '@/utils/logger';

import {
  createSuccessResult,
  createErrorResult,
  isError
} from '../async-result';
import { isRecord } from '../type-guards/index';

import type {
  AsyncResult} from '../async-result';
export interface ServiceWorkerStatus {
    isSupported: boolean;
    isRegistered: boolean;
    isActive: boolean;
    isUpdateAvailable: boolean;
    registration?: ServiceWorkerRegistration;
}
export interface OfflineAction {
    id: string;
    timestamp: number;
    method: string;
    url: string;
    headers?: Record<string, string>;
    body?: string;
    retryCount: number;
    maxRetries: number;
}
class ServiceWorkerManager {
    private registration: ServiceWorkerRegistration | null = null;
    private updateCallbacks: Set<() => void> = new Set();
    private messageHandlers: Map<string, (data: unknown) => void> = new Map();
    /**
     * Check if service workers are supported
     */
    isSupported(): boolean {
        return 'serviceWorker' in navigator;
    }
    /**
     * Register service worker
     */
    async register(): Promise<AsyncResult<ServiceWorkerRegistration, Error>> {
        try {
            if (!this.isSupported()) {
                return createErrorResult(new Error('Service workers not supported'));
            }
            // Register service worker
            const registration = await navigator.serviceWorker.register('/service-worker.js', {
                scope: '/'
            });
            this.registration = registration;
            // Listen for updates
            registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing;
                if (!newWorker)
                    return;
                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        // New service worker available
                        this.notifyUpdateAvailable();
                    }
                });
            });
            // Listen for messages
            navigator.serviceWorker.addEventListener('message', this.handleMessage);
            logger.info('[SW Manager] Service worker registered');
            return createSuccessResult(registration);
        }
        catch (error: unknown) {
            logger.error('[SW Manager] Registration failed:', error);
            return createErrorResult(error instanceof Error ? error : new Error('Service worker registration failed'));
        }
    }
    /**
     * Unregister service worker
     */
    async unregister(): Promise<AsyncResult<void, Error>> {
        try {
            if (!this.registration) {
                return createSuccessResult(undefined);
            }
            const success = await this.registration.unregister();
            if (!success) {
                return createErrorResult(new Error('Failed to unregister service worker'));
            }
            this.registration = null;
            navigator.serviceWorker.removeEventListener('message', this.handleMessage);
            logger.info('[SW Manager] Service worker unregistered');
            return createSuccessResult(undefined);
        }
        catch (error: unknown) {
            return createErrorResult(error instanceof Error ? error : new Error('Service worker unregistration failed'));
        }
    }
    /**
     * Get current status
     */
    async getStatus(): Promise<AsyncResult<ServiceWorkerStatus, Error>> {
        try {
            const status: ServiceWorkerStatus = {
                isSupported: this.isSupported(),
                isRegistered: false,
                isActive: false,
                isUpdateAvailable: false
            };
            if (!status.isSupported) {
                return createSuccessResult(status);
            }
            // Check registration
            const registrations = await navigator.serviceWorker.getRegistrations();
            const firstRegistration = registrations[0];
            if (registrations.length > 0 && firstRegistration) {
                status.isRegistered = true;
                status.registration = firstRegistration;
                status.isActive = !!firstRegistration.active;
                // Check for updates
                if (firstRegistration.waiting) {
                    status.isUpdateAvailable = true;
                }
            }
            return createSuccessResult(status);
        }
        catch (error: unknown) {
            return createErrorResult(error instanceof Error ? error : new Error('Failed to get service worker status'));
        }
    }
    /**
     * Update service worker
     */
    async update(): Promise<AsyncResult<void, Error>> {
        try {
            if (!this.registration) {
                return createErrorResult(new Error('No service worker registered'));
            }
            // Check for updates
            await this.registration.update();
            // If update is waiting, skip waiting
            if (this.registration.waiting) {
                this.postMessage('SKIP_WAITING');
                // Reload page when new service worker takes control
                let refreshing = false;
                navigator.serviceWorker.addEventListener('controllerchange', () => {
                    if (!refreshing) {
                        refreshing = true;
                        window.location.reload();
                    }
                });
            }
            return createSuccessResult(undefined);
        }
        catch (error: unknown) {
            return createErrorResult(error instanceof Error ? error : new Error('Service worker update failed'));
        }
    }
    /**
     * Post message to service worker
     */
    postMessage(type: string, payload?: unknown): AsyncResult<void, Error> {
        try {
            if (!navigator.serviceWorker.controller) {
                return createErrorResult(new Error('No active service worker'));
            }
            navigator.serviceWorker.controller.postMessage({
                type,
                payload
            });
            return createSuccessResult(undefined);
        }
        catch (error: unknown) {
            return createErrorResult(error instanceof Error ? error : new Error('Failed to post message to service worker'));
        }
    }
    /**
     * Clear all caches
     */
    clearCaches(): AsyncResult<void, Error> {
        try {
            const result = this.postMessage('CLEAR_CACHE');
            if (isError(result)) {
                return result;
            }
            logger.info('[SW Manager] Caches cleared');
            return createSuccessResult(undefined);
        }
        catch (error: unknown) {
            return createErrorResult(error instanceof Error ? error : new Error('Failed to clear caches'));
        }
    }
    /**
     * Cache manga for offline reading
     */
    cacheManga(mangaData: {
        mangaId: string;
        title: string;
        chapters: unknown[];
        coverUrl?: string;
    }): AsyncResult<void, Error> {
        try {
            const result = this.postMessage('CACHE_MANGA', mangaData);
            if (isError(result)) {
                return result;
            }
            logger.info(`[SW Manager] Cached manga: ${mangaData["title"]}`);
            return createSuccessResult(undefined);
        }
        catch (error: unknown) {
            return createErrorResult(error instanceof Error ? error : new Error('Failed to cache manga'));
        }
    }
    /**
     * Sync offline actions
     */
    async syncOfflineActions(): Promise<AsyncResult<void, Error>> {
        try {
            // Check if background sync is supported
            if ('sync' in ServiceWorkerRegistration.prototype && this.registration && 'sync' in this.registration) {
                const regWithSync = this.registration as ServiceWorkerRegistration & { sync: { register: (tag: string) => Promise<void> } };
                await regWithSync.sync.register('sync-actions');
            }
            else {
                // Fallback to direct message
                this.postMessage('SYNC_ACTIONS');
            }
            return createSuccessResult(undefined);
        }
        catch (error: unknown) {
            return createErrorResult(error instanceof Error ? error : new Error('Failed to sync offline actions'));
        }
    }
    /**
     * Add offline action to queue
     */
    async queueOfflineAction(action: Omit<OfflineAction, 'id' | 'timestamp'>): Promise<AsyncResult<string, Error>> {
        try {
            const db = await this.openOfflineDB();
            const transaction = db.transaction(['actions'], 'readwrite');
            const store = transaction.objectStore('actions');
            const offlineAction: OfflineAction = {
                ...action,
                // eslint-disable-next-line no-undef
                id: crypto.randomUUID(),
                timestamp: Date.now()
            };
            await new Promise<void>((resolve, reject) => {
                const request = store.add(offlineAction);
                request.onsuccess = () => resolve();
                request.onerror = () => reject(new Error(request.error?.message ?? 'Failed to add offline action'));
            });
            // Try to sync immediately if online
            if (navigator.onLine) {
                void this.syncOfflineActions();
            }
            return createSuccessResult(offlineAction["id"]);
        }
        catch (error: unknown) {
            return createErrorResult(error instanceof Error ? error : new Error('Failed to queue offline action'));
        }
    }
    /**
     * Get pending offline actions
     */
    async getPendingActions(): Promise<AsyncResult<OfflineAction[], Error>> {
        try {
            const db = await this.openOfflineDB();
            const transaction = db.transaction(['actions'], 'readonly');
            const store = transaction.objectStore('actions');
            const actions = await new Promise<OfflineAction[]>((resolve, reject) => {
                const request = store.getAll();
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(new Error(request.error?.message ?? 'Failed to get all actions'));
            });
            return createSuccessResult(actions);
        }
        catch (error: unknown) {
            return createErrorResult(error instanceof Error ? error : new Error('Failed to get pending actions'));
        }
    }
    /**
     * Subscribe to update notifications
     */
    onUpdateAvailable(callback: () => void): () => void {
        this.updateCallbacks.add(callback);
        return () => this.updateCallbacks.delete(callback);
    }
    /**
     * Register message handler
     */
    onMessage(type: string, handler: (data: unknown) => void): () => void {
        this.messageHandlers.set(type, handler);
        return () => this.messageHandlers.delete(type);
    }
    /**
     * Handle messages from service worker
     */
    private handleMessage = (event: MessageEvent): void => {
        const eventData: unknown = event.data;
        if (!isRecord(eventData)) {
            return;
        }
        const type = eventData['type'];
        if (typeof type !== 'string') {
            return;
        }
        const { type: _, ...data } = eventData;
        const handler = this.messageHandlers.get(type);
        if (handler) {
            handler(data);
        }
    };
    /**
     * Notify update available
     */
    private notifyUpdateAvailable(): void {
        this.updateCallbacks.forEach(callback => callback());
    }
    /**
     * Open offline actions database
     */
    private openOfflineDB(): Promise<IDBDatabase> {
        return new Promise((resolve, reject) => {
            // eslint-disable-next-line no-undef
            const request = indexedDB.open('offline-actions', 1);
            request.onerror = () => reject(new Error(request.error?.message ?? 'Failed to open offline database'));
            request.onsuccess = () => resolve(request.result);
            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;
                if (!db.objectStoreNames.contains('actions')) {
                    const store = db.createObjectStore('actions', { keyPath: 'id' });
                    store.createIndex('timestamp', 'timestamp');
                }
            };
        });
    }
}
// Export singleton instance
export const serviceWorkerManager = new ServiceWorkerManager();
// Initialize on module load
if (typeof window !== 'undefined') {
    // Register service worker when page loads
    window.addEventListener('load', () => {
        void serviceWorkerManager.register();
    });
    // Sync actions when coming back online
    window.addEventListener('online', () => {
        void serviceWorkerManager.syncOfflineActions();
    });
}
