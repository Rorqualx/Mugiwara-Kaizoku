/**
 * Performance Optimization Utilities
 *
 * Utilities for optimizing component performance
 */
import type { DependencyList} from 'react';
import { useEffect, useRef, useMemo, useState } from 'react';

import { debounce, throttle } from 'lodash';

import { logger } from '@/utils/logger';

/**
 * Deep comparison of two values
 */
export function deepEqual(a: unknown, b: unknown): boolean {
    if (a === b)
        return true;
    if (a === null || b === null)
        return false;
    if (typeof a !== 'object' || typeof b !== 'object')
        return false;
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length)
        return false;
    for (const key of keysA) {
        if (!keysB.includes(key))
            return false;
        if (!deepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]))
            return false;
    }
    return true;
}
/**
 * Hook for deep comparison memoization
 */
export function useDeepMemo<T>(factory: () => T, deps: DependencyList): T {
    const ref = useRef<{
        value: T;
        deps: DependencyList;
    } | undefined>(undefined);
    if (!ref.current || !deepEqual(deps, ref.current.deps)) {
        ref.current = { value: factory(), deps };
    }
    return ref.current.value;
}
/**
 * Hook for deep comparison callback
 */
export function useDeepCallback<T extends (...args: unknown[]) => unknown>(callback: T, deps: DependencyList): T {
    return useDeepMemo(() => callback, deps);
}
/**
 * Hook for debounced value
 */
export function useDebouncedValue<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState(value);
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedValue(value), delay);
        return () => clearTimeout(timer);
    }, [value, delay]);
    return debouncedValue;
}
/**
 * Hook for debounced callback
 */
export function useDebouncedCallback<T extends (...args: unknown[]) => unknown>(callback: T, delay: number, _deps: DependencyList = []): T {
    const callbackRef = useRef(callback);
    callbackRef.current = callback;
    const debouncedCallback = useMemo(() => debounce((...args: unknown[]) => callbackRef.current(...args), delay), [delay]);
    useEffect(() => {
        return () => {
            debouncedCallback.cancel();
        };
    }, [debouncedCallback]);
    // Type assertion is safe here because we're wrapping the same function signature
    return debouncedCallback as unknown as T;
}
/**
 * Hook for throttled callback
 */
export function useThrottledCallback<T extends (...args: unknown[]) => unknown>(callback: T, delay: number, _deps: DependencyList = []): T {
    const callbackRef = useRef(callback);
    callbackRef.current = callback;
    const throttledCallback = useMemo(() => throttle((...args: unknown[]) => callbackRef.current(...args), delay), [delay]);
    useEffect(() => {
        return () => {
            throttledCallback.cancel();
        };
    }, [throttledCallback]);
    // Type assertion is safe here because we're wrapping the same function signature
    return throttledCallback as unknown as T;
}
/**
 * Return type for useRenderMetrics hook
 */
export interface UseRenderMetricsReturn {
    renderCount: number;
    avgRenderTime: number;
}

/**
 * Hook for measuring render performance
 */
export function useRenderMetrics(componentName: string): UseRenderMetricsReturn {
    const renderCount = useRef(0);
    const renderTimes = useRef<number[]>([]);
    const lastRenderTime = useRef<number | undefined>(undefined);
    useEffect(() => {
        renderCount.current++;
        const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
        if (lastRenderTime.current) {
            const timeSinceLastRender = now - lastRenderTime.current;
            renderTimes.current.push(timeSinceLastRender);
            // Keep only last 10 render times
            if (renderTimes.current.length > 10) {
                renderTimes.current.shift();
            }
        }
        lastRenderTime.current = now;
        // Log metrics in development
        if (process.env.NODE_ENV === 'development') {
            const avgRenderTime = renderTimes.current.length > 0 ?
                renderTimes.current.reduce((a, b) => a + b, 0) / renderTimes.current.length :
                0;
            logger.debug(`[${componentName}] Render #${renderCount.current}`, {
                avgRenderTime: `${avgRenderTime.toFixed(2)}ms`,
                lastRenderTime: renderTimes.current[renderTimes.current.length - 1]?.toFixed(2) + 'ms'
            });
        }
    });
    return {
        renderCount: renderCount.current,
        avgRenderTime: renderTimes.current.length > 0 ?
            renderTimes.current.reduce((a, b) => a + b, 0) / renderTimes.current.length :
            0
    };
}
/**
 * Hook for lazy initialization
 */
export function useLazyInitialization<T>(factory: () => T, shouldInitialize: boolean = true): T | undefined {
    const [value, setValue] = useState<T | undefined>();
    const initialized = useRef(false);
    useEffect(() => {
        if (shouldInitialize && !initialized.current) {
            setValue(factory());
            initialized.current = true;
        }
    }, [factory, shouldInitialize]);
    return value;
}
/**
 * Hook for request animation frame
 */
