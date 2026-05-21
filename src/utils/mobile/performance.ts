/**
 * Mobile Performance Utilities
 *
 * Performance optimization utilities for mobile:
 * - Code splitting helpers
 * - Dynamic imports
 * - Reduced motion detection
 * - Performance monitoring
 * - Resource hints
 */
// import { logger } from '@/utils/logger';
import React from 'react';

import { createSuccessResult, createErrorResult } from '../async-result';

import type { AsyncResult} from '../async-result';
/**
 * Performance metrics
 */
export interface PerformanceMetrics {
    /** First Contentful Paint */
    fcp?: number;
    /** Largest Contentful Paint */
    lcp?: number;
    /** First Input Delay */
    fid?: number;
    /** Cumulative Layout Shift */
    cls?: number;
    /** Time to Interactive */
    tti?: number;
    /** Total Blocking Time */
    tbt?: number;
}
/**
 * Network information
 */
export interface NetworkInfo {
    /** Effective connection type */
    effectiveType?: '4g' | '3g' | '2g' | 'slow-2g';
    /** Downlink speed in Mbps */
    downlink?: number;
    /** Round trip time in ms */
    rtt?: number;
    /** Save data preference */
    saveData?: boolean;
}
/**
 * Device capabilities
 */
export interface DeviceCapabilities {
    /** Hardware concurrency (CPU cores) */
    hardwareConcurrency: number;
    /** Device memory in GB */
    deviceMemory?: number;
    /** Max touch points */
    maxTouchPoints: number;
    /** Reduced motion preference */
    prefersReducedMotion: boolean;
    /** Color scheme preference */
    prefersColorScheme: 'light' | 'dark' | 'no-preference';
}
/**
 * Check if user prefers reduced motion
 */
export function prefersReducedMotion(): boolean {
    if (typeof window === 'undefined')
        return false;
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    return mediaQuery.matches;
}
/**
 * Get network information
 */
interface NavigatorWithConnection extends Navigator {
    connection?: {
        effectiveType?: '4g' | '3g' | '2g' | 'slow-2g';
        downlink?: number;
        rtt?: number;
        saveData?: boolean;
    };
}

/**
 * Helper to get typed navigator with connection API
 */
function getNavigatorWithConnection(): NavigatorWithConnection {
    return navigator as unknown as NavigatorWithConnection;
}

export function getNetworkInfo(): NetworkInfo {
    if (typeof navigator === 'undefined' || !('connection' in navigator)) {
        return {};
    }
    const navWithConnection = getNavigatorWithConnection();
    const connection = navWithConnection.connection;
    if (!connection) {
        return {};
    }
    return {
        ...(connection.effectiveType !== undefined ? { effectiveType: connection.effectiveType } : {}),
        ...(connection.downlink !== undefined ? { downlink: connection.downlink } : {}),
        ...(connection.rtt !== undefined ? { rtt: connection.rtt } : {}),
        ...(connection.saveData !== undefined ? { saveData: connection.saveData } : {})
    };
}
/**
 * Get device capabilities
 */
interface NavigatorWithMemory extends Navigator {
    deviceMemory?: number;
}

/**
 * Helper to get typed navigator with memory API
 */
function getNavigatorWithMemory(): NavigatorWithMemory {
    return navigator as unknown as NavigatorWithMemory;
}

export function getDeviceCapabilities(): DeviceCapabilities {
    const prefersColorScheme = (() => {
        if (typeof window === 'undefined')
            return 'no-preference';
        if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
            return 'dark';
        }
        if (window.matchMedia('(prefers-color-scheme: light)').matches) {
            return 'light';
        }
        return 'no-preference';
    })();
    const navWithMemory = getNavigatorWithMemory();
    return {
        hardwareConcurrency: navigator.hardwareConcurrency,
        ...(navWithMemory.deviceMemory !== undefined ? { deviceMemory: navWithMemory.deviceMemory } : {}),
        maxTouchPoints: navigator.maxTouchPoints,
        prefersReducedMotion: prefersReducedMotion(),
        prefersColorScheme: prefersColorScheme as 'light' | 'dark' | 'no-preference'
    };
}
/**
 * Check if device is low-end
 */
