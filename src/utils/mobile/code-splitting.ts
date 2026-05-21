/**
 * Code Splitting Utilities
 *
 * Utilities for code splitting and dynamic imports:
 * - Route-based splitting
 * - Component lazy loading
 * - Prefetching strategies
 * - Bundle analysis helpers
 */
import type { ComponentType } from 'react';
import { lazy } from 'react';

import { ValidationError } from '@/utils/errors';
import { getErrorMessage } from '@/utils/errors/helpers';
import { logger } from '@/utils/logger';

import { isLowEndDevice, getNetworkInfo } from './performance';
/**
 * Route configuration for code splitting
 */
export interface RouteConfig {
    path: string;
    component: () => Promise<{
        default: ComponentType<unknown>;
    }>;
    prefetch?: boolean;
    preload?: boolean;
    chunkName?: string;
}
/**
 * Lazy loading options
 */
export interface LazyOptions {
    /** Prefetch the component */
    prefetch?: boolean;
    /** Preload on specific events */
    preloadOn?: ('hover' | 'focus' | 'visible')[];
    /** Delay before loading (ms) */
    delay?: number;
    /** Retry on failure */
    retry?: {
        count: number;
        delay: number;
    };
    /** Loading chunk name for webpack */
    chunkName?: string;
}
/**
 * Enhanced lazy loading with retry and prefetch
 */
export function lazyWithRetry<T extends ComponentType<unknown>>(componentImport: () => Promise<{
    default: T;
}>, options: LazyOptions = {}): React.LazyExoticComponent<T> {
    const { prefetch = false, preloadOn: _preloadOn = [], retry = { count: 3, delay: 1000 }, chunkName } = options;
    // Wrapper function with retry logic
    const importWithRetry = async (retryCount = 0): Promise<{
        default: T;
    }> => {
        try {
            // Add webpack chunk name if provided
            if (chunkName) {
                return await componentImport();
            }
            return await componentImport();
        }
        catch (error: unknown) {
            if (retryCount < retry.count) {
                logger.warn(`[Code Splitting] Retry attempt ${retryCount + 1} for component`);
                await new Promise<void>((resolve) => { setTimeout(resolve, retry.delay); });
                return importWithRetry(retryCount + 1);
            }
            throw error;
        }
    };
    // Prefetch if requested

    if (prefetch && typeof window !== 'undefined') {
        // Use requestIdleCallback if available
        if ('requestIdleCallback' in window) {
            // eslint-disable-next-line no-undef
            requestIdleCallback(() => { void componentImport(); });
        }
        else {
            setTimeout(() => { void componentImport(); }, 1);
        }
    }
    return lazy(() => importWithRetry());
}
/**
 * Create route-based code splits
 */
export function createRouteSplits(routes: RouteConfig[]): Record<string, React.LazyExoticComponent<ComponentType<unknown>>> {
    const splitRoutes: Record<string, React.LazyExoticComponent<ComponentType<unknown>>> = {};
    routes.forEach((route) => {
        const options: LazyOptions = {};
        if (route.prefetch !== undefined) {
            options.prefetch = route.prefetch;
        }
        if (route.chunkName !== undefined) {
            options.chunkName = route.chunkName;
        }
        splitRoutes[route.path] = lazyWithRetry(route.component, options);
        // Preload if specified

        if (route.preload && typeof window !== 'undefined') {
            void route.component();
        }
    });
    return splitRoutes;
}
/**
 * Prefetch components based on user interaction
 */
export function setupInteractionPrefetch(element: HTMLElement, componentImport: () => Promise<unknown>, events: ('hover' | 'focus' | 'visible')[] = ['hover', 'focus']): void {
    let prefetched = false;
    const prefetch = (): void => {
        if (!prefetched) {
            prefetched = true;
            void componentImport();
        }
    };
    // Hover prefetch
    if (events.includes('hover')) {
        element.addEventListener('mouseenter', prefetch, { once: true });
        element.addEventListener('touchstart', prefetch, { once: true });
    }
    // Focus prefetch
    if (events.includes('focus')) {
        element.addEventListener('focus', prefetch, { once: true });
    }
    // Visible prefetch using Intersection Observer
    if (events.includes('visible') && 'IntersectionObserver' in window) {
        const observer = new IntersectionObserver((entries) => {
            const firstEntry = entries[0];
            if (firstEntry?.isIntersecting) {
                prefetch();
                observer.disconnect();
            }
        }, { rootMargin: '50px' });
        observer.observe(element);
    }
}
/**
 * Get optimal chunk size based on network and device
 */
export function getOptimalChunkSize(): number {
    const network = getNetworkInfo();
    const isLowEnd = isLowEndDevice();
    // Base chunk sizes in KB
    let chunkSize = 244; // Default webpack chunk size
    // Adjust based on network
    switch (network.effectiveType) {
        case 'slow-2g':
        case '2g':
            chunkSize = 50;
            break;
        case '3g':
            chunkSize = 150;
            break;
        case '4g':
        default:
            chunkSize = 244;
    }
    // Further reduce for low-end devices
    if (isLowEnd) {
        chunkSize = Math.round(chunkSize * 0.7);
    }
    // Consider save data preference
    if (network.saveData) {
        chunkSize = Math.min(chunkSize, 100);
    }
    return chunkSize * 1024; // Convert to bytes
}
/**
 * Dynamic import with loading states
 */