export function useAnimationFrame(callback: (deltaTime: number) => void): void {
    const requestRef = useRef<number | undefined>(undefined);
    const previousTimeRef = useRef<number | undefined>(undefined);
    const callbackRef = useRef(callback);
    callbackRef.current = callback;
    useEffect(() => {
        if (typeof requestAnimationFrame === 'undefined') {
            return;
        }
        const animate = (time: number): void => {
            if (previousTimeRef.current !== undefined) {
                const deltaTime = time - previousTimeRef.current;
                callbackRef.current(deltaTime);
            }
            previousTimeRef.current = time;
            requestRef.current = requestAnimationFrame(animate);
        };
        requestRef.current = requestAnimationFrame(animate);
        return () => {
            if (requestRef.current && typeof cancelAnimationFrame !== 'undefined') {
                cancelAnimationFrame(requestRef.current);
            }
        };
    }, []);
}
/**
 * Hook for idle callback
 */
export function useIdleCallback(callback: () => void, options?: IdleRequestOptions): void {
    const callbackRef = useRef(callback);
    callbackRef.current = callback;
    useEffect(() => {
         
        if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
            const w = window as unknown as { requestIdleCallback: (cb: IdleRequestCallback, opts?: IdleRequestOptions) => number; cancelIdleCallback: (id: number) => void };
            const id = w.requestIdleCallback(() => callbackRef.current(), options);
            return () => w.cancelIdleCallback(id);
        }
        else {
            // Fallback to setTimeout
            const id = setTimeout(() => callbackRef.current(), 1);
            return () => clearTimeout(id);
        }
    }, [options, options?.timeout]);
}
/**
 * Batch updates for better performance
 */
export class BatchUpdater<T> {
    private pending: T[] = [];
    private scheduled = false;
    private callback: (items: T[]) => void;
    private delay: number;
    constructor(callback: (items: T[]) => void, delay = 0) {
        this.callback = callback;
        this.delay = delay;
    }
    add(item: T): void {
        this.pending.push(item);
        this.schedule();
    }
    private schedule(): void {
        if (this.scheduled)
            return;
        this.scheduled = true;
        if (this.delay > 0) {
            setTimeout(() => this.flush(), this.delay);
        }
        else {
            void Promise.resolve().then(() => this.flush());
        }
    }
    private flush(): void {
        const items = this.pending;
        this.pending = [];
        this.scheduled = false;
        if (items.length > 0) {
            this.callback(items);
        }
    }
    clear(): void {
        this.pending = [];
        this.scheduled = false;
    }
}
/**
 * Hook for batch updates
 */
export function useBatchUpdates<T>(callback: (items: T[]) => void, delay = 0): BatchUpdater<T> {
    const batcherRef = useRef<BatchUpdater<T> | undefined>(undefined);
    batcherRef.current ??= new BatchUpdater(callback, delay);
    useEffect(() => {
        return () => {
            batcherRef.current?.clear();
        };
    }, []);
    return batcherRef.current;
}
/**
 * Memory cache with LRU eviction
 */
export class LRUCache<K, V> {
    private cache = new Map<K, V>();
    private maxSize: number;
    constructor(maxSize: number = 100) {
        this.maxSize = maxSize;
    }
    get(key: K): V | undefined {
        const value = this.cache.get(key);
        if (value !== undefined) {
            // Move to end (most recently used)
            this.cache.delete(key);
            this.cache.set(key, value);
        }
        return value;
    }
    set(key: K, value: V): void {
        // Remove if exists (to update position)
        if (this.cache.has(key)) {
            this.cache.delete(key);
        }
        else if (this.cache.size >= this.maxSize) {
            // Remove least recently used (first item)
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey as K);
        }
        this.cache.set(key, value);
    }
    has(key: K): boolean {
        return this.cache.has(key);
    }
    clear(): void {
        this.cache.clear();
    }
    get size(): number {
        return this.cache.size;
    }
}
/**
 * Hook for LRU cache
 */
export function useLRUCache<K, V>(maxSize: number = 100): LRUCache<K, V> {
    const cacheRef = useRef<LRUCache<K, V> | undefined>(undefined);
    cacheRef.current ??= new LRUCache(maxSize);
    return cacheRef.current;
}
/**
 * Memoize async function results
 */
export function memoizeAsync<T extends (...args: unknown[]) => Promise<unknown>>(fn: T, keyResolver?: (...args: Parameters<T>) => string): T {
    const cache = new Map<string, Promise<unknown>>();
    return (async (...args: Parameters<T>) => {
        const key = keyResolver ? keyResolver(...args) : JSON.stringify(args);
        if (cache.has(key)) {
            return cache.get(key);
        }
        const promise = fn(...args);
        cache.set(key, promise);
        try {
            const result = await promise;
            return result;
        }
        catch (error: unknown) {const errorMessage = error instanceof Error ? error.message : String(error);
// Remove from cache on errorMessage
            cache.delete(key);
            throw new Error(errorMessage);
        }
    }) as T;
}
// Re-export React optimization imports
export { memo, useMemo } from 'react';