export function isLowEndDevice(): boolean {
    const capabilities = getDeviceCapabilities();
    const network = getNetworkInfo();
    // Check device memory (less than 4GB)
    if (capabilities.deviceMemory && capabilities.deviceMemory < 4) {
        return true;
    }
    // Check CPU cores (2 or fewer)
    if (capabilities.hardwareConcurrency <= 2) {
        return true;
    }
    // Check network (2G or slow)
    if (network.effectiveType === '2g' || network.effectiveType === 'slow-2g') {
        return true;
    }
    // Check save data preference
    if (network.saveData) {
        return true;
    }
    return false;
}
/**
 * Measure performance metrics
 */
export async function measurePerformance(): Promise<AsyncResult<PerformanceMetrics, Error>> {
    try {
        if (typeof window === 'undefined' || !('PerformanceObserver' in window)) {
            return createSuccessResult({});
        }
        const metrics: PerformanceMetrics = {};
        // Get navigation timing
        const navigationEntries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
        if (navigationEntries.length > 0) {
            const navigation = navigationEntries[0];
            if (navigation) {
                metrics.tti = navigation.domInteractive - navigation.fetchStart;
            }
        }
        // Get paint timing
        const paintEntries = performance.getEntriesByType('paint');
        const fcp = paintEntries.find((entry) => entry.name === 'first-contentful-paint');
        if (fcp) {
            metrics.fcp = fcp.startTime;
        }
        // Get largest contentful paint
        await new Promise<void>((resolve) => {
            const observer = new PerformanceObserver((list) => {
                const entries = list.getEntries();
                const lcp = entries[entries.length - 1];
                if (lcp) {
                    metrics.lcp = lcp.startTime;
                }
                observer.disconnect();
                resolve();
            });
            observer.observe({ entryTypes: ['largest-contentful-paint'] });
            // Timeout after 5 seconds
            setTimeout(resolve, 5000);
        });
        // Get cumulative layout shift
        await new Promise<void>((resolve) => {
            let clsValue = 0;
            const observer = new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    const layoutShiftEntry = entry as PerformanceEntry & {
                        hadRecentInput?: boolean;
                        value?: number;
                    };
                    if (!layoutShiftEntry.hadRecentInput && layoutShiftEntry.value !== undefined) {
                        clsValue += layoutShiftEntry.value;
                    }
                }
                metrics.cls = clsValue;
            });
            observer.observe({ entryTypes: ['layout-shift'] });
            // Measure for 2 seconds
            setTimeout(() => {
                observer.disconnect();
                resolve();
            }, 2000);
        });
        return createSuccessResult(metrics);
    }
    catch (error: unknown) {
        return createErrorResult(error instanceof Error ? error : new Error('Failed to measure performance'));
    }
}
/**
 * Prefetch resources
 */
export function prefetchResources(urls: string[]): void {
    if (typeof document === 'undefined')
        return;
    urls.forEach((url) => {
        const link = document.createElement('link');
        link.rel = 'prefetch';
        link.href = url;
        document.head.appendChild(link);
    });
}
/**
 * Preconnect to origins
 */
export function preconnectOrigins(origins: string[]): void {
    if (typeof document === 'undefined')
        return;
    origins.forEach((origin) => {
        const link = document.createElement('link');
        link.rel = 'preconnect';
        link.href = origin;
        link.crossOrigin = 'anonymous';
        document.head.appendChild(link);
    });
}
/**
 * Lazy load component with loading state
 */
export function lazyLoadComponent<T extends React.ComponentType<unknown>>(factory: () => Promise<{
    default: T;
}>, options?: {
    prefetch?: boolean;
    fallback?: React.ComponentType;
}): React.LazyExoticComponent<T> {
    // Prefetch on hover/focus if requested
    if (options?.prefetch) {
        if (typeof window !== 'undefined') {
            const prefetch = (): Promise<{ default: T }> => factory();
            // Prefetch after idle
            if ('requestIdleCallback' in window) {
                requestIdleCallback(() => { void prefetch(); });
            }
            else {
                setTimeout(() => { void prefetch(); }, 1);
            }
        }
    }
    return React.lazy(factory);
}
/**
 * Debounce function for performance
 */