export function dynamicImport<T = unknown>(path: string, options?: {
    timeout?: number;
    fallback?: T;
}): Promise<T> {
    const { timeout: _timeout = 30000, fallback } = options ?? {};
    try {
        throw new ValidationError('Dynamic import with variable paths is not supported by webpack');
    }
    catch (error: unknown) {
        const _errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(`[Dynamic Import] Failed to load ${path}:`, error);
        if (fallback !== undefined) {
            return Promise.resolve(fallback);
        }
        return Promise.reject(error instanceof Error ? error : new Error(String(error)));
    }
}
/**
 * Route prefetching strategy
 */
export class RoutePrefetcher {
    private prefetchedRoutes = new Set<string>();
    private prefetchQueue: string[] = [];
    private isPrefetching = false;
    constructor(private routes: Map<string, () => Promise<unknown>>, private options: {
        maxConcurrent?: number;
        delay?: number;
        networkAware?: boolean;
    } = {}) {
        this.setupNetworkListener();
    }
    /**
     * Prefetch a specific route
     */
    prefetchRoute(path: string): Promise<void> {
        if (this.prefetchedRoutes.has(path) || !this.routes.has(path)) {
            return Promise.resolve();
        }
        // Check network conditions
        if (this.options.networkAware && !this.shouldPrefetch()) {
            return Promise.resolve();
        }
        this.prefetchQueue.push(path);
        void this.processPrefetchQueue();
        return Promise.resolve();
    }
    /**
     * Prefetch multiple routes
     */
    prefetchRoutes(paths: string[]): void {
        paths.forEach((path) => { void this.prefetchRoute(path); });
    }
    /**
     * Prefetch adjacent routes (prev/next)
     */
    prefetchAdjacentRoutes(currentPath: string): void {
        const routeArray = Array.from(this.routes.keys());
        const currentIndex = routeArray.indexOf(currentPath);
        if (currentIndex === -1)
            return;
        // Prefetch previous and next routes
        if (currentIndex > 0) {
            const prevRoute = routeArray[currentIndex - 1];
            if (prevRoute !== undefined) {
                void this.prefetchRoute(prevRoute);
            }
        }
        if (currentIndex < routeArray.length - 1) {
            const nextRoute = routeArray[currentIndex + 1];
            if (nextRoute !== undefined) {
                void this.prefetchRoute(nextRoute);
            }
        }
    }
    /**
     * Process prefetch queue
     */
    private async processPrefetchQueue(): Promise<void> {
        if (this.isPrefetching || this.prefetchQueue.length === 0) {
            return;
        }
        this.isPrefetching = true;
        const maxConcurrent = this.options.maxConcurrent ?? 2;

        await this.processBatch(maxConcurrent);

        this.isPrefetching = false;
    }
    /**
     * Recursively process batches of prefetch routes with controlled concurrency
     *
     * This method processes the prefetch queue in batches, respecting the maxConcurrent
     * limit and applying inter-batch delays. Recursion eliminates await-in-loop patterns
     * while maintaining sequential batch processing semantics.
     */
    private async processBatch(maxConcurrent: number): Promise<void> {
        // Base case: no more items to process
        if (this.prefetchQueue.length === 0) {
            return;
        }

        // Process current batch
        const batch = this.prefetchQueue.splice(0, maxConcurrent);

        await Promise.all(
            batch.map(async (path) => {
                try {
                    const importFn = this.routes.get(path);
                    if (importFn) {
                        await importFn();
                        this.prefetchedRoutes.add(path);
                    }
                }
                catch (error: unknown) {
                    const _errorMessage = getErrorMessage(error);
                    logger.error(`[Prefetch] Failed to prefetch ${path}:`, error);
                }
            })
        );

        // Apply delay before next batch if remaining
        if (this.options.delay && this.prefetchQueue.length > 0) {
            await new Promise<void>((resolve) => {
                setTimeout(resolve, this.options.delay);
            });
        }

        // Recursively process remaining batches
        return this.processBatch(maxConcurrent);
    }
    /**
     * Check if prefetching should occur
     */
    private shouldPrefetch(): boolean {
        const network = getNetworkInfo();
        // Don't prefetch on slow networks or with save data
        if (network.saveData || network.effectiveType === '2g' || network.effectiveType === 'slow-2g') {
            return false;
        }
        // Don't prefetch on low-end devices
        if (isLowEndDevice()) {
            return false;
        }
        return true;
    }
    /**
     * Setup network change listener
     */
    private setupNetworkListener(): void {
        if (typeof window === 'undefined' || !('connection' in navigator)) {
            return;
        }
        interface NavigatorWithConnection extends Navigator {
            connection?: {
                addEventListener: (type: string, listener: () => void) => void;
            };
        }
        const navWithConnection = navigator as unknown as NavigatorWithConnection;
        const connection = navWithConnection.connection;
        if (connection) {
            connection.addEventListener('change', () => {
                // Resume prefetching if conditions improve
                if (this.shouldPrefetch() && this.prefetchQueue.length > 0) {
                    void this.processPrefetchQueue();
                }
            });
        }
    }
}
/**
 * Create a route prefetcher instance
 */
export function createRoutePrefetcher(routes: Record<string, () => Promise<unknown>>, options?: ConstructorParameters<typeof RoutePrefetcher>[1]): RoutePrefetcher {
    return new RoutePrefetcher(new Map(Object.entries(routes)), options);
}