export function debounce<T extends (...args: unknown[]) => unknown>(func: T, wait: number, options?: {
    leading?: boolean;
    trailing?: boolean;
    maxWait?: number;
}): T & {
    cancel: () => void;
    flush: () => void;
} {
    let timeout: NodeJS.Timeout | null = null;
    let lastArgs: unknown[] | null = null;
    let lastThis: unknown;
    let maxTimeout: NodeJS.Timeout | null = null;
    let lastCallTime: number | null = null;
    const leading = options?.leading ?? false;
    const trailing = options?.trailing ?? true;
    const maxWait = options?.maxWait;
    function invokeFunc(): unknown {
        if (lastArgs) {
            const result = func.apply(lastThis, lastArgs);
            lastArgs = null;
            lastThis = null;
            return result;
        }
        return undefined;
    }
    function startTimer(pendingFunc: () => void, waitTime: number): NodeJS.Timeout {
        return setTimeout(pendingFunc, waitTime);
    }
    function cancelTimer(): void {
        if (timeout) {
            clearTimeout(timeout);
            timeout = null;
        }
    }
    function cancelMaxTimer(): void {
        if (maxTimeout) {
            clearTimeout(maxTimeout);
            maxTimeout = null;
        }
    }
    function remainingWait(time: number): number {
        const timeSinceLastCall = time - (lastCallTime ?? 0);
        const timeWaiting = wait - timeSinceLastCall;
        if (maxWait !== undefined) {
            return Math.min(timeWaiting, maxWait - timeSinceLastCall);
        }
        return timeWaiting;
    }
    function debounced(this: unknown, ...args: unknown[]): unknown {
        const time = Date.now();
        const isInvoking = shouldInvoke(time);
        lastArgs = args;
        lastThis = this;
        lastCallTime = time;
        if (isInvoking) {
            if (!timeout) {
                return leadingEdge();
            }
            if (maxWait !== undefined) {
                // Handle invocations in a tight loop
                timeout = startTimer(timerExpired, wait);
                return invokeFunc();
            }
        }
        timeout ??= startTimer(timerExpired, wait);
        return undefined;
    }
    function shouldInvoke(time: number): boolean {
        return !lastCallTime ||
            time - lastCallTime >= wait ||
            time - lastCallTime < 0;
    }
    function timerExpired(): void {
        const time = Date.now();
        if (shouldInvoke(time)) {
            trailingEdge();
            return;
        }
        timeout = startTimer(timerExpired, remainingWait(time));
    }
    function leadingEdge(): unknown {
        if (maxWait !== undefined) {
            maxTimeout = startTimer(maxTimerExpired, maxWait);
        }
        if (leading) {
            return invokeFunc();
        }
        return undefined;
    }
    function maxTimerExpired(): void {
        cancelTimer();
        maxTimeout = null;
        if (trailing && lastArgs) {
            invokeFunc();
        }
        lastArgs = null;
        lastThis = null;
    }
    function trailingEdge(): void {
        timeout = null;
        if (trailing && lastArgs) {
            invokeFunc();
        }
        lastArgs = null;
        lastThis = null;
    }
    function cancel(): void {
        cancelTimer();
        cancelMaxTimer();
        lastCallTime = null;
        lastArgs = null;
        lastThis = null;
    }
    function flush(): void {
        if (timeout) {
            trailingEdge();
        }
    }
    debounced.cancel = cancel;
    debounced.flush = flush;
    return debounced as T & {
        cancel: () => void;
        flush: () => void;
    };
}
/**
 * Throttle function for performance
 */
export function throttle<T extends (...args: unknown[]) => unknown>(func: T, wait: number, options?: {
    leading?: boolean;
    trailing?: boolean;
}): T & {
    cancel: () => void;
    flush: () => void;
} {
    const leading = options?.leading ?? true;
    const trailing = options?.trailing ?? true;
    return debounce(func, wait, {
        leading,
        trailing,
        maxWait: wait
    });
}
/**
 * Request idle callback polyfill
 */
export const requestIdleCallback: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number =
    typeof window !== 'undefined' && 'requestIdleCallback' in window
        ? window.requestIdleCallback.bind(window)
        : function (cb: IdleRequestCallback): number {
            const start = Date.now();
            return setTimeout(() => {
                cb({
                    didTimeout: false,
                    timeRemaining: () => Math.max(0, 50 - (Date.now() - start))
                });
            }, 1) as unknown as number;
        };
/**
 * Cancel idle callback polyfill
 */
export const cancelIdleCallback: (handle: number) => void =
    typeof window !== 'undefined' && 'cancelIdleCallback' in window
        ? window.cancelIdleCallback.bind(window)
        : function (id: number): void {
            clearTimeout(id);
        };
